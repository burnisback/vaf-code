import { z } from 'genkit';
import { ai, MODELS } from '../genkit';

/**
 * Intent Classifier
 *
 * Classifies user intent to route to appropriate agents.
 */

// Intent types
export type Intent =
  | 'NEW_FEATURE'
  | 'BUG_FIX'
  | 'MODIFICATION'
  | 'QUESTION'
  | 'DEPLOYMENT'
  | 'DOCUMENTATION'
  | 'REFACTOR'
  | 'TEST'
  | 'UNKNOWN';

// Classification result schema
export const classificationResultSchema = z.object({
  intent: z.enum([
    'NEW_FEATURE',
    'BUG_FIX',
    'MODIFICATION',
    'QUESTION',
    'DEPLOYMENT',
    'DOCUMENTATION',
    'REFACTOR',
    'TEST',
    'UNKNOWN',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  suggestedAgents: z.array(z.string()),
  complexity: z.enum(['simple', 'medium', 'complex']),
});

export type ClassificationResult = z.infer<typeof classificationResultSchema>;

// Intent classification prompt
const CLASSIFIER_PROMPT = `You are an intent classifier for an AI coding assistant. Analyze the user's message and classify their intent.

## Intent Categories:
- NEW_FEATURE: User wants to add new functionality
- BUG_FIX: User is reporting a bug or error to fix
- MODIFICATION: User wants to change existing functionality
- QUESTION: User is asking a question (no code changes needed)
- DEPLOYMENT: User wants to deploy or release
- DOCUMENTATION: User wants to create/update docs
- REFACTOR: User wants to improve code without changing behavior
- TEST: User wants to add or fix tests
- UNKNOWN: Cannot determine intent

## Complexity Levels:
- simple: < 20 lines of code, 1 file, straightforward change
- medium: 20-100 lines, 2-5 files, requires some design
- complex: > 100 lines, 5+ files, requires architecture decisions

## Respond in JSON format:
{
  "intent": "INTENT_TYPE",
  "confidence": 0.0-1.0,
  "reasoning": "Why you classified it this way",
  "suggestedAgents": ["agent1", "agent2"],
  "complexity": "simple|medium|complex"
}`;

/**
 * Classify user intent from a message
 */
export async function classifyIntent(
  message: string,
  context?: {
    previousMessages?: string[];
    projectContext?: string;
  }
): Promise<ClassificationResult> {
  let prompt = CLASSIFIER_PROMPT + '\n\n';

  // Add context if available
  if (context?.projectContext) {
    prompt += `## Project Context:\n${context.projectContext}\n\n`;
  }

  if (context?.previousMessages && context.previousMessages.length > 0) {
    prompt += `## Recent Conversation:\n${context.previousMessages.slice(-3).join('\n')}\n\n`;
  }

  prompt += `## User Message:\n${message}\n\n## Classification:`;

  try {
    const response = await ai.generate({
      model: MODELS.FLASH_8B, // Fast, cheap model for classification
      prompt,
      config: {
        temperature: 0.3, // Lower temperature for more consistent classification
        maxOutputTokens: 500,
      },
    });

    const text = response.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return classificationResultSchema.parse(parsed);
    }

    // Fallback if JSON parsing fails
    return {
      intent: 'UNKNOWN',
      confidence: 0.5,
      reasoning: 'Could not parse classification response',
      suggestedAgents: ['vaf-pm'],
      complexity: 'medium',
    };
  } catch (error) {
    console.error('[Classifier] Error:', error);

    // Return sensible default on error
    return {
      intent: 'UNKNOWN',
      confidence: 0.3,
      reasoning: `Classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestedAgents: ['vaf-pm'],
      complexity: 'medium',
    };
  }
}

/**
 * Quick intent check without full classification
 */
export function quickIntentCheck(message: string): Intent {
  const lowerMessage = message.toLowerCase();

  // Bug-related keywords
  if (
    lowerMessage.includes('bug') ||
    lowerMessage.includes('error') ||
    lowerMessage.includes('fix') ||
    lowerMessage.includes('broken') ||
    lowerMessage.includes('not working') ||
    lowerMessage.includes('crash')
  ) {
    return 'BUG_FIX';
  }

  // Question keywords
  if (
    lowerMessage.startsWith('what') ||
    lowerMessage.startsWith('how') ||
    lowerMessage.startsWith('why') ||
    lowerMessage.startsWith('where') ||
    lowerMessage.startsWith('can you explain') ||
    lowerMessage.includes('?')
  ) {
    return 'QUESTION';
  }

  // New feature keywords
  if (
    lowerMessage.includes('add') ||
    lowerMessage.includes('create') ||
    lowerMessage.includes('build') ||
    lowerMessage.includes('implement') ||
    lowerMessage.includes('new')
  ) {
    return 'NEW_FEATURE';
  }

  // Modification keywords
  if (
    lowerMessage.includes('change') ||
    lowerMessage.includes('update') ||
    lowerMessage.includes('modify') ||
    lowerMessage.includes('edit')
  ) {
    return 'MODIFICATION';
  }

  // Deployment keywords
  if (
    lowerMessage.includes('deploy') ||
    lowerMessage.includes('release') ||
    lowerMessage.includes('publish') ||
    lowerMessage.includes('ship')
  ) {
    return 'DEPLOYMENT';
  }

  // Refactor keywords
  if (
    lowerMessage.includes('refactor') ||
    lowerMessage.includes('clean up') ||
    lowerMessage.includes('optimize') ||
    lowerMessage.includes('improve')
  ) {
    return 'REFACTOR';
  }

  // Test keywords
  if (
    lowerMessage.includes('test') ||
    lowerMessage.includes('spec') ||
    lowerMessage.includes('coverage')
  ) {
    return 'TEST';
  }

  // Documentation keywords
  if (
    lowerMessage.includes('document') ||
    lowerMessage.includes('readme') ||
    lowerMessage.includes('docs')
  ) {
    return 'DOCUMENTATION';
  }

  return 'UNKNOWN';
}
