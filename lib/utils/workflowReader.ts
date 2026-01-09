import type {
  WorkItem,
  PipelineEvent,
  Stage,
  StageState,
  AgentExecution,
} from '@/lib/types/workflow';
import { getStageStatus, STAGE_CONFIG } from '@/lib/types/workflow';

// API endpoint for workflow data
const WORKFLOW_API = '/api/workflow';

// Track if we've already logged the "no workflow" message to avoid spam
let hasLoggedNoWorkflow = false;

/**
 * Fetch workflow data from the API route
 * This reads files server-side to avoid browser filesystem access issues
 */
async function fetchWorkflowData(): Promise<{
  workItem: WorkItem | null;
  events: PipelineEvent[];
} | null> {
  try {
    const response = await fetch(WORKFLOW_API, {
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      // Only log errors for non-expected statuses
      if (response.status !== 404) {
        console.error(`Workflow API error: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();

    // Reset the flag if we get valid data
    if (data.workItem) {
      hasLoggedNoWorkflow = false;
    } else if (!hasLoggedNoWorkflow) {
      // Log once that no workflow is active
      console.info('[Workflow] No active workflow. Start one with /vaf-new');
      hasLoggedNoWorkflow = true;
    }

    return {
      workItem: data.workItem ?? null,
      events: (data.events ?? []) as PipelineEvent[],
    };
  } catch (error) {
    // Only log unexpected errors, not routine fetch failures
    if (error instanceof Error && !error.message.includes('fetch')) {
      console.error('Failed to fetch workflow data:', error);
    }
    return null;
  }
}

/**
 * Build stage states from work item and events
 */
export function buildStageStates(
  workItem: WorkItem | null,
  events: PipelineEvent[]
): StageState[] {
  const currentStage = workItem?.stage ?? 'INTAKE';
  const stages = Object.keys(STAGE_CONFIG) as Stage[];

  return stages.map((stage) => {
    const stageEvents = events.filter((e) => e.stage === stage);
    const reviews = stageEvents.filter((e) => e.decisionType === 'REVIEW');
    const approvals = stageEvents.filter((e) => e.decisionType === 'APPROVAL');

    return {
      id: stage,
      name: STAGE_CONFIG[stage].label,
      status: getStageStatus(currentStage, stage),
      reviewCount: reviews.length,
      approvalCount: approvals.length,
    };
  });
}

/**
 * Extract agent executions from events
 */
export function extractAgentExecutions(
  events: PipelineEvent[]
): AgentExecution[] {
  const executions: AgentExecution[] = [];
  const agentMap = new Map<string, AgentExecution>();

  for (const event of events) {
    if (event.agent) {
      const existing = agentMap.get(event.agent);
      if (existing) {
        // Update existing execution
        if (event.decision) {
          existing.decision = event.details as any;
        }
      } else {
        // Create new execution
        agentMap.set(event.agent, {
          agentId: event.agent,
          agentName: event.agent,
          role: (event.details?.role as string) ?? 'Agent',
          authority: 'IC',
          status: 'success',
          timestamp: event.timestamp,
        });
      }
    }
  }

  return Array.from(agentMap.values());
}

/**
 * Poll for all workflow data
 * Uses the server-side API route to read local filesystem files
 */
export async function pollWorkflowData(): Promise<{
  workItem: WorkItem | null;
  events: PipelineEvent[];
  stages: StageState[];
  agentExecutions: AgentExecution[];
} | null> {
  try {
    const data = await fetchWorkflowData();

    if (!data) {
      return { workItem: null, events: [], stages: [], agentExecutions: [] };
    }

    const { workItem, events } = data;
    const stages = buildStageStates(workItem, events);
    const agentExecutions = extractAgentExecutions(events);

    return { workItem, events, stages, agentExecutions };
  } catch (error) {
    // Silent fail - don't spam console when no workflow is active
    return { workItem: null, events: [], stages: [], agentExecutions: [] };
  }
}
