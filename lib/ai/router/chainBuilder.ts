import type { AgentRole } from '../agents/base';
import type { Intent } from './classifier';
import type { PipelineType } from './complexity';

/**
 * Agent Chain Builder
 *
 * Builds execution chains of agents based on intent and complexity.
 */

export interface AgentChainStep {
  agent: AgentRole;
  action: 'author' | 'review' | 'approve' | 'execute';
  required: boolean;
  parallel?: boolean; // Can run in parallel with next step
}

export interface AgentChain {
  steps: AgentChainStep[];
  pipeline: PipelineType;
  intent: Intent;
}

/**
 * Get the agent chain for a given intent and pipeline
 */
export function buildAgentChain(
  intent: Intent,
  pipeline: PipelineType
): AgentChain {
  const steps: AgentChainStep[] = [];

  // Intake phase - PM captures requirements
  if (pipelineHasStage(pipeline, 'INTAKE')) {
    steps.push({
      agent: 'pm',
      action: 'author',
      required: true,
    });
  }

  // Planning phase
  if (pipelineHasStage(pipeline, 'PLANNING')) {
    steps.push(
      {
        agent: 'pm',
        action: 'author', // PRD
        required: true,
        parallel: true,
      },
      {
        agent: 'architect',
        action: 'author', // Architecture notes
        required: true,
      },
      {
        agent: 'architect',
        action: 'review', // Review PRD
        required: true,
      },
      {
        agent: 'pm',
        action: 'approve', // Approve PRD
        required: true,
      }
    );
  }

  // Architecture phase
  if (pipelineHasStage(pipeline, 'ARCHITECTURE')) {
    steps.push(
      {
        agent: 'architect',
        action: 'author', // Tech spec
        required: true,
      },
      {
        agent: 'security',
        action: 'review',
        required: pipeline === 'FULL_GOVERNANCE',
      },
      {
        agent: 'architect',
        action: 'approve',
        required: true,
      }
    );
  }

  // Design phase
  if (pipelineHasStage(pipeline, 'DESIGN')) {
    steps.push(
      {
        agent: 'ux',
        action: 'author', // Design spec
        required: true,
      },
      {
        agent: 'ui',
        action: 'review',
        required: true,
      },
      {
        agent: 'ux',
        action: 'approve',
        required: true,
      }
    );
  }

  // Implementation phase
  if (pipelineHasStage(pipeline, 'IMPLEMENTATION')) {
    // Choose implementation agents based on intent
    const implAgents = getImplementationAgents(intent);

    for (const agent of implAgents) {
      steps.push({
        agent,
        action: 'execute',
        required: true,
        parallel: implAgents.indexOf(agent) < implAgents.length - 1,
      });
    }

    // Architecture review of implementation
    steps.push({
      agent: 'architect',
      action: 'review',
      required: true,
    });

    // Security review for sensitive changes
    if (pipeline === 'FULL_GOVERNANCE') {
      steps.push({
        agent: 'security',
        action: 'review',
        required: true,
      });
    }

    steps.push({
      agent: 'architect',
      action: 'approve',
      required: true,
    });
  }

  // Verification phase
  if (pipelineHasStage(pipeline, 'VERIFICATION')) {
    steps.push(
      {
        agent: 'test-runner',
        action: 'execute', // Run tests
        required: true,
      },
      {
        agent: 'qa',
        action: 'review', // Verify acceptance criteria
        required: true,
      },
      {
        agent: 'qa',
        action: 'approve',
        required: true,
      }
    );
  }

  // Release phase
  if (pipelineHasStage(pipeline, 'RELEASE')) {
    steps.push(
      {
        agent: 'devops',
        action: 'author', // Release notes
        required: true,
      },
      {
        agent: 'devops',
        action: 'approve',
        required: true,
      },
      {
        agent: 'orchestrator',
        action: 'approve', // CEO final sign-off
        required: true,
      }
    );
  }

  return {
    steps,
    pipeline,
    intent,
  };
}

/**
 * Check if a pipeline includes a specific stage
 */
function pipelineHasStage(pipeline: PipelineType, stage: string): boolean {
  const stageMap: Record<PipelineType, string[]> = {
    FAST_TRACK: ['INTAKE', 'IMPLEMENTATION', 'VERIFICATION'],
    UI_FAST_TRACK: ['INTAKE', 'DESIGN', 'IMPLEMENTATION', 'VERIFICATION', 'RELEASE'],
    BUG_FIX: ['INTAKE', 'ARCHITECTURE', 'IMPLEMENTATION', 'VERIFICATION', 'RELEASE'],
    STANDARD: ['INTAKE', 'PLANNING', 'ARCHITECTURE', 'DESIGN', 'IMPLEMENTATION', 'VERIFICATION', 'RELEASE'],
    FULL_GOVERNANCE: ['INTAKE', 'PLANNING', 'ARCHITECTURE', 'DESIGN', 'IMPLEMENTATION', 'VERIFICATION', 'RELEASE'],
  };

  return stageMap[pipeline]?.includes(stage) ?? false;
}

/**
 * Get implementation agents based on intent
 */
function getImplementationAgents(intent: Intent): AgentRole[] {
  switch (intent) {
    case 'NEW_FEATURE':
      return ['frontend', 'backend'];

    case 'BUG_FIX':
      return ['frontend']; // Start with frontend, may add backend

    case 'MODIFICATION':
      return ['frontend'];

    case 'DOCUMENTATION':
      return ['docs' as AgentRole];

    case 'TEST':
      return ['test-runner'];

    case 'DEPLOYMENT':
      return ['devops'];

    case 'REFACTOR':
      return ['frontend', 'backend'];

    default:
      return ['frontend'];
  }
}

/**
 * Get agents that can run in parallel at each step
 */
export function getParallelGroups(chain: AgentChain): AgentChainStep[][] {
  const groups: AgentChainStep[][] = [];
  let currentGroup: AgentChainStep[] = [];

  for (const step of chain.steps) {
    currentGroup.push(step);

    if (!step.parallel) {
      groups.push(currentGroup);
      currentGroup = [];
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Estimate the number of agent invocations for a chain
 */
export function countInvocations(chain: AgentChain): number {
  return chain.steps.filter(s => s.required).length;
}
