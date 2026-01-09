/**
 * Reviewer Agent Base
 *
 * Base functionality for all reviewer agents that conduct reviews
 * and return Decision Objects.
 */

import { z } from 'genkit';
import { ai, gemini15Flash } from '../genkit';
import {
  type Stage,
  type Decision,
  type DecisionObject,
  decisionObjectSchema,
} from './types';
import { createReview } from './decision';

/**
 * Review request input
 */
export interface ReviewRequest {
  workItemId: string;
  stage: Stage;
  domain: string;
  artifactContent: string;
  artifactName: string;
  context?: string;
  previousFeedback?: string[];
  iteration?: number;
}

/**
 * Review result from AI
 */
export interface ReviewResult {
  decision: Decision;
  notes: string;
  requiredChanges: string[];
  risks: string[];
}

/**
 * Review result schema for AI output
 */
export const reviewResultSchema = z.object({
  decision: z.enum(['APPROVED', 'CHANGES_REQUIRED', 'REJECTED', 'APPROVED_WITH_RISKS']),
  notes: z.string().describe('Summary of findings'),
  requiredChanges: z.array(z.string()).describe('List of required changes if not approved'),
  risks: z.array(z.string()).describe('List of identified risks'),
});

/**
 * Base reviewer configuration
 */
export interface ReviewerConfig {
  name: string;
  agent: string;
  domain: string;
  systemPrompt: string;
  reviewCriteria: string[];
}

/**
 * Create a reviewer flow
 */
export function createReviewerFlow(config: ReviewerConfig) {
  const flowName = `${config.agent}-${config.domain}-review`;

  return ai.defineFlow(
    {
      name: flowName,
      inputSchema: z.object({
        workItemId: z.string(),
        stage: z.string(),
        artifactContent: z.string(),
        artifactName: z.string(),
        context: z.string().optional(),
        previousFeedback: z.array(z.string()).optional(),
        iteration: z.number().optional(),
      }),
      outputSchema: decisionObjectSchema,
    },
    async (input) => {
      const prompt = buildReviewPrompt(config, input);

      const response = await ai.generate({
        model: gemini15Flash,
        prompt,
        output: { schema: reviewResultSchema },
        config: {
          temperature: 0.3, // Lower temperature for consistent reviews
        },
      });

      const result = response.output as ReviewResult;

      // Create the decision object
      const decision = createReview(
        input.workItemId,
        input.stage as Stage,
        config.agent,
        config.domain,
        result.decision,
        result.notes,
        {
          requiredChanges: result.requiredChanges,
          risks: result.risks,
          artifactsReviewed: [input.artifactName],
          iteration: input.iteration,
        }
      );

      return decision;
    }
  );
}

/**
 * Build the review prompt
 */
function buildReviewPrompt(
  config: ReviewerConfig,
  input: {
    artifactContent: string;
    artifactName: string;
    context?: string;
    previousFeedback?: string[];
    iteration?: number;
  }
): string {
  let prompt = `${config.systemPrompt}

## Review Task

You are reviewing: **${input.artifactName}**

### Review Criteria
${config.reviewCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### Artifact Content
\`\`\`
${input.artifactContent}
\`\`\`
`;

  if (input.context) {
    prompt += `
### Additional Context
${input.context}
`;
  }

  if (input.previousFeedback && input.previousFeedback.length > 0) {
    prompt += `
### Previous Feedback (Iteration ${input.iteration ?? 1})
${input.previousFeedback.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Please verify that the previous feedback has been addressed.
`;
  }

  prompt += `
### Instructions

Review the artifact against all criteria and provide:
1. A decision: APPROVED, CHANGES_REQUIRED, REJECTED, or APPROVED_WITH_RISKS
2. A summary of your findings
3. Specific required changes (if not approved)
4. Any identified risks

Be thorough but fair. Only reject if there are critical issues.
`;

  return prompt;
}

/**
 * Base ReviewerAgent class
 */
export class ReviewerAgent {
  protected config: ReviewerConfig;
  protected flow: ReturnType<typeof createReviewerFlow>;

  constructor(config: ReviewerConfig) {
    this.config = config;
    this.flow = createReviewerFlow(config);
  }

  /**
   * Conduct a review
   */
  async review(request: ReviewRequest): Promise<DecisionObject> {
    return this.flow({
      workItemId: request.workItemId,
      stage: request.stage,
      artifactContent: request.artifactContent,
      artifactName: request.artifactName,
      context: request.context,
      previousFeedback: request.previousFeedback,
      iteration: request.iteration,
    });
  }

  /**
   * Get reviewer info
   */
  get name(): string {
    return this.config.name;
  }

  get agent(): string {
    return this.config.agent;
  }

  get domain(): string {
    return this.config.domain;
  }
}

/**
 * Quick review helper for simple checks
 */
export async function quickReview(
  workItemId: string,
  stage: Stage,
  agent: string,
  domain: string,
  artifactContent: string,
  artifactName: string,
  checkList: string[]
): Promise<DecisionObject> {
  // Perform a simple checklist-based review
  const issues: string[] = [];

  for (const check of checkList) {
    // Simple heuristic checks
    if (check.toLowerCase().includes('not empty') && !artifactContent.trim()) {
      issues.push(`${artifactName} is empty`);
    }
    if (check.toLowerCase().includes('has title') && !artifactContent.includes('#')) {
      issues.push(`${artifactName} missing title/header`);
    }
  }

  const decision: Decision = issues.length === 0 ? 'APPROVED' : 'CHANGES_REQUIRED';

  return createReview(
    workItemId,
    stage,
    agent,
    domain,
    decision,
    issues.length === 0 ? 'All checks passed' : `Found ${issues.length} issue(s)`,
    {
      requiredChanges: issues,
      artifactsReviewed: [artifactName],
    }
  );
}
