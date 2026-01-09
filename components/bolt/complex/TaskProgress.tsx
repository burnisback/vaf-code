'use client';

/**
 * TaskProgress
 *
 * Shows real-time progress during plan execution.
 * Displays task list with status indicators and overall progress bar.
 */

import React from 'react';
import {
  Check,
  X,
  Loader2,
  Circle,
  FileCode,
  Terminal,
  Edit,
  Trash2,
} from 'lucide-react';
import type { TaskPlan, PlanTask } from '@/lib/bolt/ai/planner';

// =============================================================================
// TYPES
// =============================================================================

interface TaskProgressProps {
  plan: TaskPlan;
  currentTaskId?: string;
  completedTasks: number;
  totalTasks: number;
}

// =============================================================================
// STATUS ICON
// =============================================================================

function TaskStatusIcon({ status }: { status: PlanTask['status'] }) {
  switch (status) {
    case 'completed':
      return <Check className="w-4 h-4 text-emerald-400" />;
    case 'failed':
      return <X className="w-4 h-4 text-red-400" />;
    case 'in_progress':
      return <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />;
    case 'skipped':
      return <Circle className="w-4 h-4 text-zinc-600" strokeDasharray="2 2" />;
    default:
      return <Circle className="w-4 h-4 text-zinc-600" />;
  }
}

// =============================================================================
// TASK TYPE ICON
// =============================================================================

function TaskTypeIcon({ type }: { type: PlanTask['type'] }) {
  switch (type) {
    case 'shell':
      return <Terminal className="w-3 h-3" />;
    case 'modify':
      return <Edit className="w-3 h-3" />;
    case 'delete':
      return <Trash2 className="w-3 h-3" />;
    default:
      return <FileCode className="w-3 h-3" />;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TaskProgress({
  plan,
  currentTaskId,
  completedTasks,
  totalTasks,
}: TaskProgressProps) {
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const failedTasks = plan.tasks.filter(t => t.status === 'failed').length;

  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden">
      {/* Header with Progress Bar */}
      <div className="px-4 py-3 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">
            Executing Plan
          </span>
          <span className="text-xs text-zinc-400">
            {completedTasks} / {totalTasks} tasks
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              failedTasks > 0
                ? 'bg-gradient-to-r from-amber-500 to-red-500'
                : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Task List */}
      <div className="p-3 space-y-1 max-h-48 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {plan.tasks.map((task) => {
          const isCurrent = task.id === currentTaskId || task.status === 'in_progress';
          const isComplete = task.status === 'completed';
          const isFailed = task.status === 'failed';

          return (
            <div
              key={task.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
                isCurrent
                  ? 'bg-violet-500/10 border border-violet-500/20'
                  : isComplete
                  ? 'bg-emerald-500/5'
                  : isFailed
                  ? 'bg-red-500/5'
                  : 'bg-zinc-800/30'
              }`}
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                <TaskStatusIcon status={isCurrent && task.status === 'pending' ? 'in_progress' : task.status} />
              </div>

              {/* Task Type */}
              <div className="flex-shrink-0 text-zinc-500">
                <TaskTypeIcon type={task.type} />
              </div>

              {/* Description */}
              <span
                className={`flex-1 text-sm truncate ${
                  isComplete
                    ? 'text-emerald-300'
                    : isFailed
                    ? 'text-red-300'
                    : isCurrent
                    ? 'text-white'
                    : 'text-zinc-400'
                }`}
              >
                {task.description}
              </span>

              {/* File Path (if applicable) */}
              {task.filePath && (
                <code className="text-xs text-zinc-500 font-mono truncate max-w-32">
                  {task.filePath.split('/').pop()}
                </code>
              )}

              {/* Error indicator */}
              {task.error && (
                <span className="text-xs text-red-400 truncate max-w-24" title={task.error}>
                  {task.error.slice(0, 20)}...
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      {progressPercent === 100 && (
        <div className={`px-4 py-2 border-t border-zinc-800/50 ${
          failedTasks > 0 ? 'bg-amber-500/5' : 'bg-emerald-500/5'
        }`}>
          <div className={`flex items-center gap-2 text-sm ${
            failedTasks > 0 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {failedTasks > 0 ? (
              <>
                <X className="w-4 h-4" />
                <span>Completed with {failedTasks} error(s)</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Plan execution complete!</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MINI PROGRESS (for inline display)
// =============================================================================

interface MiniProgressProps {
  completedTasks: number;
  totalTasks: number;
  currentTask?: string;
  isExecuting?: boolean;
}

export function MiniProgress({
  completedTasks,
  totalTasks,
  currentTask,
  isExecuting = true
}: MiniProgressProps) {
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      {isExecuting && <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />}
      <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <span className="text-xs text-zinc-500">
        {completedTasks}/{totalTasks}
      </span>
      {currentTask && (
        <span className="text-xs text-zinc-400 truncate max-w-32">
          {currentTask}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// EXECUTION SUMMARY (for after completion)
// =============================================================================

interface ExecutionSummaryProps {
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
  executionTime: number;
}

export function ExecutionSummary({
  completedTasks,
  failedTasks,
  totalTasks,
  executionTime,
}: ExecutionSummaryProps) {
  const success = failedTasks === 0;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
      success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
    }`}>
      {success ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : (
        <X className="w-4 h-4 text-amber-400" />
      )}
      <span>
        {success
          ? `All ${totalTasks} tasks completed`
          : `${completedTasks}/${totalTasks} tasks completed (${failedTasks} failed)`}
      </span>
      <span className="text-xs opacity-60">
        {(executionTime / 1000).toFixed(1)}s
      </span>
    </div>
  );
}
