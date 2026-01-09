'use client';

/**
 * ExecutionProgress Component
 *
 * Enhanced progress visualization for AI task execution.
 * Shows animated progress bar, task checklist, and status updates.
 */

import React, { useState, useEffect, memo } from 'react';
import {
  Check,
  X,
  Loader2,
  Circle,
  FileCode,
  Terminal,
  Edit,
  Trash2,
  Zap,
  Brain,
  CheckCircle2,
  Clock,
  Sparkles,
  Ban,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type ExecutionPhase = 'thinking' | 'planning' | 'executing' | 'verifying' | 'complete' | 'error';

export interface ExecutionTask {
  id: string;
  label: string;
  type: 'file' | 'shell' | 'modify' | 'delete';
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped' | 'blocked';
  duration?: number;
  error?: string;
  filePath?: string;
}

export interface ExecutionProgressProps {
  phase: ExecutionPhase;
  phaseMessage?: string;
  tasks?: ExecutionTask[];
  currentTaskId?: string;
  overallProgress?: number;
  startTime?: number;
}

// =============================================================================
// PHASE INDICATOR COMPONENT
// =============================================================================

const PhaseIcon = memo(function PhaseIcon({ phase }: { phase: ExecutionPhase }) {
  switch (phase) {
    case 'thinking':
      return (
        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
          <Brain className="w-4 h-4 text-violet-400 animate-pulse" />
        </div>
      );
    case 'planning':
      return (
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-blue-400 animate-pulse" />
        </div>
      );
    case 'executing':
      return (
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
        </div>
      );
    case 'verifying':
      return (
        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 animate-pulse" />
        </div>
      );
    case 'complete':
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center animate-scale-in">
          <Sparkles className="w-4 h-4 text-emerald-400" />
        </div>
      );
    case 'error':
      return (
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
          <X className="w-4 h-4 text-red-400" />
        </div>
      );
  }
});

function getPhaseColor(phase: ExecutionPhase) {
  switch (phase) {
    case 'thinking':
      return 'from-violet-500 to-purple-500';
    case 'planning':
      return 'from-blue-500 to-cyan-500';
    case 'executing':
      return 'from-amber-500 to-orange-500';
    case 'verifying':
      return 'from-cyan-500 to-teal-500';
    case 'complete':
      return 'from-emerald-500 to-green-500';
    case 'error':
      return 'from-red-500 to-rose-500';
  }
}

function getPhaseLabel(phase: ExecutionPhase) {
  switch (phase) {
    case 'thinking':
      return 'Analyzing request...';
    case 'planning':
      return 'Creating plan...';
    case 'executing':
      return 'Executing tasks...';
    case 'verifying':
      return 'Verifying changes...';
    case 'complete':
      return 'All done!';
    case 'error':
      return 'Error occurred';
  }
}

// =============================================================================
// TASK STATUS ICON
// =============================================================================

function TaskStatusIcon({ status }: { status: ExecutionTask['status'] }) {
  switch (status) {
    case 'pending':
      return <Circle className="w-4 h-4 text-zinc-600" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />;
    case 'success':
      return (
        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center animate-scale-in">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      );
    case 'error':
      return (
        <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
          <X className="w-2.5 h-2.5 text-white" />
        </div>
      );
    case 'skipped':
      return <Circle className="w-4 h-4 text-zinc-600" strokeDasharray="2 2" />;
    case 'blocked':
      return (
        <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
          <Ban className="w-2.5 h-2.5 text-white" />
        </div>
      );
  }
}

function TaskTypeIcon({ type }: { type: ExecutionTask['type'] }) {
  const iconClass = 'w-3 h-3 text-zinc-500';
  switch (type) {
    case 'shell':
      return <Terminal className={iconClass} />;
    case 'modify':
      return <Edit className={iconClass} />;
    case 'delete':
      return <Trash2 className={iconClass} />;
    default:
      return <FileCode className={iconClass} />;
  }
}

// =============================================================================
// THINKING SKELETON
// =============================================================================

export function ThinkingSkeleton({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
          <Brain className="w-4 h-4 text-violet-400 animate-pulse" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-violet-300 font-medium">
            {message || 'Analyzing your request...'}
          </div>
          {/* Shimmer skeleton */}
          <div className="mt-2 space-y-2">
            <div className="h-2 bg-violet-500/10 rounded animate-shimmer" style={{ width: '80%' }} />
            <div className="h-2 bg-violet-500/10 rounded animate-shimmer" style={{ width: '60%', animationDelay: '150ms' }} />
            <div className="h-2 bg-violet-500/10 rounded animate-shimmer" style={{ width: '40%', animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PLANNING SKELETON
// =============================================================================

export function PlanningSkeleton({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-blue-400 animate-pulse" />
        </div>
        <div className="text-sm text-blue-300 font-medium">
          {message || 'Creating execution plan...'}
        </div>
      </div>

      {/* Task skeleton */}
      <div className="ml-11 space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/5"
          >
            <div className="w-4 h-4 rounded-full bg-blue-500/20 animate-pulse" />
            <div
              className="h-3 bg-blue-500/10 rounded animate-shimmer flex-1"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ExecutionProgress({
  phase,
  phaseMessage,
  tasks = [],
  currentTaskId,
  overallProgress,
  startTime,
}: ExecutionProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Track elapsed time
  useEffect(() => {
    if (!startTime || phase === 'complete' || phase === 'error') return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, phase]);

  const completedCount = tasks.filter(t => t.status === 'success').length;
  const failedCount = tasks.filter(t => t.status === 'error').length;
  const progress = overallProgress ?? (tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0);

  // Render skeleton states
  if (phase === 'thinking' && tasks.length === 0) {
    return <ThinkingSkeleton message={phaseMessage} />;
  }

  if (phase === 'planning' && tasks.length === 0) {
    return <PlanningSkeleton message={phaseMessage} />;
  }

  const phaseColor = getPhaseColor(phase);

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 overflow-hidden">
      {/* Header with Phase & Progress */}
      <div className="px-4 py-3 border-b border-zinc-700/50">
        <div className="flex items-center gap-3">
          <PhaseIcon phase={phase} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200">
                {phaseMessage || getPhaseLabel(phase)}
              </span>
              {tasks.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {completedCount} / {tasks.length} tasks
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {phase !== 'thinking' && phase !== 'planning' && (
              <div className="mt-2 h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${phaseColor} transition-all duration-300 relative`}
                  style={{ width: `${progress}%` }}
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Elapsed time */}
          {startTime && phase !== 'complete' && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock className="w-3 h-3" />
              <span>{(elapsedTime / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
      </div>

      {/* Task List */}
      {tasks.length > 0 && (
        <div className="p-3 space-y-1.5 max-h-48 overflow-auto">
          {tasks.map((task) => {
            const isCurrent = task.id === currentTaskId || task.status === 'running';
            const isComplete = task.status === 'success';
            const isFailed = task.status === 'error';

            return (
              <div
                key={task.id}
                className={`
                  flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200
                  ${isCurrent ? 'bg-violet-500/10 border border-violet-500/30' : ''}
                  ${isComplete ? 'bg-emerald-500/5' : ''}
                  ${isFailed ? 'bg-red-500/5' : ''}
                  ${!isCurrent && !isComplete && !isFailed ? 'bg-zinc-800/30' : ''}
                `}
              >
                {/* Status Icon */}
                <TaskStatusIcon status={task.status} />

                {/* Task Type Icon */}
                <TaskTypeIcon type={task.type} />

                {/* Label */}
                <span
                  className={`
                    flex-1 text-sm truncate
                    ${isComplete ? 'text-emerald-300' : ''}
                    ${isFailed ? 'text-red-300' : ''}
                    ${isCurrent ? 'text-white' : ''}
                    ${!isCurrent && !isComplete && !isFailed ? 'text-zinc-400' : ''}
                  `}
                >
                  {task.label}
                </span>

                {/* Duration */}
                {task.duration && (
                  <span className="text-xs text-zinc-600">
                    {(task.duration / 1000).toFixed(1)}s
                  </span>
                )}

                {/* Error indicator */}
                {task.error && (
                  <span
                    className="text-xs text-red-400 truncate max-w-24"
                    title={task.error}
                  >
                    {task.error.slice(0, 20)}...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Completion Footer */}
      {phase === 'complete' && (
        <div className="px-4 py-3 border-t border-zinc-700/50 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Sparkles className="w-4 h-4" />
            <span>
              {failedCount > 0
                ? `Completed with ${failedCount} error${failedCount > 1 ? 's' : ''}`
                : `All ${tasks.length} tasks completed successfully`}
            </span>
            {elapsedTime > 0 && (
              <span className="text-emerald-500/70">
                in {(elapsedTime / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error Footer */}
      {phase === 'error' && (
        <div className="px-4 py-3 border-t border-zinc-700/50 bg-red-500/5">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <X className="w-4 h-4" />
            <span>{phaseMessage || 'An error occurred during execution'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COMPACT PROGRESS (for inline display)
// =============================================================================

interface CompactProgressProps {
  phase: ExecutionPhase;
  completedTasks: number;
  totalTasks: number;
  currentTask?: string;
}

export function CompactProgress({
  phase,
  completedTasks,
  totalTasks,
  currentTask,
}: CompactProgressProps) {
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const phaseColor = getPhaseColor(phase);

  return (
    <div className="flex items-center gap-2">
      {phase === 'executing' && <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />}
      {phase === 'complete' && <Check className="w-3 h-3 text-emerald-400" />}
      {phase === 'error' && <X className="w-3 h-3 text-red-400" />}

      <div className="w-20 h-1 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${phaseColor} transition-all duration-300`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <span className="text-xs text-zinc-500">
        {completedTasks}/{totalTasks}
      </span>

      {currentTask && (
        <span className="text-xs text-zinc-400 truncate max-w-24">
          {currentTask}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// CSS ANIMATIONS (add to globals.css)
// =============================================================================
// @keyframes shimmer {
//   0% { background-position: -200% 0; }
//   100% { background-position: 200% 0; }
// }
// .animate-shimmer {
//   background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.1), transparent);
//   background-size: 200% 100%;
//   animation: shimmer 1.5s infinite;
// }
// @keyframes scale-in {
//   from { transform: scale(0); opacity: 0; }
//   to { transform: scale(1); opacity: 1; }
// }
// .animate-scale-in {
//   animation: scale-in 0.2s ease-out;
// }
