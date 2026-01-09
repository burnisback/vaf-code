/**
 * Escalation Handler
 *
 * Handles stuck reviews, max iteration breaches, and executive overrides.
 */

import { z } from 'genkit';
import { ai, gemini15Pro } from '../genkit';
import {
  type Stage,
  type Decision,
  type DecisionObject,
  type EscalationRequest,
  type WorkItem,
} from './types';
import { createEscalation } from './decision';
import { governanceLedger } from './ledger';

/**
 * Escalation reason types
 */
export type EscalationReason =
  | 'MAX_ITERATIONS_EXCEEDED'
  | 'CONFLICTING_REVIEWS'
  | 'STUCK_APPROVAL'
  | 'CRITICAL_BLOCKER'
  | 'MANUAL_ESCALATION';

/**
 * Escalation status
 */
export type EscalationStatus =
  | 'PENDING'
  | 'REVIEWING'
  | 'RESOLVED'
  | 'DISMISSED';

/**
 * Escalation record
 */
export interface EscalationRecord {
  id: string;
  workItemId: string;
  stage: Stage;
  reason: EscalationReason;
  description: string;
  requestedBy: string;
  requestedAt: string;
  status: EscalationStatus;
  resolution?: {
    decision: Decision;
    notes: string;
    resolvedBy: string;
    resolvedAt: string;
  };
  context: {
    iteration: number;
    stuckReviews: DecisionObject[];
    blockingDecisions: DecisionObject[];
  };
}

/**
 * Escalation resolution schema
 */
const escalationResolutionSchema = z.object({
  decision: z.enum(['APPROVED', 'APPROVED_WITH_RISKS', 'REJECTED']),
  notes: z.string().describe('Detailed reasoning for the decision'),
  acceptedRisks: z.array(z.string()).optional().describe('Risks accepted if approving'),
  requiredActions: z.array(z.string()).optional().describe('Actions required before proceeding'),
});

/**
 * Generate escalation ID
 */
function generateEscalationId(): string {
  return `ESC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Escalation Handler class
 */
export class EscalationHandler {
  private escalations: Map<string, EscalationRecord> = new Map();

  /**
   * Create an escalation
   */
  createEscalation(
    workItem: WorkItem,
    reason: EscalationReason,
    description: string,
    requestedBy: string,
    context: {
      stuckReviews?: DecisionObject[];
      blockingDecisions?: DecisionObject[];
    } = {}
  ): EscalationRecord {
    const escalation: EscalationRecord = {
      id: generateEscalationId(),
      workItemId: workItem.id,
      stage: workItem.currentStage,
      reason,
      description,
      requestedBy,
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
      context: {
        iteration: workItem.iterationCount ?? 0,
        stuckReviews: context.stuckReviews ?? [],
        blockingDecisions: context.blockingDecisions ?? [],
      },
    };

    this.escalations.set(escalation.id, escalation);

    // Log to ledger
    governanceLedger.logEscalationTriggered(
      workItem.id,
      workItem.currentStage,
      `${reason}: ${description}`,
      workItem.iterationCount ?? 0,
      requestedBy
    );

    console.log(
      `[Escalation] Created ${escalation.id} for ${workItem.id}: ${reason}`
    );

    return escalation;
  }

  /**
   * Request executive decision on escalation
   */
  async requestExecutiveDecision(
    escalation: EscalationRecord
  ): Promise<DecisionObject> {
    escalation.status = 'REVIEWING';

    const prompt = this.buildEscalationPrompt(escalation);

    // Use Pro model for executive decisions
    const response = await ai.generate({
      model: gemini15Pro,
      prompt,
      output: { schema: escalationResolutionSchema },
      config: {
        temperature: 0.2,
      },
    });

    const result = response.output as {
      decision: Decision;
      notes: string;
      acceptedRisks?: string[];
      requiredActions?: string[];
    };

    // Update escalation record
    escalation.status = 'RESOLVED';
    escalation.resolution = {
      decision: result.decision,
      notes: result.notes,
      resolvedBy: 'vaf-orchestrator',
      resolvedAt: new Date().toISOString(),
    };

    // Create decision object
    const decision = createEscalation(
      escalation.workItemId,
      escalation.stage,
      result.decision,
      result.notes,
      {
        risks: result.acceptedRisks,
        iteration: escalation.context.iteration,
      }
    );

    // Log to ledger
    governanceLedger.logDecision(decision);

    console.log(
      `[Escalation] ${escalation.id} resolved: ${result.decision}`
    );

    return decision;
  }

  /**
   * Check if escalation is needed
   */
  checkEscalationNeeded(workItem: WorkItem): {
    needed: boolean;
    reason?: EscalationReason;
    description?: string;
  } {
    const decisions = workItem.decisions ?? [];
    const currentStageDecisions = decisions.filter(
      (d) => d.stage === workItem.currentStage
    );

    // Check max iterations
    if ((workItem.iterationCount ?? 0) >= (workItem.maxIterations ?? 3)) {
      return {
        needed: true,
        reason: 'MAX_ITERATIONS_EXCEEDED',
        description: `Work item has exceeded ${workItem.maxIterations ?? 3} iterations at ${workItem.currentStage} stage`,
      };
    }

    // Check for conflicting reviews
    const reviewsByDomain = new Map<string, DecisionObject[]>();
    currentStageDecisions
      .filter((d) => d.decisionType === 'REVIEW')
      .forEach((d) => {
        const existing = reviewsByDomain.get(d.domain) ?? [];
        existing.push(d);
        reviewsByDomain.set(d.domain, existing);
      });

    for (const [domain, reviews] of reviewsByDomain) {
      const decisions = new Set(reviews.map((r) => r.decision));
      if (decisions.has('APPROVED') && decisions.has('REJECTED')) {
        return {
          needed: true,
          reason: 'CONFLICTING_REVIEWS',
          description: `Conflicting reviews in ${domain}: some approved, some rejected`,
        };
      }
    }

    // Check for stuck approvals (multiple CHANGES_REQUIRED on same item)
    const changesRequired = currentStageDecisions.filter(
      (d) => d.decision === 'CHANGES_REQUIRED'
    );
    const reviewerCounts = new Map<string, number>();
    changesRequired.forEach((d) => {
      const count = reviewerCounts.get(d.reviewerAgent) ?? 0;
      reviewerCounts.set(d.reviewerAgent, count + 1);
    });

    for (const [reviewer, count] of reviewerCounts) {
      if (count >= 3) {
        return {
          needed: true,
          reason: 'STUCK_APPROVAL',
          description: `${reviewer} has requested changes ${count} times without resolution`,
        };
      }
    }

    return { needed: false };
  }

  /**
   * Auto-escalate if needed
   */
  async autoEscalate(workItem: WorkItem): Promise<DecisionObject | null> {
    const check = this.checkEscalationNeeded(workItem);

    if (!check.needed || !check.reason || !check.description) {
      return null;
    }

    const decisions = workItem.decisions ?? [];
    const stuckReviews = decisions.filter(
      (d) =>
        d.stage === workItem.currentStage &&
        d.decisionType === 'REVIEW' &&
        (d.decision === 'CHANGES_REQUIRED' || d.decision === 'REJECTED')
    );

    const escalation = this.createEscalation(
      workItem,
      check.reason,
      check.description,
      'system',
      { stuckReviews, blockingDecisions: stuckReviews }
    );

    return this.requestExecutiveDecision(escalation);
  }

  /**
   * Get escalation by ID
   */
  getEscalation(id: string): EscalationRecord | undefined {
    return this.escalations.get(id);
  }

  /**
   * Get escalations for a work item
   */
  getWorkItemEscalations(workItemId: string): EscalationRecord[] {
    return Array.from(this.escalations.values()).filter(
      (e) => e.workItemId === workItemId
    );
  }

  /**
   * Get pending escalations
   */
  getPendingEscalations(): EscalationRecord[] {
    return Array.from(this.escalations.values()).filter(
      (e) => e.status === 'PENDING' || e.status === 'REVIEWING'
    );
  }

  /**
   * Dismiss an escalation
   */
  dismissEscalation(id: string, reason: string): boolean {
    const escalation = this.escalations.get(id);
    if (!escalation) {
      return false;
    }

    escalation.status = 'DISMISSED';
    escalation.resolution = {
      decision: 'REJECTED',
      notes: `Dismissed: ${reason}`,
      resolvedBy: 'vaf-orchestrator',
      resolvedAt: new Date().toISOString(),
    };

    return true;
  }

  /**
   * Build escalation prompt for executive decision
   */
  private buildEscalationPrompt(escalation: EscalationRecord): string {
    let prompt = `You are the Factory CEO (vaf-orchestrator) making an executive decision on an escalation.

## Escalation Details

**ID**: ${escalation.id}
**Work Item**: ${escalation.workItemId}
**Stage**: ${escalation.stage}
**Reason**: ${escalation.reason}
**Description**: ${escalation.description}
**Iteration**: ${escalation.context.iteration}

### Context
`;

    if (escalation.context.stuckReviews.length > 0) {
      prompt += `
#### Stuck Reviews
${escalation.context.stuckReviews.map((r) => `- ${r.reviewerAgent} (${r.domain}): ${r.decision} - ${r.notes}`).join('\n')}
`;
    }

    if (escalation.context.blockingDecisions.length > 0) {
      prompt += `
#### Blocking Decisions
${escalation.context.blockingDecisions.map((d) => `- ${d.reviewerAgent}: ${d.decision} - ${d.notes}${d.requiredChanges ? `\n  Changes: ${d.requiredChanges.join(', ')}` : ''}`).join('\n')}
`;
    }

    prompt += `
## Your Decision

As the executive authority, you must decide:

1. **APPROVED**: Proceed despite the blockers (use sparingly)
2. **APPROVED_WITH_RISKS**: Proceed with documented risks
3. **REJECTED**: Work item cannot proceed, will be cancelled

Consider:
- Is the blocker reasonable or overly pedantic?
- What are the risks of proceeding vs. not proceeding?
- Can the concerns be addressed in a follow-up?
- Is this work item critical to the project?

Provide detailed reasoning for your decision.
If approving with risks, document all accepted risks.
If approving, list any required actions before proceeding.`;

    return prompt;
  }
}

// Singleton instance
export const escalationHandler = new EscalationHandler();

/**
 * Manual escalation helper
 */
export async function escalateManually(
  workItem: WorkItem,
  description: string,
  requestedBy: string
): Promise<DecisionObject> {
  const escalation = escalationHandler.createEscalation(
    workItem,
    'MANUAL_ESCALATION',
    description,
    requestedBy
  );

  return escalationHandler.requestExecutiveDecision(escalation);
}
