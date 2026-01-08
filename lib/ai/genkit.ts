import { genkit } from 'genkit';
import { googleAI, gemini20Flash, gemini20FlashExp, gemini15Pro } from '@genkit-ai/googleai';

/**
 * Genkit AI Configuration
 *
 * This configures the Genkit AI framework with the Google AI (Gemini) plugin.
 * The GEMINI_API_KEY environment variable must be set for this to work.
 *
 * Available models:
 * - gemini-2.0-flash: Fast, efficient for most tasks (recommended)
 * - gemini-2.0-flash-exp: Latest experimental model
 * - gemini-1.5-pro: Most capable, best for complex reasoning
 */
export const ai = genkit({
  plugins: [googleAI()],
});

// Re-export for convenience
export { googleAI };

// Model references from @genkit-ai/googleai
export const MODELS = {
  // Fast and efficient - default for most tasks
  FLASH: gemini20Flash,
  // Lightweight version for simple tasks (alias to FLASH)
  FLASH_8B: gemini20Flash,
  // Experimental - latest features
  FLASH_EXP: gemini20FlashExp,
  // Most capable - for complex reasoning and planning
  PRO: gemini15Pro,
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];

// Alias exports for backward compatibility with governance modules
export const gemini15Flash = gemini20Flash; // Map old name to new model
export { gemini15Pro };
