/**
 * Google AI Mock Provider
 *
 * Mock implementation for @genkit-ai/googleai for testing.
 */

import { vi } from 'vitest';

/**
 * Mock model references
 */
export const gemini15Flash = {
  name: 'gemini-1.5-flash',
  __mock: true,
};

export const gemini15Flash8b = {
  name: 'gemini-1.5-flash-8b',
  __mock: true,
};

export const gemini15Pro = {
  name: 'gemini-1.5-pro',
  __mock: true,
};

export const gemini20FlashExp = {
  name: 'gemini-2.0-flash-exp',
  __mock: true,
};

/**
 * Mock Google AI plugin
 */
export const googleAI = vi.fn((config?: { apiKey?: string }) => {
  return {
    name: 'googleai',
    __mock: true,
    config,
  };
});

/**
 * Default export for module replacement
 */
export default {
  googleAI,
  gemini15Flash,
  gemini15Flash8b,
  gemini15Pro,
  gemini20FlashExp,
};
