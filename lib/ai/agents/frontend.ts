import { MODELS } from '../genkit';
import { createAgent, type AgentConfig } from './base';
import { FRONTEND_PROMPT } from './prompts';
import { AgentRegistry } from './registry';

/**
 * Frontend Agent (vaf-frontend)
 *
 * React+TypeScript Feature Engineer responsible for:
 * - Implementing pages and components
 * - State management with hooks/Zustand
 * - Writing unit tests
 */

const frontendConfig: AgentConfig = {
  name: 'vaf-frontend',
  role: 'frontend',
  description: 'React+TypeScript Feature Engineer - implements pages, components, and state management',
  model: MODELS.FLASH,
  authorityLevel: 'ic',
  canApprove: [], // IC cannot approve
  canReview: ['code', 'implementation', 'design'],
  systemPrompt: FRONTEND_PROMPT,
  tools: ['fileWrite', 'fileRead', 'directoryList', 'shellCommand'],
};

// Create the agent
export const frontendAgent = createAgent(frontendConfig);

// Register with the global registry
AgentRegistry.register(frontendAgent);

// Export config for introspection
export { frontendConfig };
