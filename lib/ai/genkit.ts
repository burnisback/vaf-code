import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Genkit AI Configuration
 *
 * This configures the Genkit AI framework with the Google AI (Gemini) plugin.
 * The GEMINI_API_KEY environment variable must be set for this to work.
 *
 * Available models (2025):
 * - gemini-2.5-flash: Fast, efficient for most tasks (recommended)
 * - gemini-2.5-pro: Most capable, best for complex reasoning
 * - gemini-2.5-flash-lite: Lightweight version for simple tasks
 *
 * @see https://genkit.dev/docs/plugins/google-genai
 */
export const ai = genkit({
  plugins: [googleAI()],
});

// Re-export for convenience
export { googleAI };

// Model references using the new googleAI.model() approach
// This provides better type safety and automatic model discovery
export const MODELS = {
  // Fast and efficient - default for most tasks
  FLASH: googleAI.model('gemini-2.5-flash'),
  // Lightweight version for simple tasks
  FLASH_LITE: googleAI.model('gemini-2.5-flash-lite'),
  // Alias for FLASH_LITE (backward compatibility)
  FLASH_8B: googleAI.model('gemini-2.5-flash-lite'),
  // Most capable - for complex reasoning and planning
  PRO: googleAI.model('gemini-2.5-pro'),
} as const;

// Legacy aliases for backward compatibility
export const MODELS_LEGACY = {
  FLASH_8B: MODELS.FLASH_LITE,
  FLASH_EXP: MODELS.FLASH,
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];

// Alias exports for backward compatibility with governance modules
export const gemini15Flash = MODELS.FLASH;
export const gemini15Pro = MODELS.PRO;
export const gemini20Flash = MODELS.FLASH;
export const gemini20FlashExp = MODELS.FLASH;
