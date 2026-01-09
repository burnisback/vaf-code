/**
 * Research Module Exports
 *
 * Web research capabilities for the Bolt Playground.
 */

// Types
export * from './types';

// Client
export { ResearchClient, getResearchClient } from './client';

// Utilities
export {
  generateSearchQueries,
  mergeSearchResults,
  summarizeContent,
  calculateRelevance,
  formatContentForAI,
  filterByRelevance,
  groupByDomain,
  extractDomains,
  isProductPage,
  isComparisonPage,
} from './client';

// Planner
export { planResearch, generateQuickPlan } from './planner';
export type { ResearchPlanningRequest, ResearchPlanningResult } from './planner';

// Executor
export { ResearchExecutor, createResearchExecutor } from './executor';
export type { ExecutionCallbacks, ExecutionProgress, ExecutionResult } from './executor';

// Synthesizer
export { synthesizeResearch, generateSynthesisReport } from './synthesizer';
export type { SynthesisRequest, SynthesisResult } from './synthesizer';
