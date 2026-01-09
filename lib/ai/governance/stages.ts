/**
 * Stage Definitions
 *
 * Defines all pipeline stages with their requirements, artifacts, and approvers.
 */

import { type Stage, type StageConfig, STAGES, STAGE_CONFIGS } from './types';

/**
 * Stage metadata with additional runtime information
 */
export interface StageMetadata extends StageConfig {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  previousStage: Stage | null;
  nextStage: Stage | null;
}

/**
 * Get stage metadata
 */
export function getStageMetadata(stage: Stage): StageMetadata {
  const index = STAGES.indexOf(stage);
  const config = STAGE_CONFIGS[stage];

  return {
    ...config,
    index,
    isFirst: index === 0,
    isLast: index === STAGES.length - 1,
    previousStage: index > 0 ? STAGES[index - 1] : null,
    nextStage: index < STAGES.length - 1 ? STAGES[index + 1] : null,
  };
}

/**
 * Get all stages with metadata
 */
export function getAllStagesMetadata(): StageMetadata[] {
  return STAGES.map(getStageMetadata);
}

/**
 * Get the next stage after a given stage
 */
export function getNextStage(currentStage: Stage): Stage | null {
  const index = STAGES.indexOf(currentStage);
  if (index === -1 || index >= STAGES.length - 1) {
    return null;
  }
  return STAGES[index + 1];
}

/**
 * Get the previous stage before a given stage
 */
export function getPreviousStage(currentStage: Stage): Stage | null {
  const index = STAGES.indexOf(currentStage);
  if (index <= 0) {
    return null;
  }
  return STAGES[index - 1];
}

/**
 * Check if a stage comes before another
 */
export function isStageBefore(stage: Stage, otherStage: Stage): boolean {
  return STAGES.indexOf(stage) < STAGES.indexOf(otherStage);
}

/**
 * Check if a stage comes after another
 */
export function isStageAfter(stage: Stage, otherStage: Stage): boolean {
  return STAGES.indexOf(stage) > STAGES.indexOf(otherStage);
}

/**
 * Get all stages between two stages (exclusive)
 */
export function getStagesBetween(startStage: Stage, endStage: Stage): Stage[] {
  const startIndex = STAGES.indexOf(startStage);
  const endIndex = STAGES.indexOf(endStage);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return [];
  }

  return STAGES.slice(startIndex + 1, endIndex);
}

/**
 * Get required artifacts for a stage
 */
export function getRequiredArtifacts(stage: Stage): string[] {
  return STAGE_CONFIGS[stage].requiredArtifacts;
}

/**
 * Get required reviews for a stage
 */
export function getRequiredReviews(stage: Stage): { agent: string; domain: string }[] {
  return STAGE_CONFIGS[stage].requiredReviews;
}

/**
 * Get required approvals for a stage
 */
export function getRequiredApprovals(stage: Stage): { agent: string; domain: string }[] {
  return STAGE_CONFIGS[stage].requiredApprovals;
}

/**
 * Get signoff agent for a stage
 */
export function getSignoffAgent(stage: Stage): string {
  return STAGE_CONFIGS[stage].signoffAgent;
}

/**
 * Stage completion requirements
 */
export interface StageCompletionRequirements {
  stage: Stage;
  artifacts: string[];
  reviews: { agent: string; domain: string }[];
  approvals: { agent: string; domain: string }[];
  signoff: string;
}

/**
 * Get all completion requirements for a stage
 */
export function getStageCompletionRequirements(stage: Stage): StageCompletionRequirements {
  const config = STAGE_CONFIGS[stage];
  return {
    stage,
    artifacts: config.requiredArtifacts,
    reviews: config.requiredReviews,
    approvals: config.requiredApprovals,
    signoff: config.signoffAgent,
  };
}

/**
 * Pipeline configuration based on complexity
 */
export interface PipelineConfig {
  name: string;
  stages: Stage[];
  description: string;
  estimatedDuration: string;
}

/**
 * Pipeline configurations by type
 */
export const PIPELINE_CONFIGS: Record<string, PipelineConfig> = {
  FAST_TRACK: {
    name: 'Fast Track',
    stages: ['INTAKE', 'IMPLEMENTATION', 'VERIFICATION', 'COMPLETED'],
    description: 'For simple changes under 20 lines in 1 file',
    estimatedDuration: '5-10 minutes',
  },
  UI_FAST_TRACK: {
    name: 'UI Fast Track',
    stages: ['INTAKE', 'DESIGN', 'IMPLEMENTATION', 'VERIFICATION', 'RELEASE', 'COMPLETED'],
    description: 'For UI-only changes under 50 lines',
    estimatedDuration: '15-30 minutes',
  },
  BUG_FIX: {
    name: 'Bug Fix',
    stages: ['INTAKE', 'ARCHITECTURE', 'IMPLEMENTATION', 'VERIFICATION', 'RELEASE', 'COMPLETED'],
    description: 'For bug fixes requiring architecture review',
    estimatedDuration: '30-60 minutes',
  },
  STANDARD: {
    name: 'Standard',
    stages: ['INTAKE', 'PLANNING', 'ARCHITECTURE', 'DESIGN', 'IMPLEMENTATION', 'VERIFICATION', 'RELEASE', 'COMPLETED'],
    description: 'For standard features under 200 lines',
    estimatedDuration: '1-2 hours',
  },
  FULL_GOVERNANCE: {
    name: 'Full Governance',
    stages: ['INTAKE', 'PLANNING', 'ARCHITECTURE', 'DESIGN', 'IMPLEMENTATION', 'VERIFICATION', 'RELEASE', 'COMPLETED'],
    description: 'For complex or security-sensitive changes',
    estimatedDuration: '2-4 hours',
  },
};

/**
 * Get pipeline configuration
 */
export function getPipelineConfig(pipelineType: string): PipelineConfig | null {
  return PIPELINE_CONFIGS[pipelineType] ?? null;
}

/**
 * Check if a stage is included in a pipeline
 */
export function isStageInPipeline(stage: Stage, pipelineType: string): boolean {
  const config = PIPELINE_CONFIGS[pipelineType];
  return config ? config.stages.includes(stage) : false;
}

/**
 * Get stages for a pipeline
 */
export function getPipelineStages(pipelineType: string): Stage[] {
  const config = PIPELINE_CONFIGS[pipelineType];
  return config ? config.stages : [...STAGES];
}

/**
 * Stage display information
 */
export interface StageDisplayInfo {
  stage: Stage;
  name: string;
  description: string;
  icon: string;
  color: string;
}

/**
 * Get display info for stages
 */
export function getStageDisplayInfo(stage: Stage): StageDisplayInfo {
  const displayMap: Record<Stage, Omit<StageDisplayInfo, 'stage'>> = {
    INTAKE: {
      name: 'Intake',
      description: 'Capturing and validating requirements',
      icon: '📥',
      color: 'blue',
    },
    PLANNING: {
      name: 'Planning',
      description: 'Creating PRD and architecture approach',
      icon: '📋',
      color: 'purple',
    },
    ARCHITECTURE: {
      name: 'Architecture',
      description: 'Documenting technical implementation',
      icon: '🏗️',
      color: 'indigo',
    },
    DESIGN: {
      name: 'Design',
      description: 'Defining UI/UX specifications',
      icon: '🎨',
      color: 'pink',
    },
    IMPLEMENTATION: {
      name: 'Implementation',
      description: 'Building the feature/fix',
      icon: '⚙️',
      color: 'yellow',
    },
    VERIFICATION: {
      name: 'Verification',
      description: 'Testing and quality validation',
      icon: '✅',
      color: 'green',
    },
    RELEASE: {
      name: 'Release',
      description: 'Preparing deployment',
      icon: '🚀',
      color: 'orange',
    },
    COMPLETED: {
      name: 'Completed',
      description: 'Work item finished',
      icon: '🎉',
      color: 'gray',
    },
  };

  return {
    stage,
    ...displayMap[stage],
  };
}

/**
 * Get progress percentage through pipeline
 */
export function getStageProgress(currentStage: Stage, pipelineType?: string): number {
  const stages = pipelineType ? getPipelineStages(pipelineType) : [...STAGES];
  const currentIndex = stages.indexOf(currentStage);

  if (currentIndex === -1) return 0;

  // Completed = 100%
  if (currentStage === 'COMPLETED') return 100;

  // Calculate percentage based on position in pipeline
  return Math.round((currentIndex / (stages.length - 1)) * 100);
}
