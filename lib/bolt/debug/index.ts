/**
 * Debug Module Exports
 *
 * Provides error handling, debugging, and runtime error capture utilities.
 */

export {
  ERROR_HANDLER_SCRIPT,
  REACT_ERROR_BOUNDARY_SOURCE,
  generateIndexHtml,
  generateMainJsx,
  generateMainTsx,
} from './error-handler';

export {
  buildDebugAnalysisPrompt,
  buildContextAwareDebugPrompt,
  DEBUG_SYSTEM_PROMPT,
  extractRelevantPaths,
  detectProjectPatterns,
} from './prompts';
