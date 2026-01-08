/**
 * Workflow Visualization Types
 * WI-20260106-002
 */

export type Stage =
  | 'INTAKE'
  | 'PLANNING'
  | 'ARCHITECTURE'
  | 'DESIGN'
  | 'IMPLEMENTATION'
  | 'VERIFICATION'
  | 'RELEASE'
  | 'COMPLETED';

export type StageStatus = 'pending' | 'active' | 'success' | 'failed';

export type DecisionType = 'REVIEW' | 'APPROVAL' | 'SIGNOFF' | 'ESCALATION';

export type Decision =
  | 'APPROVED'
  | 'CHANGES_REQUIRED'
  | 'REJECTED'
  | 'APPROVED_WITH_RISKS';

export type AuthorityLevel = 'EXECUTIVE' | 'LEAD' | 'IC' | 'SUPPORT';

export type EventType =
  | 'STAGE_TRANSITION'
  | 'DECISION'
  | 'WORK_ITEM_CREATED'
  | 'AGENT_INVOCATION'
  | 'ARTIFACT_CREATED'
  | 'ERROR';

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  stage: Stage;
  status: 'ACTIVE' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  acceptanceCriteria: string[];
  assignedAgents: string[];
  artifacts: Record<string, string>;
  approvalHistory: ApprovalRecord[];
  metadata: Record<string, unknown>;
}

export interface ApprovalRecord {
  stage: Stage;
  agent: string;
  type: DecisionType;
  decision: Decision;
  timestamp: string;
  notes?: string;
}

export interface DecisionObject {
  workItemId: string;
  stage: Stage;
  decisionType: DecisionType;
  decision: Decision;
  reviewerAgent: string;
  timestamp: string;
  domain: string;
  iteration: number;
  notes: string;
  requiredChanges?: string[];
  risks?: string[];
  artifactsReviewed?: string[];
  blocksTransition: boolean;
}

export interface PipelineEvent {
  timestamp: string;
  event: EventType;
  workItemId: string;
  stage: Stage;
  agent?: string;
  decisionType?: DecisionType;
  decision?: Decision;
  details?: Record<string, unknown>;
}

export interface CurrentWorkflow {
  activeWorkItem: string | null;
  currentStage: Stage | null;
  lastUpdated: string;
  sessionId: string;
}

export interface StageState {
  id: Stage;
  name: string;
  status: StageStatus;
  agent?: string;
  reviewCount: number;
  approvalCount: number;
  duration?: number;
}

export interface AgentExecution {
  agentId: string;
  agentName: string;
  role: string;
  authority: AuthorityLevel;
  status: 'pending' | 'running' | 'success' | 'error';
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  selfCheck?: SelfCheckResult;
  decision?: DecisionObject;
  timestamp: string;
  duration?: number;
}

export interface SelfCheckResult {
  passed: boolean;
  confidence: number;
  notes?: string;
}

// Stage display configuration
export const STAGE_CONFIG: Record<Stage, { label: string; order: number }> = {
  INTAKE: { label: 'Intake', order: 0 },
  PLANNING: { label: 'Planning', order: 1 },
  ARCHITECTURE: { label: 'Architecture', order: 2 },
  DESIGN: { label: 'Design', order: 3 },
  IMPLEMENTATION: { label: 'Implementation', order: 4 },
  VERIFICATION: { label: 'Verification', order: 5 },
  RELEASE: { label: 'Release', order: 6 },
  COMPLETED: { label: 'Completed', order: 7 },
};

// Utility functions with explicit return types
export function getStageStatus(
  currentStage: Stage,
  targetStage: Stage
): StageStatus {
  const currentOrder = STAGE_CONFIG[currentStage]?.order ?? 0;
  const targetOrder = STAGE_CONFIG[targetStage]?.order ?? 0;

  if (targetOrder < currentOrder) return 'success';
  if (targetOrder === currentOrder) return 'active';
  return 'pending';
}

export function getStageLabel(stage: Stage): string {
  return STAGE_CONFIG[stage]?.label ?? stage;
}

export function getStageOrder(stage: Stage): number {
  return STAGE_CONFIG[stage]?.order ?? 0;
}
