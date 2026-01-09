import { z } from 'genkit';

/**
 * Governance Types
 *
 * TypeScript interfaces and schemas for the AI governance system.
 */

// Pipeline stages
export const STAGES = [
  'INTAKE',
  'PLANNING',
  'ARCHITECTURE',
  'DESIGN',
  'IMPLEMENTATION',
  'VERIFICATION',
  'RELEASE',
  'COMPLETED',
] as const;

export type Stage = typeof STAGES[number];

// Decision types
export type DecisionType = 'REVIEW' | 'APPROVAL' | 'SIGNOFF' | 'ESCALATION';

// Decision outcomes
export type Decision =
  | 'APPROVED'
  | 'CHANGES_REQUIRED'
  | 'REJECTED'
  | 'APPROVED_WITH_RISKS';

// Decision object schema (for AI agent responses)
export const decisionObjectSchema = z.object({
  workItemId: z.string(),
  stage: z.enum(STAGES),
  decisionType: z.enum(['REVIEW', 'APPROVAL', 'SIGNOFF', 'ESCALATION']),
  decision: z.enum(['APPROVED', 'CHANGES_REQUIRED', 'REJECTED', 'APPROVED_WITH_RISKS']),
  reviewerAgent: z.string(),
  timestamp: z.string(),
  domain: z.string(),
  iteration: z.number().optional().default(1),
  notes: z.string(),
  requiredChanges: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  artifactsReviewed: z.array(z.string()).optional(),
  blocksTransition: z.boolean().optional().default(false),
});

export type DecisionObject = z.infer<typeof decisionObjectSchema>;

// Work item status
export type WorkItemStatus =
  | 'ACTIVE'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED';

// Work item schema
export const workItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['ACTIVE', 'BLOCKED', 'COMPLETED', 'CANCELLED']),
  currentStage: z.enum(STAGES),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  createdBy: z.string().optional(),

  // Artifacts produced at each stage
  artifacts: z.record(z.string()).optional(),

  // Decisions made during the workflow
  decisions: z.array(decisionObjectSchema).optional(),

  // Current iteration count for rework loops
  iterationCount: z.number().optional().default(0),

  // Maximum iterations before escalation
  maxIterations: z.number().optional().default(3),

  // Pipeline type being used
  pipeline: z.string().optional(),

  // Complexity assessment
  complexity: z.enum(['simple', 'medium', 'complex']).optional(),
});

export type WorkItem = z.infer<typeof workItemSchema>;

// Ledger entry schema (audit trail)
export const ledgerEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  workItemId: z.string(),
  action: z.enum([
    'WORK_ITEM_CREATED',
    'STAGE_ENTERED',
    'STAGE_COMPLETED',
    'DECISION_MADE',
    'ARTIFACT_CREATED',
    'REWORK_TRIGGERED',
    'ESCALATION_TRIGGERED',
    'WORK_ITEM_COMPLETED',
    'WORK_ITEM_CANCELLED',
  ]),
  agent: z.string().optional(),
  stage: z.enum(STAGES).optional(),
  details: z.record(z.unknown()).optional(),
  decision: decisionObjectSchema.optional(),
});

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

// Stage configuration
export interface StageConfig {
  name: Stage;
  description: string;
  requiredArtifacts: string[];
  requiredReviews: { agent: string; domain: string }[];
  requiredApprovals: { agent: string; domain: string }[];
  signoffAgent: string;
}

// Approval matrix entry
export interface ApprovalMatrixEntry {
  stage: Stage;
  reviewers: string[];
  approvers: string[];
  signoff: string;
}

// Stage transition result
export interface TransitionResult {
  success: boolean;
  fromStage: Stage;
  toStage: Stage;
  blockers?: string[];
  missingArtifacts?: string[];
  missingApprovals?: string[];
}

// Rework request
export interface ReworkRequest {
  workItemId: string;
  stage: Stage;
  reason: string;
  requiredChanges: string[];
  requestedBy: string;
  iteration: number;
}

// Escalation request
export interface EscalationRequest {
  workItemId: string;
  stage: Stage;
  reason: string;
  stuckReviews: DecisionObject[];
  requestedBy: string;
  iteration: number;
}

// Stage definitions with required artifacts and approvals
export const STAGE_CONFIGS: Record<Stage, StageConfig> = {
  INTAKE: {
    name: 'INTAKE',
    description: 'Validate defect/feature, create story with acceptance criteria',
    requiredArtifacts: ['requirements.md'],
    requiredReviews: [{ agent: 'vaf-architect', domain: 'technical-feasibility' }],
    requiredApprovals: [{ agent: 'vaf-pm', domain: 'requirements' }],
    signoffAgent: 'vaf-orchestrator',
  },
  PLANNING: {
    name: 'PLANNING',
    description: 'Create PRD with scope, create architecture approach',
    requiredArtifacts: ['prd.md', 'architecture.md'],
    requiredReviews: [
      { agent: 'vaf-architect', domain: 'prd-technical' },
      { agent: 'vaf-ux', domain: 'prd-ux' },
    ],
    requiredApprovals: [
      { agent: 'vaf-pm', domain: 'prd' },
      { agent: 'vaf-architect', domain: 'architecture' },
    ],
    signoffAgent: 'vaf-orchestrator',
  },
  ARCHITECTURE: {
    name: 'ARCHITECTURE',
    description: 'Document technical implementation approach',
    requiredArtifacts: ['tech-spec.md'],
    requiredReviews: [
      { agent: 'vaf-pm', domain: 'alignment' },
      { agent: 'vaf-security-review', domain: 'security' },
    ],
    requiredApprovals: [{ agent: 'vaf-architect', domain: 'tech-spec' }],
    signoffAgent: 'vaf-orchestrator',
  },
  DESIGN: {
    name: 'DESIGN',
    description: 'Define UI/UX specifications',
    requiredArtifacts: ['design-spec.md'],
    requiredReviews: [
      { agent: 'vaf-frontend', domain: 'implementability' },
      { agent: 'vaf-ui', domain: 'design-system' },
    ],
    requiredApprovals: [{ agent: 'vaf-ux', domain: 'design' }],
    signoffAgent: 'vaf-orchestrator',
  },
  IMPLEMENTATION: {
    name: 'IMPLEMENTATION',
    description: 'Build the feature/fix following all specs',
    requiredArtifacts: ['implementation-log.md'],
    requiredReviews: [
      { agent: 'vaf-architect', domain: 'code-architecture' },
      { agent: 'vaf-security-review', domain: 'code-security' },
    ],
    requiredApprovals: [
      { agent: 'vaf-architect', domain: 'implementation' },
      { agent: 'vaf-pm', domain: 'requirements-met' },
    ],
    signoffAgent: 'vaf-orchestrator',
  },
  VERIFICATION: {
    name: 'VERIFICATION',
    description: 'Verify quality, run tests, validate acceptance criteria',
    requiredArtifacts: ['verification-report.md'],
    requiredReviews: [
      { agent: 'vaf-pm', domain: 'requirements-verification' },
      { agent: 'vaf-ux', domain: 'design-verification' },
    ],
    requiredApprovals: [
      { agent: 'vaf-qa', domain: 'quality' },
      { agent: 'vaf-pm', domain: 'acceptance' },
    ],
    signoffAgent: 'vaf-orchestrator',
  },
  RELEASE: {
    name: 'RELEASE',
    description: 'Prepare and document release',
    requiredArtifacts: ['release-notes.md'],
    requiredReviews: [{ agent: 'vaf-qa', domain: 'release-readiness' }],
    requiredApprovals: [
      { agent: 'vaf-devops', domain: 'deployment' },
      { agent: 'vaf-orchestrator', domain: 'final-signoff' },
    ],
    signoffAgent: 'vaf-orchestrator',
  },
  COMPLETED: {
    name: 'COMPLETED',
    description: 'Work item completed successfully',
    requiredArtifacts: [],
    requiredReviews: [],
    requiredApprovals: [],
    signoffAgent: 'vaf-orchestrator',
  },
};
