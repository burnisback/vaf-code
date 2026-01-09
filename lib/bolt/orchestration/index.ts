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
