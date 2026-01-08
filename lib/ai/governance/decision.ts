/**
 * Decision Creator
 *
 * Creates and validates governance decisions for the pipeline.
 */

import { z } from 'genkit';
import {
  type Stage,
  type DecisionType,
  type Decision,
  type DecisionObject,
  decisionObjectSchema,
  STAGES,
} from './types';

/**
 * Parameters for creating a decision
 */
export interface CreateDecisionParams {
  workItemId: string;
  stage: Stage;
  decisionType: DecisionType;
  decision: Decision;
  reviewerAgent: string;
  domain: string;
  notes: string;
  iteration?: number;
  requiredChanges?: string[];
  risks?: string[];
  artifactsReviewed?: string[];
  blocksTransition?: boolean;
}

/**
 * Create a new decision object with validation
 */
export function createDecision(params: CreateDecisionParams): DecisionObject {
  const decision: DecisionObject = {
    workItemId: params.workItemId,
    stage: params.stage,
    decisionType: params.decisionType,
    decision: params.decision,
    reviewerAgent: params.reviewerAgent,
    timestamp: new Date().toISOString(),
    domain: params.domain,
    iteration: params.iteration ?? 1,
    notes: params.notes,
    requiredChanges: params.requiredChanges,
    risks: params.risks,
    artifactsReviewed: params.artifactsReviewed,
    blocksTransition: params.blocksTransition ?? false,
  };

  // Validate the decision
  const validation = validateDecision(decision);
  if (!validation.valid) {
    throw new Error(`Invalid decision: ${validation.errors.join(', ')}`);
  }

  return decision;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a decision object
 */
export function validateDecision(decision: unknown): ValidationResult {
  const errors: string[] = [];

  try {
    decisionObjectSchema.parse(decision);
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
    } else {
      errors.push('Unknown validation error');
    }
  }

  // Additional business logic validation
  const dec = decision as DecisionObject;

  // Ensure stage is valid
  if (!STAGES.includes(dec.stage)) {
    errors.push(`Invalid stage: ${dec.stage}`);
  }

  // If decision is CHANGES_REQUIRED, requiredChanges should be provided
  if (dec.decision === 'CHANGES_REQUIRED' && (!dec.requiredChanges || dec.requiredChanges.length === 0)) {
    errors.push('CHANGES_REQUIRED decision must include requiredChanges');
  }

  // If decision is APPROVED_WITH_RISKS, risks should be provided
  if (dec.decision === 'APPROVED_WITH_RISKS' && (!dec.risks || dec.risks.length === 0)) {
    errors.push('APPROVED_WITH_RISKS decision must include risks');
  }

  // SIGNOFF can only be from orchestrator
  if (dec.decisionType === 'SIGNOFF' && !dec.reviewerAgent.includes('orchestrator')) {
    errors.push('SIGNOFF decisions can only be made by orchestrator');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Serialize a decision to JSON string
 */
export function serializeDecision(decision: DecisionObject): string {
  return JSON.stringify(decision, null, 2);
}

/**
 * Parse a decision from JSON string
 */
export function parseDecision(json: string): DecisionObject {
  const parsed = JSON.parse(json);
  const validation = validateDecision(parsed);

  if (!validation.valid) {
    throw new Error(`Invalid decision JSON: ${validation.errors.join(', ')}`);
  }

  return parsed as DecisionObject;
}

/**
 * Check if a decision blocks stage transition
 */
export function blocksTransition(decision: DecisionObject): boolean {
  // Explicit blocking
  if (decision.blocksTransition) {
    return true;
  }

  // Implicit blocking based on decision
  return decision.decision === 'CHANGES_REQUIRED' || decision.decision === 'REJECTED';
}

/**
 * Create an approval decision
 */
export function createApproval(
  workItemId: string,
  stage: Stage,
  reviewerAgent: string,
  domain: string,
  notes: string,
  artifactsReviewed?: string[]
): DecisionObject {
  return createDecision({
    workItemId,
    stage,
    decisionType: 'APPROVAL',
    decision: 'APPROVED',
    reviewerAgent,
    domain,
    notes,
    artifactsReviewed,
    blocksTransition: false,
  });
}

/**
 * Create a review decision
 */
export function createReview(
  workItemId: string,
  stage: Stage,
  reviewerAgent: string,
  domain: string,
  decision: Decision,
  notes: string,
  options?: {
    requiredChanges?: string[];
    risks?: string[];
    artifactsReviewed?: string[];
    iteration?: number;
  }
): DecisionObject {
  return createDecision({
    workItemId,
    stage,
    decisionType: 'REVIEW',
    decision,
    reviewerAgent,
    domain,
    notes,
    requiredChanges: options?.requiredChanges,
    risks: options?.risks,
    artifactsReviewed: options?.artifactsReviewed,
    iteration: options?.iteration,
    blocksTransition: decision === 'CHANGES_REQUIRED' || decision === 'REJECTED',
  });
}

/**
 * Create a sign-off decision (orchestrator only)
 */
export function createSignoff(
  workItemId: string,
  stage: Stage,
  notes: string,
  artifactsReviewed?: string[]
): DecisionObject {
  return createDecision({
    workItemId,
    stage,
    decisionType: 'SIGNOFF',
    decision: 'APPROVED',
    reviewerAgent: 'vaf-orchestrator',
    domain: 'stage-signoff',
    notes,
    artifactsReviewed,
    blocksTransition: false,
  });
}

/**
 * Create an escalation decision
 */
export function createEscalation(
  workItemId: string,
  stage: Stage,
  decision: Decision,
  notes: string,
  options?: {
    risks?: string[];
    iteration?: number;
  }
): DecisionObject {
  return createDecision({
    workItemId,
    stage,
    decisionType: 'ESCALATION',
    decision,
    reviewerAgent: 'vaf-orchestrator',
    domain: 'escalation',
    notes,
    risks: options?.risks,
    iteration: options?.iteration,
    blocksTransition: decision === 'REJECTED',
  });
}

/**
 * Check if all required approvals are present for a stage
 */
export function hasRequiredApprovals(
  decisions: DecisionObject[],
  stage: Stage,
  requiredApprovers: { agent: string; domain: string }[]
): { complete: boolean; missing: { agent: string; domain: string }[] } {
  const approvals = decisions.filter(
    (d) => d.stage === stage && (d.decisionType === 'APPROVAL' || d.decisionType === 'SIGNOFF') && d.decision === 'APPROVED'
  );

  const missing: { agent: string; domain: string }[] = [];

  for (const required of requiredApprovers) {
    const found = approvals.some(
      (a) => a.reviewerAgent === required.agent && a.domain === required.domain
    );
    if (!found) {
      missing.push(required);
    }
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}

/**
 * Check if all required reviews are present for a stage
 */
export function hasRequiredReviews(
  decisions: DecisionObject[],
  stage: Stage,
  requiredReviewers: { agent: string; domain: string }[]
): { complete: boolean; missing: { agent: string; domain: string }[]; hasBlockers: boolean } {
  const reviews = decisions.filter(
    (d) => d.stage === stage && d.decisionType === 'REVIEW'
  );

  const missing: { agent: string; domain: string }[] = [];
  let hasBlockers = false;

  for (const required of requiredReviewers) {
    const found = reviews.find(
      (r) => r.reviewerAgent === required.agent && r.domain === required.domain
    );
    if (!found) {
      missing.push(required);
    } else if (found.decision === 'CHANGES_REQUIRED' || found.decision === 'REJECTED') {
      hasBlockers = true;
    }
  }

  return {
    complete: missing.length === 0,
    missing,
    hasBlockers,
  };
}
