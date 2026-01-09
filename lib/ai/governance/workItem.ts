/**
 * Work Item Manager
 *
 * Manages work item lifecycle, state transitions, and artifact tracking.
 */

import {
  type Stage,
  type WorkItem,
  type WorkItemStatus,
  type DecisionObject,
  workItemSchema,
  STAGES,
  STAGE_CONFIGS,
} from './types';
import { governanceLedger } from './ledger';

/**
 * Generate a unique work item ID
 * Format: WI-YYYYMMDD-NNN
 */
function generateWorkItemId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `WI-${dateStr}-${random}`;
}

/**
 * Parameters for creating a work item
 */
export interface CreateWorkItemParams {
  title: string;
  description: string;
  createdBy?: string;
  pipeline?: string;
  complexity?: 'simple' | 'medium' | 'complex';
}

/**
 * Work Item Manager class
 */
export class WorkItemManager {
  private workItems: Map<string, WorkItem> = new Map();

  /**
   * Create a new work item
   */
  createWorkItem(params: CreateWorkItemParams): WorkItem {
    const id = generateWorkItemId();
    const now = new Date().toISOString();

    const workItem: WorkItem = {
      id,
      title: params.title,
      description: params.description,
      status: 'ACTIVE',
      currentStage: 'INTAKE',
      createdAt: now,
      updatedAt: now,
      createdBy: params.createdBy,
      artifacts: {},
      decisions: [],
      iterationCount: 0,
      maxIterations: 3,
      pipeline: params.pipeline ?? 'STANDARD',
      complexity: params.complexity,
    };

    // Validate
    workItemSchema.parse(workItem);

    // Store
    this.workItems.set(id, workItem);

    // Log to ledger
    governanceLedger.logWorkItemCreated(id, {
      title: params.title,
      description: params.description,
      createdBy: params.createdBy,
    });

    // Log stage entry
    governanceLedger.logStageEntered(id, 'INTAKE');

    return workItem;
  }

  /**
   * Get a work item by ID
   */
  getWorkItem(id: string): WorkItem | undefined {
    return this.workItems.get(id);
  }

  /**
   * Get all work items
   */
  getAllWorkItems(): WorkItem[] {
    return Array.from(this.workItems.values());
  }

  /**
   * Get work items by status
   */
  getWorkItemsByStatus(status: WorkItemStatus): WorkItem[] {
    return this.getAllWorkItems().filter((wi) => wi.status === status);
  }

  /**
   * Get active work items
   */
  getActiveWorkItems(): WorkItem[] {
    return this.getWorkItemsByStatus('ACTIVE');
  }

  /**
   * Update work item status
   */
  updateStatus(id: string, status: WorkItemStatus): WorkItem {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      throw new Error(`Work item not found: ${id}`);
    }

    workItem.status = status;
    workItem.updatedAt = new Date().toISOString();

    if (status === 'COMPLETED') {
      workItem.completedAt = workItem.updatedAt;
      governanceLedger.logWorkItemCompleted(id);
    } else if (status === 'CANCELLED') {
      governanceLedger.logWorkItemCancelled(id, 'User cancelled');
    }

    return workItem;
  }

  /**
   * Advance to the next stage
   */
  advanceStage(id: string): { success: boolean; newStage?: Stage; error?: string } {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      return { success: false, error: `Work item not found: ${id}` };
    }

    if (workItem.status !== 'ACTIVE') {
      return { success: false, error: `Work item is not active: ${workItem.status}` };
    }

    const currentIndex = STAGES.indexOf(workItem.currentStage);
    if (currentIndex === -1 || currentIndex >= STAGES.length - 1) {
      return { success: false, error: 'Already at final stage' };
    }

    // Check if current stage requirements are met
    const validation = this.validateStageCompletion(id, workItem.currentStage);
    if (!validation.complete) {
      return {
        success: false,
        error: `Stage requirements not met: ${validation.issues.join(', ')}`,
      };
    }

    // Log stage completion
    governanceLedger.logStageCompleted(id, workItem.currentStage);

    // Advance to next stage
    const previousStage = workItem.currentStage;
    const newStage = STAGES[currentIndex + 1];
    workItem.currentStage = newStage;
    workItem.updatedAt = new Date().toISOString();

    // Log stage entry
    governanceLedger.logStageEntered(id, newStage);

    // If reached COMPLETED, update status
    if (newStage === 'COMPLETED') {
      workItem.status = 'COMPLETED';
      workItem.completedAt = workItem.updatedAt;
      governanceLedger.logWorkItemCompleted(id);
    }

    console.log(`[WorkItem] ${id} advanced from ${previousStage} to ${newStage}`);

    return { success: true, newStage };
  }

  /**
   * Validate that a stage's requirements are complete
   */
  validateStageCompletion(
    id: string,
    stage: Stage
  ): { complete: boolean; issues: string[] } {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      return { complete: false, issues: ['Work item not found'] };
    }

    const issues: string[] = [];
    const stageConfig = STAGE_CONFIGS[stage];

    // Check required artifacts
    for (const artifact of stageConfig.requiredArtifacts) {
      if (!workItem.artifacts?.[artifact]) {
        issues.push(`Missing artifact: ${artifact}`);
      }
    }

    // Check required reviews
    const decisions = workItem.decisions ?? [];
    for (const review of stageConfig.requiredReviews) {
      const hasReview = decisions.some(
        (d) =>
          d.stage === stage &&
          d.decisionType === 'REVIEW' &&
          d.reviewerAgent === review.agent &&
          d.domain === review.domain &&
          (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
      );
      if (!hasReview) {
        issues.push(`Missing review: ${review.agent} (${review.domain})`);
      }
    }

    // Check required approvals
    for (const approval of stageConfig.requiredApprovals) {
      const hasApproval = decisions.some(
        (d) =>
          d.stage === stage &&
          (d.decisionType === 'APPROVAL' || d.decisionType === 'SIGNOFF') &&
          d.reviewerAgent === approval.agent &&
          d.domain === approval.domain &&
          (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
      );
      if (!hasApproval) {
        issues.push(`Missing approval: ${approval.agent} (${approval.domain})`);
      }
    }

    // Check sign-off (required for all stages except COMPLETED)
    if (stage !== 'COMPLETED') {
      const hasSignoff = decisions.some(
        (d) =>
          d.stage === stage &&
          d.decisionType === 'SIGNOFF' &&
          d.reviewerAgent === stageConfig.signoffAgent &&
          (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
      );
      if (!hasSignoff) {
        issues.push(`Missing sign-off from ${stageConfig.signoffAgent}`);
      }
    }

    return {
      complete: issues.length === 0,
      issues,
    };
  }

  /**
   * Add an artifact to a work item
   */
  addArtifact(id: string, name: string, path: string, agent?: string): void {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      throw new Error(`Work item not found: ${id}`);
    }

    if (!workItem.artifacts) {
      workItem.artifacts = {};
    }

    workItem.artifacts[name] = path;
    workItem.updatedAt = new Date().toISOString();

    // Log to ledger
    governanceLedger.logArtifactCreated(
      id,
      workItem.currentStage,
      name,
      agent ?? 'unknown'
    );
  }

  /**
   * Add a decision to a work item
   */
  addDecision(id: string, decision: DecisionObject): void {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      throw new Error(`Work item not found: ${id}`);
    }

    if (!workItem.decisions) {
      workItem.decisions = [];
    }

    workItem.decisions.push(decision);
    workItem.updatedAt = new Date().toISOString();

    // Log to ledger
    governanceLedger.logDecision(decision);

    // Handle blocking decisions
    if (
      decision.decision === 'CHANGES_REQUIRED' ||
      decision.decision === 'REJECTED'
    ) {
      if (decision.decision === 'REJECTED') {
        workItem.status = 'BLOCKED';
      }
    }
  }

  /**
   * Trigger rework for a stage
   */
  triggerRework(
    id: string,
    reason: string,
    requiredChanges: string[],
    requestedBy: string
  ): { success: boolean; iteration: number; error?: string } {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      return { success: false, iteration: 0, error: 'Work item not found' };
    }

    workItem.iterationCount = (workItem.iterationCount ?? 0) + 1;

    // Check if max iterations exceeded
    if (workItem.iterationCount >= (workItem.maxIterations ?? 3)) {
      return {
        success: false,
        iteration: workItem.iterationCount,
        error: 'Max iterations exceeded - escalation required',
      };
    }

    workItem.updatedAt = new Date().toISOString();

    // Log to ledger
    governanceLedger.logReworkTriggered(
      id,
      workItem.currentStage,
      reason,
      workItem.iterationCount,
      requestedBy
    );

    console.log(
      `[WorkItem] ${id} rework triggered (iteration ${workItem.iterationCount}): ${reason}`
    );

    return { success: true, iteration: workItem.iterationCount };
  }

  /**
   * Trigger escalation
   */
  triggerEscalation(
    id: string,
    reason: string,
    requestedBy: string
  ): { success: boolean; error?: string } {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      return { success: false, error: 'Work item not found' };
    }

    workItem.status = 'BLOCKED';
    workItem.updatedAt = new Date().toISOString();

    // Log to ledger
    governanceLedger.logEscalationTriggered(
      id,
      workItem.currentStage,
      reason,
      workItem.iterationCount ?? 0,
      requestedBy
    );

    console.log(`[WorkItem] ${id} escalation triggered: ${reason}`);

    return { success: true };
  }

  /**
   * Resolve escalation (by orchestrator)
   */
  resolveEscalation(
    id: string,
    decision: 'proceed' | 'reject' | 'rework'
  ): { success: boolean; error?: string } {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      return { success: false, error: 'Work item not found' };
    }

    if (workItem.status !== 'BLOCKED') {
      return { success: false, error: 'Work item is not blocked' };
    }

    workItem.updatedAt = new Date().toISOString();

    switch (decision) {
      case 'proceed':
        workItem.status = 'ACTIVE';
        // Reset iteration count
        workItem.iterationCount = 0;
        break;
      case 'reject':
        workItem.status = 'CANCELLED';
        governanceLedger.logWorkItemCancelled(id, 'Rejected by orchestrator');
        break;
      case 'rework':
        workItem.status = 'ACTIVE';
        // Keep iteration count for tracking
        break;
    }

    return { success: true };
  }

  /**
   * Get stage status summary
   */
  getStageStatus(id: string): {
    stage: Stage;
    artifacts: { name: string; present: boolean }[];
    reviews: { agent: string; domain: string; status: 'pending' | 'approved' | 'changes_required' | 'rejected' }[];
    approvals: { agent: string; domain: string; status: 'pending' | 'approved' }[];
    signoff: { agent: string; status: 'pending' | 'approved' };
  } | null {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      return null;
    }

    const stageConfig = STAGE_CONFIGS[workItem.currentStage];
    const decisions = workItem.decisions ?? [];

    // Check artifacts
    const artifacts = stageConfig.requiredArtifacts.map((name) => ({
      name,
      present: !!workItem.artifacts?.[name],
    }));

    // Check reviews
    const reviews = stageConfig.requiredReviews.map((review) => {
      const decision = decisions.find(
        (d) =>
          d.stage === workItem.currentStage &&
          d.decisionType === 'REVIEW' &&
          d.reviewerAgent === review.agent &&
          d.domain === review.domain
      );
      let status: 'pending' | 'approved' | 'changes_required' | 'rejected' = 'pending';
      if (decision) {
        if (decision.decision === 'APPROVED' || decision.decision === 'APPROVED_WITH_RISKS') {
          status = 'approved';
        } else if (decision.decision === 'CHANGES_REQUIRED') {
          status = 'changes_required';
        } else if (decision.decision === 'REJECTED') {
          status = 'rejected';
        }
      }
      return { agent: review.agent, domain: review.domain, status };
    });

    // Check approvals
    const approvals = stageConfig.requiredApprovals.map((approval) => {
      const decision = decisions.find(
        (d) =>
          d.stage === workItem.currentStage &&
          (d.decisionType === 'APPROVAL' || d.decisionType === 'SIGNOFF') &&
          d.reviewerAgent === approval.agent &&
          d.domain === approval.domain &&
          (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
      );
      return {
        agent: approval.agent,
        domain: approval.domain,
        status: decision ? 'approved' as const : 'pending' as const,
      };
    });

    // Check sign-off
    const signoffDecision = decisions.find(
      (d) =>
        d.stage === workItem.currentStage &&
        d.decisionType === 'SIGNOFF' &&
        d.reviewerAgent === stageConfig.signoffAgent &&
        (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
    );
    const signoff = {
      agent: stageConfig.signoffAgent,
      status: signoffDecision ? 'approved' as const : 'pending' as const,
    };

    return {
      stage: workItem.currentStage,
      artifacts,
      reviews,
      approvals,
      signoff,
    };
  }

  /**
   * Export a work item to JSON
   */
  exportWorkItem(id: string): string | null {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      return null;
    }
    return JSON.stringify(workItem, null, 2);
  }

  /**
   * Import a work item from JSON
   */
  importWorkItem(json: string): WorkItem {
    const parsed = JSON.parse(json);
    const workItem = workItemSchema.parse(parsed) as WorkItem;
    this.workItems.set(workItem.id, workItem);
    return workItem;
  }
}

// Singleton instance
export const workItemManager = new WorkItemManager();
