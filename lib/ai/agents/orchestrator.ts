import { MODELS } from '../genkit';
import { createAgent, type AgentConfig } from './base';
import { ORCHESTRATOR_PROMPT } from './prompts';
import { AgentRegistry } from './registry';

/**
 * Orchestrator Agent (vaf-orchestrator)
 *
 * Factory CEO - the executive decision-maker:
 * - Coordinates all agents
 * - Makes executive decisions
 * - Final sign-offs on all stages
 * - Resolves conflicts and escalations
 */

const orchestratorConfig: AgentConfig = {
  name: 'vaf-orchestrator',
  role: 'orchestrator',
  description: 'Factory CEO - decomposes work, delegates to agents, enforces quality gates, provides final sign-off',
  model: MODELS.PRO, // Uses Pro for complex executive reasoning
  authorityLevel: 'executive',
  canApprove: ['*'], // Can approve everything
  canReview: ['*'], // Can review everything
  systemPrompt: ORCHESTRATOR_PROMPT,
  tools: ['fileWrite', 'fileRead', 'directoryList', 'shellCommand'],
};

// Create the agent
export const orchestratorAgent = createAgent(orchestratorConfig);

// Register with the global registry
AgentRegistry.register(orchestratorAgent);

// Export config for introspection
export { orchestratorConfig };
