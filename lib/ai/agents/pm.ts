import { MODELS } from '../genkit';
import { createAgent, type AgentConfig } from './base';
import { PM_PROMPT } from './prompts';
import { AgentRegistry } from './registry';

/**
 * PM Agent (vaf-pm)
 *
 * Product Manager agent responsible for:
 * - Capturing and clarifying requirements
 * - Creating PRDs with scope and acceptance criteria
 * - Verifying implementations meet requirements
 */

const pmConfig: AgentConfig = {
  name: 'vaf-pm',
  role: 'pm',
  description: 'Product Manager - transforms requirements into PRDs with scope, acceptance criteria, and risks',
  model: MODELS.FLASH,
  authorityLevel: 'lead',
  canApprove: ['requirements', 'prd', 'acceptance'],
  canReview: ['architecture', 'implementation', 'verification'],
  systemPrompt: PM_PROMPT,
  tools: ['fileWrite', 'fileRead', 'directoryList'],
};

// Create the agent
export const pmAgent = createAgent(pmConfig);

// Register with the global registry
AgentRegistry.register(pmAgent);

// Export config for introspection
export { pmConfig };
