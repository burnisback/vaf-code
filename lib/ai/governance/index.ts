/**
 * Governance Module Index
 *
 * Central export for all governance components.
 */

// Types
export * from './types';

// Decision system
export {
  createDecision,
  validateDecision,
  serializeDecision,
  parseDecision,
  blocksTransition,
  createApproval,
  createReview,
  createSignoff,
  createEscalation,
  hasRequiredApprovals,
  hasRequiredReviews,
  type CreateDecisionParams,
  type ValidationResult,
} from './decision';

// Ledger
export {
  Ledger,
  governanceLedger,
  createLedgerEntry,
  serializeLedgerEntry,
  parseLedgerEntry,
  type LedgerAction,
} from './ledger';

// Work item management
export {
  WorkItemManager,
  workItemManager,
  type CreateWorkItemParams,
} from './workItem';

// Reviewer base
export {
  ReviewerAgent,
  createReviewerFlow,
  quickReview,
  type ReviewRequest,
  type ReviewResult,
  type ReviewerConfig,
} from './reviewer';

// Reviewers
export * from './reviewers';

// Stage management
export {
  getStageMetadata,
  getAllStagesMetadata,
  getNextStage,
  getPreviousStage,
  isStageBefore,
  isStageAfter,
  getStagesBetween,
  getRequiredArtifacts,
  getRequiredReviews,
  getRequiredApprovals,
  getSignoffAgent,
  getStageCompletionRequirements,
  getPipelineConfig,
  isStageInPipeline,
  getPipelineStages,
  getStageDisplayInfo,
  getStageProgress,
  PIPELINE_CONFIGS,
  type StageMetadata,
  type StageCompletionRequirements,
  type PipelineConfig,
  type StageDisplayInfo,
} from './stages';

// Approval collection
export {
  ApprovalCollector,
  approvalCollector,
  type ApprovalRequest,
  type ApprovalResult,
  type StageApprovalStatus,
} from './approvals';

// Stage transitions
export {
  TransitionManager,
  transitionManager,
  type TransitionValidation,
} from './transitions';

// Escalation handling
export {
  EscalationHandler,
  escalationHandler,
  escalateManually,
  type EscalationReason,
  type EscalationStatus,
  type EscalationRecord,
} from './escalation';

// Pipeline execution
export {
  PipelineExecutor,
  pipelineExecutor,
  runPipeline,
  type PipelineExecutionOptions,
  type PipelineExecutionResult,
  type StageExecutionResult,
} from './executor';

// Artifact management
export {
  ArtifactManager,
  artifactManager,
  artifactSchema,
  type ArtifactType,
  type ArtifactMetadata,
  type Artifact,
} from './artifacts';
