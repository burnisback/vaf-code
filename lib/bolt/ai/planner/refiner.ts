/**
 * Plan Refiner (Client-Side)
 *
 * Client-side module for generating refinement plans to fix errors.
 * Calls the server-side API to keep Genkit dependencies server-only.
 */

import type { TaskPlan } from './types';
import type { VerificationResult } from '../../execution/verifier';

// =============================================================================
// TYPES
// =============================================================================

export interface RefinementRequest {
  /** Original plan that was executed */
  originalPlan: TaskPlan;

  /** Verification result with errors */
  verificationResult: VerificationResult;

  /** Current project context */
  projectContext: {
    fileTree: string;
    framework: string;
    styling: string;
    language?: {
      primary: 'typescript' | 'javascript';
      hasTypeScript: boolean;
      hasJavaScript: boolean;
      hasTsConfig: boolean;
      fileExtensions: {
        components: '.tsx' | '.jsx';
        modules: '.ts' | '.js';
      };
    };
  };

  /** Current iteration number */
  iteration: number;
}

export interface RefinementResult {
  /** Whether refinement is possible */
  canRefine: boolean;

  /** Refined plan (if canRefine is true) */
  plan?: TaskPlan;

  /** Explanation of refinement approach */
  reasoning: string;

  /** Whether to abort further refinement attempts */
  shouldAbort: boolean;

  /** Reason for aborting (if shouldAbort is true) */
  abortReason?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const MAX_ITERATIONS = 3;

// =============================================================================
// REFINER FUNCTION
// =============================================================================

/**
 * Generate a refinement plan to fix errors
 * Calls the server-side API to generate the plan
 */
export async function generateRefinement(
  request: RefinementRequest
): Promise<RefinementResult> {
  const { originalPlan, verificationResult, projectContext, iteration } = request;

  // Check iteration limit client-side too
  if (iteration >= MAX_ITERATIONS) {
    return {
      canRefine: false,
      shouldAbort: true,
      abortReason: `Maximum refinement iterations (${MAX_ITERATIONS}) reached. Manual intervention required.`,
      reasoning: 'Iteration limit exceeded.',
    };
  }

  // Check if there are actually errors to fix
  const totalErrors =
    verificationResult.typeErrors.length +
    verificationResult.moduleErrors.length +
    verificationResult.runtimeErrors.length;

  if (totalErrors === 0) {
    return {
      canRefine: false,
      shouldAbort: false,
      reasoning: 'No errors to fix.',
    };
  }

  try {
    const response = await fetch('/api/bolt-refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalPlan,
        verificationResult,
        projectContext,
        iteration,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Refinement generation failed');
    }

    return await response.json() as RefinementResult;
  } catch (error) {
    return {
      canRefine: false,
      shouldAbort: true,
      abortReason: `Refinement generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      reasoning: 'Error during refinement generation.',
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if errors are likely fixable by AI
 */
export function areErrorsFixable(result: VerificationResult): boolean {
  // Module errors are usually fixable (install or import fix)
  if (result.moduleErrors.length > 0) return true;

  // Type errors are often fixable
  if (result.typeErrors.length > 0) return true;

  // Some runtime errors may not be fixable without context
  if (result.runtimeErrors.length > 0) {
    // Check if they're simple errors
    const simpleErrors = result.runtimeErrors.filter(e =>
      e.message.includes('is not defined') ||
      e.message.includes('is not a function') ||
      e.message.includes('Cannot read')
    );
    return simpleErrors.length > 0;
  }

  return false;
}

/**
 * Get human-readable iteration status
 */
export function getIterationStatus(iteration: number): string {
  if (iteration === 0) return 'Initial execution';
  if (iteration >= MAX_ITERATIONS) return `Final attempt (${iteration}/${MAX_ITERATIONS})`;
  return `Refinement ${iteration} of ${MAX_ITERATIONS}`;
}

/**
 * Get remaining refinement attempts
 */
export function getRemainingAttempts(iteration: number): number {
  return Math.max(0, MAX_ITERATIONS - iteration);
}

/**
 * Check if refinement is still possible
 */
export function canStillRefine(iteration: number): boolean {
  return iteration < MAX_ITERATIONS;
}
