/**
 * Product Definition (Client-Safe Exports)
 *
 * This module exports client-safe types and utilities.
 * Server-side code should import generatePRD from './generator' directly.
 *
 * NOTE: Do NOT import genkit here - this file is used by client components.
 */

// Re-export all types
export * from './types';

// Re-export client-safe utilities
export {
  exportPRDToMarkdown,
  getPRDFeatureStats,
  getPRDCompleteness,
  validatePRD,
} from './utils';

// NOTE: generatePRD and analyzeResearch are NOT exported here because they use genkit.
// Import them directly from './generator' or './analyzer' in server-side code only:
//   import { generatePRD } from '@/lib/bolt/product/generator';
//   import { analyzeResearch } from '@/lib/bolt/product/analyzer';
