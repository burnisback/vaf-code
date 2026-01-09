/**
 * Stage Transition Manager
 *
 * Manages stage transitions, validates requirements, and enforces gates.
 */

import {
  type Stage,
  type DecisionObject,
  type TransitionResult,
  type WorkItem,
  STAGES,
  STAGE_CONFIGS,
} from './types';
import { governanceLedger } from './ledger';
import { getNextStage, getPreviousStage, isStageInPipeline } from './stages';

/**
 * Transition validation result
 */
export interface TransitionValidation {
  canTransition: boolean;
  fromStage: Stage;
  toStage: Stage;
  missingArtifacts: string[];
  missingReviews: { agent: string; domain: string }[];
  missingApprovals: { agent: string; domain: string }[];
  missingSignoff: boolean;
  blockingDecisions: DecisionObject[];
  errors: string[];
}

/**
 * Transition Manager class
 */
export class TransitionManager {
  /**
   * Validate if a transition is allowed
   */
  validateTransition(
    workItem: WorkItem,
    targetStage?: Stage
  ): TransitionValidation {
    const fromStage = workItem.currentStage;
    const toStage = targetStage ?? getNextStage(fromStage);

    const result: TransitionValidation = {
      canTransition: false,
      fromStage,
      toStage: toStage ?? fromStage,
      missingArtifacts: [],
      missingReviews: [],
      missingApprovals: [],
      missingSignoff: false,
      blockingDecisions: [],
      errors: [],
    };

    // Check if target stage is valid
    if (!toStage) {
      result.errors.push('Already at final stage or invalid target stage');
      return result;
    }

    // Check if work item is active
    if (workItem.status !== 'ACTIVE') {
      result.errors.push(`Work item is not active: ${workItem.status}`);
      return result;
    }

    // Check if stage is in pipeline
    if (workItem.pipeline && !isStageInPipeline(toStage, workItem.pipeline)) {
      result.errors.push(`Stage ${toStage} is not in pipeline ${workItem.pipeline}`);
      return result;
    }

    const stageConfig = STAGE_CONFIGS[fromStage];
    const decisions = workItem.decisions ?? [];

    // Check required artifacts
    for (const artifact of stageConfig.requiredArtifacts) {
      if (!workItem.artifacts?.[artifact]) {
        result.missingArtifacts.push(artifact);
      }
    }

    // Check required reviews
    for (const review of stageConfig.requiredReviews) {
      const reviewDecision = decisions.find(
        (d) =>
          d.stage === fromStage &&
          d.decisionType === 'REVIEW' &&
          d.reviewerAgent === review.agent &&
          d.domain === review.domain
      );

      if (!reviewDecision) {
        result.missingReviews.push(review);
      } else if (
        reviewDecision.decision === 'CHANGES_REQUIRED' ||
        reviewDecision.decision === 'REJECTED'
      ) {
        result.blockingDecisions.push(reviewDecision);
      }
    }

    // Check required approvals
    for (const approval of stageConfig.requiredApprovals) {
      const approvalDecision = decisions.find(
        (d) =>
          d.stage === fromStage &&
          (d.decisionType === 'APPROVAL' || d.decisionType === 'SIGNOFF') &&
          d.reviewerAgent === approval.agent &&
          d.domain === approval.domain &&
          (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
      );

      if (!approvalDecision) {
        result.missingApprovals.push(approval);
      }
    }

    // Check sign-off (required for all stages except transitioning to COMPLETED)
    if (fromStage !== 'COMPLETED') {
      const signoffDecision = decisions.find(
        (d) =>
          d.stage === fromStage &&
          d.decisionType === 'SIGNOFF' &&
          d.reviewerAgent === stageConfig.signoffAgent &&
          (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
      );

      if (!signoffDecision) {
        result.missingSignoff = true;
      }
    }

    // Determine if transition is allowed
    result.canTransition =
      result.missingArtifacts.length === 0 &&
      result.missingReviews.length === 0 &&
      result.missingApprovals.length === 0 &&
      result.blockingDecisions.length === 0 &&
      !result.missingSignoff &&
      result.errors.length === 0;

    return result;
  }

  /**
   * Execute a stage transition
   */
  executeTransition(
    workItem: WorkItem,
    targetStage?: Stage
  ): TransitionResult {
    const validation = this.validateTransition(workItem, targetStage);

    if (!validation.canTransition) {
      const blockers: string[] = [
        ...validation.errors,
        ...validation.missingArtifacts.map((a) => `Missing artifact: ${a}`),
        ...validation.missingReviews.map((r) => `Missing review: ${r.agent} (${r.domain})`),
        ...validation.missingApprovals.map((a) => `Missing approval: ${a.agent} (${a.domain})`),
        ...validation.blockingDecisions.map(
          (d) => `Blocked by ${d.reviewerAgent}: ${d.decision}`
        ),
      ];

      if (validation.missingSignoff) {
        blockers.push(`Missing sign-off from ${STAGE_CONFIGS[validation.fromStage].signoffAgent}`);
      }

      return {
        success: false,
        fromStage: validation.fromStage,
        toStage: validation.toStage,
        blockers,
        missingArtifacts: validation.missingArtifacts,
        missingApprovals: validation.missingApprovals.map(
          (a) => `${a.agent}:${a.domain}`
        ),
      };
    }

    // Log stage completion
    governanceLedger.logStageCompleted(workItem.id, validation.fromStage);

    // Update work item
    const previousStage = workItem.currentStage;
    workItem.currentStage = validation.toStage;
    workItem.updatedAt = new Date().toISOString();

    // Log stage entry
    governanceLedger.logStageEntered(workItem.id, validation.toStage);

    // Handle completion
    if (validation.toStage === 'COMPLETED') {
      workItem.status = 'COMPLETED';
      workItem.completedAt = workItem.updatedAt;
      governanceLedger.logWorkItemCompleted(workItem.id);
    }

    console.log(
      `[Transition] ${workItem.id}: ${previousStage} → ${validation.toStage}`
    );

    return {
      success: true,
      fromStage: validation.fromStage,
      toStage: validation.toStage,
    };
  }

  /**
   * Check if transition is possible (quick check)
   */
  canTransition(workItem: WorkItem, targetStage?: Stage): boolean {
    return this.validateTransition(workItem, targetStage).canTransition;
  }

  /**
   * Get blockers for transition
   */
  getBlockers(workItem: WorkItem, targetStage?: Stage): string[] {
    const validation = this.validateTransition(workItem, targetStage);
    const blockers: string[] = [...validation.errors];

    validation.missingArtifacts.forEach((a) =>
      blockers.push(`Missing artifact: ${a}`)
    );
    validation.missingReviews.forEach((r) =>
      blockers.push(`Missing review: ${r.agent} (${r.domain})`)
    );
    validation.missingApprovals.forEach((a) =>
      blockers.push(`Missing approval: ${a.agent} (${a.domain})`)
    );
    validation.blockingDecisions.forEach((d) =>
      blockers.push(`Blocked by ${d.reviewerAgent}: ${d.decision}`)
    );

    if (validation.missingSignoff) {
      blockers.push(
        `Missing sign-off from ${STAGE_CONFIGS[validation.fromStage].signoffAgent}`
      );
    }

    return blockers;
  }

  /**
   * Get transition progress
   */
  getTransitionProgress(workItem: WorkItem): {
    stage: Stage;
    artifactsComplete: number;
    artifactsTotal: number;
    reviewsComplete: number;
    reviewsTotal: number;
    approvalsComplete: number;
    approvalsTotal: number;
    hasSignoff: boolean;
    percentComplete: number;
  } {
    const stageConfig = STAGE_CONFIGS[workItem.currentStage];
    const decisions = workItem.decisions ?? [];

    // Count artifacts
    const artifactsTotal = stageConfig.requiredArtifacts.length;
    const artifactsComplete = stageConfig.requiredArtifacts.filter(
      (a) => workItem.artifacts?.[a]
    ).length;

    // Count reviews
    const reviewsTotal = stageConfig.requiredReviews.length;
    const reviewsComplete = stageConfig.requiredReviews.filter((review) =>
      decisions.some(
        (d) =>
          d.stage === workItem.currentStage &&
          d.decisionType === 'REVIEW' &&
          d.reviewerAgent === review.agent &&
          d.domain === review.domain &&
          (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
      )
    ).length;

    // Count approvals
    const approvalsTotal = stageConfig.requiredApprovals.length;
    const approvalsComplete = stageConfig.requiredApprovals.filter((approval) =>
      decisions.some(
        (d) =>
          d.stage === workItem.currentStage &&
          (d.decisionType === 'APPROVAL' || d.decisionType === 'SIGNOFF') &&
          d.reviewerAgent === approval.agent &&
          d.domain === approval.domain &&
          (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
      )
    ).length;

    // Check sign-off
    const hasSignoff = decisions.some(
      (d) =>
        d.stage === workItem.currentStage &&
        d.decisionType === 'SIGNOFF' &&
        d.reviewerAgent === stageConfig.signoffAgent &&
        (d.decision === 'APPROVED' || d.decision === 'APPROVED_WITH_RISKS')
    );

    // Calculate percentage
    const totalItems = artifactsTotal + reviewsTotal + approvalsTotal + 1; // +1 for signoff
    const completeItems =
      artifactsComplete + reviewsComplete + approvalsComplete + (hasSignoff ? 1 : 0);
    const percentComplete =
      totalItems > 0 ? Math.round((completeItems / totalItems) * 100) : 100;

    return {
      stage: workItem.currentStage,
      artifactsComplete,
      artifactsTotal,
      reviewsComplete,
      reviewsTotal,
      approvalsComplete,
      approvalsTotal,
      hasSignoff,
      percentComplete,
    };
  }

  /**
   * Rollback to previous stage (requires orchestrator approval)
   */
  rollbackStage(
    workItem: WorkItem,
    reason: string,
    approvedBy: string
  ): TransitionResult {
    // Only orchestrator can approve rollbacks
    if (approvedBy !== 'vaf-orchestrator') {
      return {
        success: false,
        fromStage: workItem.currentStage,
        toStage: workItem.currentStage,
        blockers: ['Only vaf-orchestrator can approve rollbacks'],
      };
    }

    const previousStage = getPreviousStage(workItem.currentStage);
    if (!previousStage) {
      return {
        success: false,
        fromStage: workItem.currentStage,
        toStage: workItem.currentStage,
        blockers: ['Cannot rollback from first stage'],
      };
    }

    // Log the rollback
    governanceLedger.logReworkTriggered(
      workItem.id,
      workItem.currentStage,
      `Rollback: ${reason}`,
      (workItem.iterationCount ?? 0) + 1,
      approvedBy
    );

    // Update work item
    const fromStage = workItem.currentStage;
    workItem.currentStage = previousStage;
    workItem.updatedAt = new Date().toISOString();
    workItem.iterationCount = (workItem.iterationCount ?? 0) + 1;

    // Log stage entry
    governanceLedger.logStageEntered(workItem.id, previousStage);

    console.log(
      `[Rollback] ${workItem.id}: ${fromStage} → ${previousStage} (${reason})`
    );

    return {
      success: true,
      fromStage,
      toStage: previousStage,
    };
  }
}

// Singleton instance
export const transitionManager = new TransitionManager();
