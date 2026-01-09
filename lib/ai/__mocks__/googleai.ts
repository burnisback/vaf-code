/**
 * Google AI Mock Provider
 *
 * Mock implementation for @genkit-ai/google-genai for testing.
 */

import { vi } from 'vitest';

/**
 * Mock model function that mimics googleAI.model()
 */
const mockModel = vi.fn((name: string) => ({
  name,
  __mock: true,
}));

/**
 * Mock Google AI plugin with model() method
 */
export const googleAI = Object.assign(
  vi.fn((config?: { apiKey?: string }) => {
    return {
      name: 'googleai',
      __mock: true,
      config,
    };
  }),
  {
    model: mockModel,
  }
);

/**
 * Legacy mock model references for backward compatibility
 */
export const gemini15Flash = mockModel('gemini-1.5-flash');
export const gemini15Pro = mockModel('gemini-1.5-pro');
export const gemini20Flash = mockModel('gemini-2.0-flash');
export const gemini20FlashExp = mockModel('gemini-2.0-flash-exp');
export const gemini25Flash = mockModel('gemini-2.5-flash');
export const gemini25Pro = mockModel('gemini-2.5-pro');

/**
 * Default export for module replacement
 */
export default {
  googleAI,
  gemini15Flash,
  gemini15Pro,
  gemini20Flash,
  gemini20FlashExp,
  gemini25Flash,
  gemini25Pro,
};
