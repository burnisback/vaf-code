/**
 * Task Planner (Client-Safe Exports)
 *
 * This module exports client-safe types and utilities.
 * Server-side code should import generatePlan from './generator' directly.
 *
 * NOTE: Do NOT import genkit here - this file is used by client components.
 */

// Re-export all types
export * from './types';

// Re-export prompts (no genkit dependency)
export { PLANNING_SYSTEM_PROMPT, buildPlanningPrompt } from './prompts';

// Re-export client-safe utilities
export {
  validatePlan,
  getReadyTasks,
  getNextTask,
  getPlanComplexity,
  getPlanProgress,
  hasFailedTasks,
  isPlanComplete,
  isPlanBlocked,
  updateTaskStatus,
  getPlanSummary,
  estimateExecutionTime,
} from './utils';

// Re-export refiner (client-safe, calls API)
export {
  generateRefinement,
  areErrorsFixable,
  getIterationStatus,
  getRemainingAttempts,
  canStillRefine,
  MAX_ITERATIONS,
  type RefinementRequest,
  type RefinementResult,
} from './refiner';

// NOTE: generatePlan is NOT exported here because it uses genkit.
// Import it directly from './generator' in server-side code only:
//   import { generatePlan } from '@/lib/bolt/ai/planner/generator';
