import { MODELS } from '../genkit';
import { createAgent, type AgentConfig } from './base';
import { UX_PROMPT } from './prompts';
import { AgentRegistry } from './registry';

/**
 * UX Agent (vaf-ux)
 *
 * UX Lead agent responsible for:
 * - Designing user journeys and flows
 * - Ensuring accessibility compliance
 * - Creating design specifications
 */

const uxConfig: AgentConfig = {
  name: 'vaf-ux',
  role: 'ux',
  description: 'UX Lead - user journeys, information architecture, accessibility, UI copy',
  model: MODELS.FLASH,
  authorityLevel: 'lead',
  canApprove: ['design', 'ux', 'accessibility'],
  canReview: ['requirements', 'prd', 'implementation', 'ui'],
  systemPrompt: UX_PROMPT,
  tools: ['fileWrite', 'fileRead'],
};

// Create the agent
export const uxAgent = createAgent(uxConfig);

// Register with the global registry
AgentRegistry.register(uxAgent);

// Export config for introspection
export { uxConfig };
