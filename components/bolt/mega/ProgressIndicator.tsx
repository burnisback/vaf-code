'use client';

/**
 * ProgressIndicator Component
 *
 * Displays overall progress through the mega-complex pipeline.
 * Shows stages: Research → PRD → Architecture → Phases → Complete
 */

import React from 'react';
import type { OrchestrationState } from '@/lib/bolt/orchestration/types';
import { getStateDescription } from '@/lib/bolt/orchestration/machine';

// =============================================================================
// ICONS
// =============================================================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

// =============================================================================
// TYPES
// =============================================================================

/** Pipeline stage definition */
interface PipelineStage {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  states: OrchestrationState[];
}

/** Stage status */
type StageStatus = 'pending' | 'active' | 'completed' | 'failed' | 'paused';

interface ProgressIndicatorProps {
  /** Current orchestration state */
  state: OrchestrationState;
  /** Current phase number (if in phase execution) */
  currentPhase?: number;
  /** Total phases */
  totalPhases?: number;
  /** Error message if failed */
  error?: string;
  /** Whether to show compact version */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// PIPELINE STAGES
// =============================================================================

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'research',
    label: 'Research',
    icon: SearchIcon,
    states: ['researching'],
  },
  {
    id: 'prd',
    label: 'PRD',
    icon: DocumentIcon,
    states: ['defining-product'],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    icon: LayersIcon,
    states: ['generating-architecture', 'awaiting-approval'],
  },
  {
    id: 'implementation',
    label: 'Implementation',
    icon: CodeIcon,
    states: ['planning-phase', 'executing-phase', 'verifying', 'refining'],
  },
  {
    id: 'complete',
    label: 'Complete',
    icon: RocketIcon,
    states: ['complete'],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getStageStatus(
  stage: PipelineStage,
  currentState: OrchestrationState,
  allStages: PipelineStage[]
): StageStatus {
  // Check if this stage is active
  if (stage.states.includes(currentState)) {
    // Check if awaiting approval (paused)
    if (currentState.startsWith('awaiting-') || currentState === 'paused') {
      return 'paused';
    }
    return 'active';
  }

  // Check if failed
  if (currentState === 'failed') {
    // Find the stage that was active when it failed
    const stageIndex = allStages.findIndex(s => s.id === stage.id);
    const currentStageIndex = allStages.findIndex(s =>
      s.states.includes(currentState) || s.id === 'implementation'
    );
    if (stageIndex <= currentStageIndex) {
      return stageIndex === currentStageIndex ? 'failed' : 'completed';
    }
    return 'pending';
  }

  // Check if completed (stage comes before current)
  const stageIndex = allStages.findIndex(s => s.id === stage.id);
  const currentStageIndex = allStages.findIndex(s => s.states.includes(currentState));

  if (currentStageIndex === -1) {
    // State not found in any stage - treat as pending (e.g., 'idle')
    return 'pending';
  }

  if (stageIndex < currentStageIndex) {
    return 'completed';
  }

  return 'pending';
}

function getStatusColor(status: StageStatus): {
  bg: string;
  border: string;
  text: string;
  line: string;
} {
  switch (status) {
    case 'completed':
      return {
        bg: 'bg-emerald-500',
        border: 'border-emerald-500',
        text: 'text-emerald-400',
        line: 'bg-emerald-500',
      };
    case 'active':
      return {
        bg: 'bg-violet-500',
        border: 'border-violet-500',
        text: 'text-violet-400',
        line: 'bg-violet-500',
      };
    case 'paused':
      return {
        bg: 'bg-amber-500',
        border: 'border-amber-500',
        text: 'text-amber-400',
        line: 'bg-amber-500',
      };
    case 'failed':
      return {
        bg: 'bg-red-500',
        border: 'border-red-500',
        text: 'text-red-400',
        line: 'bg-red-500',
      };
    default:
      return {
        bg: 'bg-zinc-700',
        border: 'border-zinc-600',
        text: 'text-zinc-500',
        line: 'bg-zinc-700',
      };
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ProgressIndicator({
  state,
  currentPhase,
  totalPhases,
  error,
  compact = false,
  className = '',
}: ProgressIndicatorProps) {
  // Calculate overall progress
  const completedStages = PIPELINE_STAGES.filter(
    stage => getStageStatus(stage, state, PIPELINE_STAGES) === 'completed'
  ).length;
  const progress = (completedStages / PIPELINE_STAGES.length) * 100;

  // Compact mode
  if (compact) {
    return (
      <CompactProgress
        state={state}
        progress={progress}
        currentPhase={currentPhase}
        totalPhases={totalPhases}
        className={className}
      />
    );
  }

  return (
    <div className={`bg-zinc-900/50 rounded-lg border border-zinc-800/50 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Pipeline Progress</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {getStateDescription(state)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-lg font-semibold text-white">{Math.round(progress)}%</span>
            {currentPhase !== undefined && totalPhases !== undefined && (
              <p className="text-xs text-zinc-500">
                Phase {currentPhase}/{totalPhases}
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          {PIPELINE_STAGES.map((stage, index) => {
            const status = getStageStatus(stage, state, PIPELINE_STAGES);
            const colors = getStatusColor(status);
            const isLast = index === PIPELINE_STAGES.length - 1;
            const Icon = stage.icon;

            return (
              <React.Fragment key={stage.id}>
                {/* Stage Node */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full border-2 ${colors.border} ${
                      status === 'active' || status === 'paused' ? colors.bg : 'bg-zinc-900'
                    } flex items-center justify-center transition-all duration-300`}
                  >
                    <StageIcon status={status} Icon={Icon} colors={colors} />
                  </div>
                  <span className={`mt-2 text-xs font-medium ${colors.text}`}>
                    {stage.label}
                  </span>
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="flex-1 mx-2">
                    <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors.line} transition-all duration-500`}
                        style={{
                          width: status === 'completed' ? '100%' : status === 'active' || status === 'paused' ? '50%' : '0%',
                        }}
                      />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {state === 'failed' && error && (
        <div className="px-4 py-3 border-t border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-2">
            <XIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Pipeline Failed</p>
              <p className="text-xs text-red-300/70 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Completion Banner */}
      {state === 'complete' && (
        <div className="px-4 py-3 border-t border-emerald-500/30 bg-emerald-500/10">
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">
              Pipeline completed successfully!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// STAGE ICON COMPONENT
// =============================================================================

interface StageIconProps {
  status: StageStatus;
  Icon: React.ComponentType<{ className?: string }>;
  colors: ReturnType<typeof getStatusColor>;
}

function StageIcon({ status, Icon, colors }: StageIconProps) {
  switch (status) {
    case 'completed':
      return <CheckIcon className="w-5 h-5 text-white" />;
    case 'active':
      return <SpinnerIcon className="w-5 h-5 text-white" />;
    case 'paused':
      return <PauseIcon className="w-5 h-5 text-white" />;
    case 'failed':
      return <XIcon className="w-5 h-5 text-white" />;
    default:
      return <Icon className={`w-5 h-5 ${colors.text}`} />;
  }
}

// =============================================================================
// COMPACT PROGRESS
// =============================================================================

interface CompactProgressProps {
  state: OrchestrationState;
  progress: number;
  currentPhase?: number;
  totalPhases?: number;
  className?: string;
}

function CompactProgress({
  state,
  progress,
  currentPhase,
  totalPhases,
  className = '',
}: CompactProgressProps) {
  const isActive = !['idle', 'complete', 'failed'].includes(state);
  const isPaused = state.startsWith('awaiting-') || state === 'paused';
  const isFailed = state === 'failed';
  const isCompleted = state === 'complete';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Status Icon */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
        isCompleted ? 'bg-emerald-500' :
        isFailed ? 'bg-red-500' :
        isPaused ? 'bg-amber-500' :
        isActive ? 'bg-violet-500' :
        'bg-zinc-700'
      }`}>
        {isCompleted && <CheckIcon className="w-4 h-4 text-white" />}
        {isFailed && <XIcon className="w-4 h-4 text-white" />}
        {isPaused && <PauseIcon className="w-4 h-4 text-white" />}
        {isActive && !isPaused && <SpinnerIcon className="w-4 h-4 text-white" />}
        {!isActive && !isCompleted && !isFailed && (
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
        )}
      </div>

      {/* Progress Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-400 truncate">
            {getStateDescription(state)}
          </span>
          <span className="text-xs font-medium text-zinc-300">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted ? 'bg-emerald-500' :
              isFailed ? 'bg-red-500' :
              'bg-gradient-to-r from-violet-500 to-fuchsia-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phase Counter */}
      {currentPhase !== undefined && totalPhases !== undefined && (
        <span className="text-xs text-zinc-500 whitespace-nowrap">
          {currentPhase}/{totalPhases}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// MINI PROGRESS BADGE
// =============================================================================

interface MiniProgressBadgeProps {
  state: OrchestrationState;
  size?: 'sm' | 'md';
}

export function MiniProgressBadge({ state, size = 'sm' }: MiniProgressBadgeProps) {
  const isActive = !['idle', 'complete', 'failed'].includes(state);
  const isPaused = state.startsWith('awaiting-') || state === 'paused';
  const isFailed = state === 'failed';
  const isCompleted = state === 'complete';

  const baseClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  if (isCompleted) {
    return (
      <span className={`inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 rounded-full ${baseClasses}`}>
        <CheckIcon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        Complete
      </span>
    );
  }

  if (isFailed) {
    return (
      <span className={`inline-flex items-center gap-1 bg-red-500/10 text-red-400 rounded-full ${baseClasses}`}>
        <XIcon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        Failed
      </span>
    );
  }

  if (isPaused) {
    return (
      <span className={`inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 rounded-full ${baseClasses}`}>
        <PauseIcon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        Waiting
      </span>
    );
  }

  if (isActive) {
    return (
      <span className={`inline-flex items-center gap-1 bg-violet-500/10 text-violet-400 rounded-full ${baseClasses}`}>
        <SpinnerIcon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        Running
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 bg-zinc-500/10 text-zinc-400 rounded-full ${baseClasses}`}>
      Idle
    </span>
  );
}

// =============================================================================
// STAGE PROGRESS CARD
// =============================================================================

interface StageProgressCardProps {
  stage: 'research' | 'prd' | 'architecture' | 'implementation';
  status: StageStatus;
  details?: string;
  progress?: number;
}

export function StageProgressCard({
  stage,
  status,
  details,
  progress,
}: StageProgressCardProps) {
  const stageConfig = PIPELINE_STAGES.find(s => s.id === stage);
  if (!stageConfig) return null;

  const colors = getStatusColor(status);
  const Icon = stageConfig.icon;

  return (
    <div className={`p-3 rounded-lg border ${colors.border} bg-zinc-900/50`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center`}>
          <StageIcon status={status} Icon={Icon} colors={colors} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">{stageConfig.label}</span>
            {progress !== undefined && (
              <span className={`text-xs ${colors.text}`}>{progress}%</span>
            )}
          </div>
          {details && (
            <p className="text-xs text-zinc-400 truncate mt-0.5">{details}</p>
          )}
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.line} transition-all duration-300`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
