import { MODELS } from '../genkit';
import { createAgent, type AgentConfig } from './base';
import { RESEARCHER_PROMPT } from './prompts';
import { AgentRegistry } from './registry';

/**
 * Researcher Agent (vaf-researcher)
 *
 * Fast read-only agent for codebase exploration:
 * - Quick pattern finding
 * - Code flow tracing
 * - Dependency mapping
 */

const researcherConfig: AgentConfig = {
  name: 'vaf-researcher',
  role: 'researcher',
  description: 'Fast Repo Spelunker - finds patterns, files, code flows. Returns pointers, never edits.',
  model: MODELS.FLASH_8B, // Fastest, cheapest model for read-only tasks
  authorityLevel: 'support',
  canApprove: [], // Cannot approve anything
  canReview: [], // Cannot review anything
  systemPrompt: RESEARCHER_PROMPT,
  tools: ['fileRead', 'directoryList'], // Read-only tools
};

// Create the agent
export const researcherAgent = createAgent(researcherConfig);

// Register with the global registry
AgentRegistry.register(researcherAgent);

// Export config for introspection
export { researcherConfig };
