/**
 * Agents Index
 *
 * Central export for all agent infrastructure and implementations.
 */

// Base infrastructure
export {
  type AgentRole,
  type AuthorityLevel,
  type AgentConfig,
  type AgentInput,
  type AgentOutput,
  type Agent,
  agentInputSchema,
  agentOutputSchema,
  createAgentFlow,
  createAgent,
} from './base';

// Note: DecisionType and Decision types are exported from governance/types

// Registry
export { AgentRegistry, AgentRegistryClass } from './registry';

// System prompts
export { AGENT_PROMPTS } from './prompts';

// Executive agents
export { orchestratorAgent, orchestratorConfig } from './orchestrator';

// Planning agents
export { pmAgent, pmConfig } from './pm';
export { architectAgent, architectConfig } from './architect';
export { uxAgent, uxConfig } from './ux';
export { researcherAgent, researcherConfig } from './researcher';

// Implementation agents
export { frontendAgent, frontendConfig } from './frontend';
export { backendAgent, backendConfig } from './backend';
export { uiAgent, uiConfig } from './ui';
export { testRunnerAgent, testRunnerConfig } from './testRunner';

// New combined agents (VAF AI System Phase 3)
export { designAgent, DesignAgent, DESIGN_AGENT_CONFIG } from './design';
export { engineerAgent, EngineerAgent, ENGINEER_AGENT_CONFIG } from './engineer';
export { qaAgent, QAAgent, QA_AGENT_CONFIG } from './qa';
