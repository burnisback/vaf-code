/**
 * Debugging Module
 *
 * Exports for the debugging pipeline that handles
 * error collection, analysis, root cause identification, and fixes.
 */

// Types
export * from './types';

// Error Collection
export {
  collectBuildErrors,
  collectTypeErrors,
  collectRuntimeErrors,
  collectLintErrors,
  createErrorCollection,
  mergeCollections,
  parseFileLocation,
  parseErrorCode,
  determineErrorType,
} from './errorCollector';

// Error Analysis
export {
  groupErrorsByFile,
  detectCascades,
  identifyRootCauseCandidates,
  prioritizeErrors,
  analyzeErrors,
} from './errorAnalyzer';

// Root Cause Identification
export {
  identifyRootCause,
  validateRootCause,
  getCodeContext,
} from './rootCauseIdentifier';

// Fix Planning
export {
  planFix,
  validateFixPlan,
} from './fixPlanner';

// Debug Pipeline
export {
  runDebugPipeline,
  analyzeErrorsQuick,
  type DebugPipelineCallback,
} from './debugPipeline';
