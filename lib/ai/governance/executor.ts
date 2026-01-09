/**
 * Pipeline Executor
 *
 * Executes the full governance pipeline, coordinating agents,
 * collecting approvals, and managing stage transitions.
 */

import {
  type Stage,
  type WorkItem,
  type DecisionObject,
  STAGES,
  STAGE_CONFIGS,
} from './types';
import { workItemManager } from './workItem';
import { governanceLedger } from './ledger';
import { approvalCollector } from './approvals';
import { transitionManager } from './transitions';
import { escalationHandler } from './escalation';
import { getPipelineStages, getStageDisplayInfo } from './stages';

/**
 * Pipeline execution options
 */
export interface PipelineExecutionOptions {
  pipelineType?: string;
  autoAdvance?: boolean;
  maxIterations?: number;
  onStageEnter?: (stage: Stage, workItem: WorkItem) => void;
  onStageComplete?: (stage: Stage, workItem: WorkItem) => void;
  onDecision?: (decision: DecisionObject) => void;
  onError?: (error: Error, stage: Stage) => void;
}

/**
 * Pipeline execution result
 */
export interface PipelineExecutionResult {
  success: boolean;
  workItemId: string;
  finalStage: Stage;
  completedStages: Stage[];
  decisions: DecisionObject[];
  artifacts: Record<string, string>;
  errors: string[];
  duration: number;
}

/**
 * Stage execution result
 */
export interface StageExecutionResult {
  success: boolean;
  stage: Stage;
  decisions: DecisionObject[];
  artifacts: string[];
  blockers: string[];
  needsEscalation: boolean;
}

/**
 * Pipeline Executor class
 */
export class PipelineExecutor {
  /**
   * Execute full pipeline for a work item
   */
  async executePipeline(
    workItemId: string,
    options: PipelineExecutionOptions = {}
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    const result: PipelineExecutionResult = {
      success: false,
      workItemId,
      finalStage: 'INTAKE',
      completedStages: [],
      decisions: [],
      artifacts: {},
      errors: [],
      duration: 0,
    };

    const workItem = workItemManager.getWorkItem(workItemId);
    if (!workItem) {
      result.errors.push(`Work item not found: ${workItemId}`);
      result.duration = Date.now() - startTime;
      return result;
    }

    // Get pipeline stages
    const pipelineType = options.pipelineType ?? workItem.pipeline ?? 'STANDARD';
    const stages = getPipelineStages(pipelineType);

    console.log(`[Pipeline] Starting ${pipelineType} pipeline for ${workItemId}`);
    console.log(`[Pipeline] Stages: ${stages.join(' → ')}`);

    // Execute each stage
    for (const stage of stages) {
      // Skip stages we've already passed
      if (STAGES.indexOf(stage) < STAGES.indexOf(workItem.currentStage)) {
        result.completedStages.push(stage);
        continue;
      }

      // Skip COMPLETED - it's the terminal state
      if (stage === 'COMPLETED') {
        continue;
      }

      // Wait until we're at this stage
      if (workItem.currentStage !== stage) {
        // Try to advance if auto-advance is enabled
        if (options.autoAdvance) {
          const transition = transitionManager.executeTransition(workItem, stage);
          if (!transition.success) {
            result.errors.push(`Could not advance to ${stage}: ${transition.blockers?.join(', ')}`);
            break;
          }
        } else {
          continue;
        }
      }

      // Notify stage entry
      options.onStageEnter?.(stage, workItem);
      const stageInfo = getStageDisplayInfo(stage);
      console.log(`[Pipeline] ${stageInfo.icon} Entering ${stageInfo.name}`);

      // Execute the stage
      const stageResult = await this.executeStage(workItem, stage, options);

      // Collect results
      result.decisions.push(...stageResult.decisions);
      stageResult.artifacts.forEach((a) => {
        if (workItem.artifacts?.[a]) {
          result.artifacts[a] = workItem.artifacts[a];
        }
      });

      // Handle stage result
      if (!stageResult.success) {
        if (stageResult.needsEscalation) {
          console.log(`[Pipeline] Stage ${stage} needs escalation`);
          const escalationDecision = await escalationHandler.autoEscalate(workItem);

          if (escalationDecision) {
            result.decisions.push(escalationDecision);
            options.onDecision?.(escalationDecision);

            if (escalationDecision.decision === 'REJECTED') {
              result.errors.push(`Escalation rejected: ${escalationDecision.notes}`);
              break;
            }
            // If approved, continue with the stage
          }
        } else {
          result.errors.push(...stageResult.blockers);
          break;
        }
      }

      // Try to advance to next stage
      const transition = transitionManager.executeTransition(workItem);
      if (transition.success) {
        result.completedStages.push(stage);
        options.onStageComplete?.(stage, workItem);
        console.log(`[Pipeline] ✓ Completed ${stageInfo.name}`);
      } else {
        result.errors.push(
          `Could not advance from ${stage}: ${transition.blockers?.join(', ')}`
        );
        break;
      }
    }

    // Check final state
    result.finalStage = workItem.currentStage;
    result.success = workItem.currentStage === 'COMPLETED' || workItem.status === 'COMPLETED';
    result.duration = Date.now() - startTime;

    console.log(
      `[Pipeline] ${result.success ? '✓' : '✗'} Pipeline ${result.success ? 'completed' : 'stopped'} at ${result.finalStage} (${result.duration}ms)`
    );

    return result;
  }

  /**
   * Execute a single stage
   */
  async executeStage(
    workItem: WorkItem,
    stage: Stage,
    options: PipelineExecutionOptions = {}
  ): Promise<StageExecutionResult> {
    const result: StageExecutionResult = {
      success: false,
      stage,
      decisions: [],
      artifacts: [],
      blockers: [],
      needsEscalation: false,
    };

    const stageConfig = STAGE_CONFIGS[stage];

    try {
      // Step 1: Check/create required artifacts
      const missingArtifacts = stageConfig.requiredArtifacts.filter(
        (a) => !workItem.artifacts?.[a]
      );

      if (missingArtifacts.length > 0) {
        result.blockers.push(
          `Missing artifacts: ${missingArtifacts.join(', ')}`
        );
        // In a full implementation, we would invoke the appropriate agent
        // to create the missing artifacts here
        console.log(`[Stage] Missing artifacts: ${missingArtifacts.join(', ')}`);
      }

      result.artifacts = stageConfig.requiredArtifacts.filter(
        (a) => workItem.artifacts?.[a]
      );

      // Step 2: Collect reviews
      for (const review of stageConfig.requiredReviews) {
        // Check if review already exists
        const existingReview = workItem.decisions?.find(
          (d) =>
            d.stage === stage &&
            d.decisionType === 'REVIEW' &&
            d.reviewerAgent === review.agent &&
            d.domain === review.domain
        );

        if (existingReview) {
          result.decisions.push(existingReview);
          if (
            existingReview.decision === 'CHANGES_REQUIRED' ||
            existingReview.decision === 'REJECTED'
          ) {
            result.blockers.push(
              `${review.agent} (${review.domain}): ${existingReview.decision}`
            );
          }
        } else {
          result.blockers.push(
            `Pending review: ${review.agent} (${review.domain})`
          );
        }
      }

      // Step 3: Collect approvals
      const approvalStatus = approvalCollector.getStageApprovalStatus(
        workItem.id,
        stage,
        workItem.decisions ?? []
      );

      result.decisions.push(
        ...approvalStatus.approvals
          .filter((a) => a.decision)
          .map((a) => a.decision!)
      );

      if (!approvalStatus.canAdvance) {
        result.blockers.push(...approvalStatus.blockers);
      }

      // Step 4: Check sign-off
      if (approvalStatus.signoff.status !== 'approved' && stage !== 'COMPLETED') {
        result.blockers.push(
          `Pending sign-off: ${stageConfig.signoffAgent}`
        );
      }

      // Determine success
      result.success = result.blockers.length === 0;

      // Check if escalation is needed
      if (!result.success) {
        const escalationCheck = escalationHandler.checkEscalationNeeded(workItem);
        result.needsEscalation = escalationCheck.needed;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.blockers.push(`Error: ${err.message}`);
      options.onError?.(err, stage);
    }

    return result;
  }

  /**
   * Resume pipeline execution from current stage
   */
  async resumePipeline(
    workItemId: string,
    options: PipelineExecutionOptions = {}
  ): Promise<PipelineExecutionResult> {
    return this.executePipeline(workItemId, {
      ...options,
      autoAdvance: true,
    });
  }

  /**
   * Get pipeline status
   */
  getPipelineStatus(workItemId: string): {
    workItem: WorkItem | null;
    progress: number;
    currentStage: Stage | null;
    stageProgress: ReturnType<typeof transitionManager.getTransitionProgress> | null;
    pendingActions: string[];
    canAdvance: boolean;
  } {
    const workItem = workItemManager.getWorkItem(workItemId);
    if (!workItem) {
      return {
        workItem: null,
        progress: 0,
        currentStage: null,
        stageProgress: null,
        pendingActions: [],
        canAdvance: false,
      };
    }

    const stageProgress = transitionManager.getTransitionProgress(workItem);
    const blockers = transitionManager.getBlockers(workItem);
    const pipelineType = workItem.pipeline ?? 'STANDARD';
    const stages = getPipelineStages(pipelineType);

    // Calculate overall progress
    const currentIndex = stages.indexOf(workItem.currentStage);
    const overallProgress =
      currentIndex >= 0
        ? Math.round(
            ((currentIndex + stageProgress.percentComplete / 100) / stages.length) *
              100
          )
        : 0;

    return {
      workItem,
      progress: overallProgress,
      currentStage: workItem.currentStage,
      stageProgress,
      pendingActions: blockers,
      canAdvance: transitionManager.canTransition(workItem),
    };
  }

  /**
   * Advance to next stage manually
   */
  advanceStage(workItemId: string): {
    success: boolean;
    newStage?: Stage;
    error?: string;
  } {
    const workItem = workItemManager.getWorkItem(workItemId);
    if (!workItem) {
      return { success: false, error: 'Work item not found' };
    }

    const result = transitionManager.executeTransition(workItem);
    if (result.success) {
      return { success: true, newStage: result.toStage };
    } else {
      return {
        success: false,
        error: result.blockers?.join(', ') ?? 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const pipelineExecutor = new PipelineExecutor();

/**
 * Quick pipeline execution helper
 */
export async function runPipeline(
  title: string,
  description: string,
  options: PipelineExecutionOptions = {}
): Promise<PipelineExecutionResult> {
  // Create work item
  const workItem = workItemManager.createWorkItem({
    title,
    description,
    pipeline: options.pipelineType,
  });

  // Execute pipeline
  return pipelineExecutor.executePipeline(workItem.id, options);
}
