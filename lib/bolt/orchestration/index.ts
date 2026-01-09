/**
 * Orchestration Module (Client-Safe Exports)
 *
 * Multi-phase project orchestration with state machine management.
 *
 * NOTE: The OrchestrationRunner is NOT exported here because it uses
 * server-side dependencies. Import it directly in server code:
 *   import { OrchestrationRunner, createOrchestrationRunner } from '@/lib/bolt/orchestration/runner';
 *
 * @example
 * ```ts
 * import {
 *   createOrchestrator,
 *   getStateDescription,
 *   type OrchestrationState,
 *   type OrchestrationContext,
 * } from '@/lib/bolt/orchestration';
 *
 * const orchestrator = createOrchestrator({ originalPrompt: 'Build an LMS' });
 * orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Build an LMS' } });
 * ```
 */

// Types
export type {
  OrchestrationState,
  OrchestrationEvent,
  OrchestrationContext,
  CheckpointData,
  Orchestrator,
  ExecutionProgress,
  OrchestrationCallbacks,
  MegaProject,
  RunnerConfig,
  RunnerCallbacks,
} from './types';

// State machine (client-safe)
export {
  createOrchestrator,
  getStateDescription,
  isTerminalState,
  allowsUserIntervention,
  getApprovalType,
} from './machine';

// Cost tracking (client-safe)
export {
  CostTracker,
  createCostTracker,
  formatCost,
  formatTokens,
  getCostSummary,
  MODEL_COSTS,
} from './costTracker';
export type {
  TokenUsage,
  CostStatistics,
  BudgetWarning,
  CostTrackerCallbacks,
} from './costTracker';

// Approval management (client-safe)
export {
  ApprovalManager,
  createApprovalManager,
  getApprovalTypeTitle,
  getApprovalTypeDescription,
  formatDecisionTime,
} from './approvalManager';
export type {
  ApprovalType,
  ApprovalStatus,
  ApprovalRequest,
  ApprovalManagerCallbacks,
  ApprovalManagerConfig,
  ApprovalResult,
} from './approvalManager';
