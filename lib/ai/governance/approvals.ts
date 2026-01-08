/**
 * Approval Collector
 *
 * Collects approvals from designated agents and tracks approval status.
 */

import { z } from 'genkit';
import { ai, gemini15Flash } from '../genkit';
import {
  type Stage,
  type Decision,
  type DecisionObject,
  STAGE_CONFIGS,
} from './types';
import { createApproval, createSignoff } from './decision';
import { governanceLedger } from './ledger';

/**
 * Approval request
 */
export interface ApprovalRequest {
  workItemId: string;
  stage: Stage;
  agent: string;
  domain: string;
  artifactContent: string;
  artifactName: string;
  context?: string;
}

/**
 * Approval result from AI
 */
export interface ApprovalResult {
  approved: boolean;
  notes: string;
  conditions?: string[];
}

/**
 * Approval result schema
 */
const approvalResultSchema = z.object({
  approved: z.boolean().describe('Whether to approve'),
  notes: z.string().describe('Approval notes and reasoning'),
  conditions: z.array(z.string()).optional().describe('Conditions for approval if any'),
});

/**
 * Approval status for a stage
 */
export interface StageApprovalStatus {
  stage: Stage;
  reviews: {
    agent: string;
    domain: string;
    status: 'pending' | 'approved' | 'rejected' | 'changes_required';
    decision?: DecisionObject;
  }[];
  approvals: {
    agent: string;
    domain: string;
    status: 'pending' | 'approved';
    decision?: DecisionObject;
  }[];
  signoff: {
    agent: string;
    status: 'pending' | 'approved';
    decision?: DecisionObject;
  };
  canAdvance: boolean;
  blockers: string[];
}

/**
 * Approval Collector class
 */
export class ApprovalCollector {
  /**
   * Request an approval from an agent
   */
  async requestApproval(request: ApprovalRequest): Promise<DecisionObject> {
    const prompt = this.buildApprovalPrompt(request);

    const response = await ai.generate({
      model: gemini15Flash,
      prompt,
      output: { schema: approvalResultSchema },
      config: {
        temperature: 0.2, // Low temperature for consistent approvals
      },
    });

    const result = response.output as ApprovalResult;

    // Create the decision object
    const decision = createApproval(
      request.workItemId,
      request.stage,
      request.agent,
      request.domain,
      result.notes,
      [request.artifactName]
    );

    // Override decision if not approved
    if (!result.approved) {
      decision.decision = 'CHANGES_REQUIRED';
      decision.blocksTransition = true;
      if (result.conditions) {
        decision.requiredChanges = result.conditions;
      }
    }

    // Log to ledger
    governanceLedger.logDecision(decision);

    return decision;
  }

  /**
   * Request sign-off from orchestrator
   */
  async requestSignoff(
    workItemId: string,
    stage: Stage,
    summary: string,
    artifactsReviewed: string[]
  ): Promise<DecisionObject> {
    const prompt = `You are the Factory CEO (vaf-orchestrator) providing final sign-off.

## Stage Sign-off Request

**Work Item**: ${workItemId}
**Stage**: ${stage}

### Summary
${summary}

### Artifacts Reviewed
${artifactsReviewed.map((a) => `- ${a}`).join('\n')}

### Instructions
Review the summary and provide sign-off to advance to the next stage.
Only approve if all requirements for this stage have been met.`;

    const response = await ai.generate({
      model: gemini15Flash,
      prompt,
      output: { schema: approvalResultSchema },
      config: {
        temperature: 0.1,
      },
    });

    const result = response.output as ApprovalResult;

    // Create sign-off decision
    const decision = createSignoff(
      workItemId,
      stage,
      result.notes,
      artifactsReviewed
    );

    // Override if not approved
    if (!result.approved) {
      decision.decision = 'CHANGES_REQUIRED';
      decision.blocksTransition = true;
    }

    // Log to ledger
    governanceLedger.logDecision(decision);

    return decision;
  }

  /**
   * Collect all required approvals for a stage
   */
  async collectStageApprovals(
    workItemId: string,
    stage: Stage,
    artifacts: Record<string, string>
  ): Promise<DecisionObject[]> {
    const stageConfig = STAGE_CONFIGS[stage];
    const decisions: DecisionObject[] = [];

    // Collect approvals
    for (const approval of stageConfig.requiredApprovals) {
      // Find the relevant artifact for this approval
      const artifactName = this.findRelevantArtifact(approval.domain, artifacts);
      const artifactContent = artifactName ? artifacts[artifactName] : 'No specific artifact';

      const decision = await this.requestApproval({
        workItemId,
        stage,
        agent: approval.agent,
        domain: approval.domain,
        artifactContent,
        artifactName: artifactName ?? 'stage-summary',
      });

      decisions.push(decision);

      // If any approval is rejected, stop collecting
      if (decision.decision === 'REJECTED') {
        break;
      }
    }

    return decisions;
  }

  /**
   * Get approval status for a stage
   */
  getStageApprovalStatus(
    workItemId: string,
    stage: Stage,
    decisions: DecisionObject[]
  ): StageApprovalStatus {
    const stageConfig = STAGE_CONFIGS[stage];
    const stageDecisions = decisions.filter((d) => d.stage === stage);
    const blockers: string[] = [];

    // Check reviews
    const reviews = stageConfig.requiredReviews.map((review) => {
      const decision = stageDecisions.find(
        (d) =>
          d.decisionType === 'REVIEW' &&
          d.reviewerAgent === review.agent &&
          d.domain === review.domain
      );

      let status: 'pending' | 'approved' | 'rejected' | 'changes_required' = 'pending';
      if (decision) {
        if (decision.decision === 'APPROVED' || decision.decision === 'APPROVED_WITH_RISKS') {
          status = 'approved';
        } else if (decision.decision === 'REJECTED') {
          status = 'rejected';
          blockers.push(`${review.agent} rejected (${review.domain})`);
        } else if (decision.decision === 'CHANGES_REQUIRED') {
          status = 'changes_required';
          blockers.push(`${review.agent} requires changes (${review.domain})`);
        }
      } else {
        blockers.push(`Pending review: ${review.agent} (${review.domain})`);
      }

      return { agent: review.agent, domain: review.domain, status, decision };
    });

    // Check approvals
    const approvals = stageConfig.requiredApprovals.map((approval) => {
      const decision = stageDecisions.find(
        (d) =>
          (d.decisionType === 'APPROVAL' || d.decisionType === 'SIGNOFF') &&
          d.reviewerAgent === approval.agent &&
          d.domain === approval.domain &&
          (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
      );

      const status = decision ? 'approved' : 'pending';
      if (!decision) {
        blockers.push(`Pending approval: ${approval.agent} (${approval.domain})`);
      }

      return { agent: approval.agent, domain: approval.domain, status: status as 'pending' | 'approved', decision };
    });

    // Check sign-off
    const signoffDecision = stageDecisions.find(
      (d) =>
        d.decisionType === 'SIGNOFF' &&
        d.reviewerAgent === stageConfig.signoffAgent &&
        (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
    );

    const signoff = {
      agent: stageConfig.signoffAgent,
      status: signoffDecision ? 'approved' as const : 'pending' as const,
      decision: signoffDecision,
    };

    if (!signoffDecision && stage !== 'COMPLETED') {
      blockers.push(`Pending sign-off: ${stageConfig.signoffAgent}`);
    }

    // Determine if can advance
    const allReviewsApproved = reviews.every((r) => r.status === 'approved');
    const allApprovalsGranted = approvals.every((a) => a.status === 'approved');
    const signoffGranted = signoff.status === 'approved' || stage === 'COMPLETED';
    const canAdvance = allReviewsApproved && allApprovalsGranted && signoffGranted;

    return {
      stage,
      reviews,
      approvals,
      signoff,
      canAdvance,
      blockers,
    };
  }

  /**
   * Batch approval - collect multiple approvals in parallel
   */
  async batchApprove(
    requests: ApprovalRequest[]
  ): Promise<DecisionObject[]> {
    const promises = requests.map((req) => this.requestApproval(req));
    return Promise.all(promises);
  }

  /**
   * Build approval prompt
   */
  private buildApprovalPrompt(request: ApprovalRequest): string {
    return `You are ${request.agent} providing approval for ${request.domain}.

## Approval Request

**Work Item**: ${request.workItemId}
**Stage**: ${request.stage}
**Domain**: ${request.domain}

### Artifact: ${request.artifactName}
\`\`\`
${request.artifactContent}
\`\`\`

${request.context ? `### Additional Context\n${request.context}\n` : ''}

### Instructions
Review the artifact and decide whether to approve.
- Approve if the artifact meets the requirements for this domain
- Request changes if there are issues that must be addressed
- Be thorough but practical

Provide clear notes explaining your decision.`;
  }

  /**
   * Find relevant artifact for a domain
   */
  private findRelevantArtifact(
    domain: string,
    artifacts: Record<string, string>
  ): string | null {
    // Map domains to typical artifact names
    const domainArtifactMap: Record<string, string[]> = {
      requirements: ['requirements.md'],
      prd: ['prd.md'],
      'prd-technical': ['prd.md'],
      'prd-ux': ['prd.md'],
      architecture: ['architecture.md', 'tech-spec.md'],
      'tech-spec': ['tech-spec.md'],
      design: ['design-spec.md'],
      'design-system': ['design-spec.md'],
      implementability: ['design-spec.md', 'tech-spec.md'],
      implementation: ['implementation-log.md'],
      'code-architecture': ['implementation-log.md'],
      'code-security': ['implementation-log.md'],
      quality: ['verification-report.md'],
      acceptance: ['verification-report.md'],
      deployment: ['release-notes.md'],
      'final-signoff': ['release-notes.md'],
    };

    const possibleArtifacts = domainArtifactMap[domain] ?? [];
    for (const artifactName of possibleArtifacts) {
      if (artifacts[artifactName]) {
        return artifactName;
      }
    }

    // Return first available artifact
    const keys = Object.keys(artifacts);
    return keys.length > 0 ? keys[0] : null;
  }
}

// Singleton instance
export const approvalCollector = new ApprovalCollector();
