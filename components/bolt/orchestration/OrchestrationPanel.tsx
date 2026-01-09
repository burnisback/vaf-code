'use client';

/**
 * OrchestrationPanel
 *
 * UI component for monitoring and controlling multi-phase orchestration.
 * Displays progress, stages, and provides control buttons for user interaction.
 */

import React from 'react';
import type {
  OrchestrationState,
  OrchestrationContext,
  ExecutionProgress,
} from '@/lib/bolt/orchestration/types';

// =============================================================================
// ICONS (inline SVG components to avoid external dependencies)
// =============================================================================

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3" />
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 12 15 16 10" />
    </svg>
  );
}

function RotateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface OrchestrationPanelProps {
  /** Current orchestration state */
  state: OrchestrationState;

  /** Current orchestration context */
  context: OrchestrationContext;

  /** Execution progress */
  progress: ExecutionProgress;

  /** Called when user approves current stage */
  onApprove?: () => void;

  /** Called when user rejects current stage */
  onReject?: () => void;

  /** Called when user pauses execution */
  onPause?: () => void;

  /** Called when user resumes execution */
  onResume?: () => void;

  /** Called when user aborts execution */
  onAbort?: () => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function OrchestrationPanel({
  state,
  context,
  progress,
  onApprove,
  onReject,
  onPause,
  onResume,
  onAbort,
}: OrchestrationPanelProps) {
  const isRunning = !['idle', 'paused', 'complete', 'failed', 'awaiting-approval'].includes(state);
  const needsApproval = state === 'awaiting-approval';
  const isPaused = state === 'paused';
  const isComplete = state === 'complete';
  const isFailed = state === 'failed';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StateIndicator state={state} />
            <div>
              <h3 className="text-sm font-medium text-white">
                {progress.stage}
              </h3>
              <p className="text-xs text-zinc-500">{progress.stageDetails}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {isRunning && (
              <button
                onClick={onPause}
                className="p-2 hover:bg-zinc-800 rounded transition-colors"
                title="Pause"
              >
                <PauseIcon className="w-4 h-4 text-zinc-400" />
              </button>
            )}
            {isPaused && (
              <button
                onClick={onResume}
                className="p-2 hover:bg-zinc-800 rounded transition-colors"
                title="Resume"
              >
                <PlayIcon className="w-4 h-4 text-emerald-400" />
              </button>
            )}
            {(isRunning || isPaused) && (
              <button
                onClick={onAbort}
                className="p-2 hover:bg-zinc-800 rounded transition-colors"
                title="Abort"
              >
                <XIcon className="w-4 h-4 text-red-400" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {!isComplete && !isFailed && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>Progress</span>
              <span>{progress.percentage}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isFailed ? 'bg-red-500' : 'bg-violet-500'
                }`}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stages */}
      <div className="p-4 space-y-2">
        <StageList
          completed={progress.completedStages}
          current={progress.stage}
          remaining={progress.remainingStages}
          state={state}
        />
      </div>

      {/* Approval Actions */}
      {needsApproval && (
        <div className="p-4 border-t border-zinc-800 bg-violet-500/5">
          <p className="text-sm text-zinc-300 mb-3">
            Ready to proceed. Review the output above and approve to continue.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onApprove}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded transition-colors"
            >
              <CheckIcon className="w-4 h-4" />
              Approve & Continue
            </button>
            <button
              onClick={onReject}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Complete State */}
      {isComplete && (
        <div className="p-4 border-t border-zinc-800 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircleIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Project Complete!</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Total duration: {formatDuration(context.metrics.totalDuration)}
          </p>
        </div>
      )}

      {/* Failed State */}
      {isFailed && (
        <div className="p-4 border-t border-zinc-800 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400">
            <AlertIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Execution Failed</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">{context.error}</p>
          <button
            onClick={onResume}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors"
          >
            <RotateIcon className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Metrics Footer */}
      {(isComplete || context.metrics.verificationAttempts > 0) && (
        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Verification attempts: {context.metrics.verificationAttempts}</span>
            {context.completedPhases.length > 0 && (
              <span>Phases: {context.completedPhases.length}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StateIndicator({ state }: { state: OrchestrationState }) {
  if (state === 'complete') {
    return <CheckCircleIcon className="w-5 h-5 text-emerald-400" />;
  }
  if (state === 'failed') {
    return <AlertIcon className="w-5 h-5 text-red-400" />;
  }
  if (state === 'paused') {
    return <PauseIcon className="w-5 h-5 text-yellow-400" />;
  }
  if (state === 'awaiting-approval') {
    return <CircleIcon className="w-5 h-5 text-violet-400" />;
  }
  return <LoaderIcon className="w-5 h-5 text-violet-400 animate-spin" />;
}

function StageList({
  completed,
  current,
  remaining,
  state,
}: {
  completed: string[];
  current: string;
  remaining: string[];
  state: OrchestrationState;
}) {
  const isCurrentRunning = !['awaiting-approval', 'paused', 'complete', 'failed', 'idle'].includes(state);

  return (
    <div className="space-y-1">
      {/* Completed stages */}
      {completed.map((stage, i) => (
        <div key={`completed-${i}`} className="flex items-center gap-2 text-sm">
          <CheckIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-zinc-400">{stage}</span>
        </div>
      ))}

      {/* Current stage */}
      {current && !completed.includes(current) && (
        <div className="flex items-center gap-2 text-sm">
          {isCurrentRunning ? (
            <LoaderIcon className="w-4 h-4 text-violet-400 animate-spin" />
          ) : (
            <CircleIcon className="w-4 h-4 text-violet-400" />
          )}
          <span className="text-white font-medium">{current}</span>
        </div>
      )}

      {/* Remaining stages */}
      {remaining.map((stage, i) => (
        <div key={`remaining-${i}`} className="flex items-center gap-2 text-sm text-zinc-600">
          <CircleIcon className="w-4 h-4" />
          <span>{stage}</span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// =============================================================================
// COMPACT VARIANT
// =============================================================================

interface OrchestrationStatusProps {
  state: OrchestrationState;
  progress: ExecutionProgress;
  onClick?: () => void;
}

/**
 * Compact status indicator for toolbar/header use
 */
export function OrchestrationStatus({
  state,
  progress,
  onClick,
}: OrchestrationStatusProps) {
  const isActive = !['idle', 'complete', 'failed'].includes(state);

  if (!isActive && state === 'idle') {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
    >
      <StateIndicator state={state} />
      <span className="text-xs text-zinc-300">
        {state === 'complete' ? 'Complete' : state === 'failed' ? 'Failed' : `${progress.percentage}%`}
      </span>
    </button>
  );
}
