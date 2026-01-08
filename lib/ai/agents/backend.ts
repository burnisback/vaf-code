import { MODELS } from '../genkit';
import { createAgent, type AgentConfig } from './base';
import { BACKEND_PROMPT } from './prompts';
import { AgentRegistry } from './registry';

/**
 * Backend Agent (vaf-backend)
 *
 * API/Backend Engineer responsible for:
 * - Implementing API routes and server actions
 * - Persistence and data modeling
 * - Auth boundaries
 */

const backendConfig: AgentConfig = {
  name: 'vaf-backend',
  role: 'backend',
  description: 'API/Backend Engineer - implements API routes, server actions, persistence, and auth boundaries',
  model: MODELS.FLASH,
  authorityLevel: 'ic',
  canApprove: [], // IC cannot approve
  canReview: ['code', 'implementation', 'api', 'security'],
  systemPrompt: BACKEND_PROMPT,
  tools: ['fileWrite', 'fileRead', 'directoryList', 'shellCommand'],
};

// Create the agent
export const backendAgent = createAgent(backendConfig);

// Register with the global registry
AgentRegistry.register(backendAgent);

// Export config for introspection
export { backendConfig };
