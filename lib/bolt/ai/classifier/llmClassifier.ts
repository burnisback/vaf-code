/**
 * LLM-Based Request Classifier (Client-Side)
 *
 * Calls the server-side /api/bolt-classify endpoint for LLM classification.
 * This keeps Node.js-specific dependencies (genkit, OpenTelemetry) on the server.
 *
 * The server uses the AI model to classify requests, providing much more accurate
 * classification than keyword-based approaches. The model understands:
 * - Semantic meaning and synonyms
 * - Implicit complexity (e.g., "validation" implies multiple concerns)
 * - Context and relationships between requirements
 * - Industry terminology and patterns
 *
 * Falls back to keyword-based classification if the API fails or times out.
 */

import type {
  ClassificationResult,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

interface LLMClassifierOptions {
  /** Timeout in milliseconds (default: 3000) */
  timeout?: number;
  /** Whether to log classification details (default: false) */
  debug?: boolean;
}

interface ClassifyAPIResponse {
  result: ClassificationResult | null;
  usedLLM: boolean;
}

// =============================================================================
// LLM CLASSIFIER
// =============================================================================

/**
 * Classify a request using the LLM via server-side API
 * Returns null if classification fails (caller should fall back to keywords)
 */
export async function classifyWithLLM(
  prompt: string,
  options: LLMClassifierOptions = {}
): Promise<ClassificationResult | null> {
  const { timeout = 3000, debug = false } = options;

  try {
    if (debug) {
      console.log('[LLM Classifier] Classifying prompt:', prompt.slice(0, 100));
    }

    // Create a timeout promise to race against the API call
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        if (debug) {
          console.log('[LLM Classifier] Client-side timeout triggered');
        }
        resolve(null);
      }, timeout + 1000); // Add 1s buffer for network latency
    });

    // Call the server-side API
    const fetchPromise = fetch('/api/bolt-classify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        timeout,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        console.warn('[LLM Classifier] API returned error:', response.status);
        return null;
      }
      const data = await response.json() as ClassifyAPIResponse;
      return data;
    }).catch((error) => {
      console.warn('[LLM Classifier] API call failed:', error);
      return null;
    });

    // Race the API call against the timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (response === null) {
      console.warn('[LLM Classifier] Classification timed out, falling back to keywords');
      return null;
    }

    if (!response.result) {
      if (debug) {
        console.log('[LLM Classifier] API returned no result, falling back to keywords');
      }
      return null;
    }

    if (debug) {
      console.log('[LLM Classifier] Classification result:', response.result);
      console.log('[LLM Classifier] Used LLM:', response.usedLLM);
    }

    return response.result;

  } catch (error) {
    // Log but don't throw - caller will fall back to keyword classifier
    console.warn('[LLM Classifier] Classification failed:', error);
    return null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { LLMClassifierOptions };
