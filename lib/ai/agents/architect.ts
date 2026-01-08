import { MODELS } from '../genkit';
import { createAgent, type AgentConfig } from './base';
import { ARCHITECT_PROMPT } from './prompts';
import { AgentRegistry } from './registry';

/**
 * Architect Agent (vaf-architect)
 *
 * Solution Architect agent responsible for:
 * - Designing technical solutions
 * - Creating architecture documents and tech specs
 * - Reviewing code for architectural compliance
 */

const architectConfig: AgentConfig = {
  name: 'vaf-architect',
  role: 'architect',
  description: 'Solution Architect - designs patterns, module boundaries, data flows',
  model: MODELS.PRO, // Uses Pro for complex reasoning
  authorityLevel: 'lead',
  canApprove: ['architecture', 'tech-spec', 'implementation'],
  canReview: ['requirements', 'prd', 'code', 'security'],
  systemPrompt: ARCHITECT_PROMPT,
  tools: ['fileWrite', 'fileRead', 'directoryList', 'shellCommand'],
};

// Create the agent
export const architectAgent = createAgent(architectConfig);

// Register with the global registry
AgentRegistry.register(architectAgent);

// Export config for introspection
export { architectConfig };
