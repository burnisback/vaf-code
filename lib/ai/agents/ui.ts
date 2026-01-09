import { MODELS } from '../genkit';
import { createAgent, type AgentConfig } from './base';
import { UI_PROMPT } from './prompts';
import { AgentRegistry } from './registry';

/**
 * UI Agent (vaf-ui)
 *
 * UI Engineer responsible for:
 * - Design system conventions
 * - Tailwind tokens
 * - Component APIs and styling
 */

const uiConfig: AgentConfig = {
  name: 'vaf-ui',
  role: 'ui',
  description: 'UI Engineer - designs and implements design system conventions, Tailwind tokens, and component APIs',
  model: MODELS.FLASH,
  authorityLevel: 'ic',
  canApprove: [], // IC cannot approve
  canReview: ['design', 'ui', 'accessibility', 'implementation'],
  systemPrompt: UI_PROMPT,
  tools: ['fileWrite', 'fileRead', 'directoryList'],
};

// Create the agent
export const uiAgent = createAgent(uiConfig);

// Register with the global registry
AgentRegistry.register(uiAgent);

// Export config for introspection
export { uiConfig };
