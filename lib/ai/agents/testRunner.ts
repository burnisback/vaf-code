import { MODELS } from '../genkit';
import { createAgent, type AgentConfig } from './base';
import { TEST_RUNNER_PROMPT } from './prompts';
import { AgentRegistry } from './registry';

/**
 * Test Runner Agent (vaf-test-runner)
 *
 * Build/Lint/Test Executor responsible for:
 * - Running quality gates
 * - Functional verification
 * - Reporting results
 */

const testRunnerConfig: AgentConfig = {
  name: 'vaf-test-runner',
  role: 'test-runner',
  description: 'Build/Lint/Test Executor - runs quality gates AND functional verification',
  model: MODELS.FLASH_8B, // Fast, cheap model for execution tasks
  authorityLevel: 'ic',
  canApprove: [], // IC cannot approve
  canReview: ['quality', 'tests', 'build'],
  systemPrompt: TEST_RUNNER_PROMPT,
  tools: ['fileRead', 'directoryList', 'shellCommand'],
};

// Create the agent
export const testRunnerAgent = createAgent(testRunnerConfig);

// Register with the global registry
AgentRegistry.register(testRunnerAgent);

// Export config for introspection
export { testRunnerConfig };
