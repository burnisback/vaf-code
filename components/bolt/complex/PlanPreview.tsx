'use client';

/**
 * PlanPreview
 *
 * Displays a task plan for user review and approval.
 * Shows task breakdown, dependencies, and estimated complexity.
 */

import React, { useState } from 'react';
import {
  FileCode,
  Terminal,
  Edit,
  Trash2,
  Package,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Play,
  Loader2,
  Clock,
  GitBranch,
} from 'lucide-react';
import type { TaskPlan, PlanTask } from '@/lib/bolt/ai/planner';

// =============================================================================
// TYPES
// =============================================================================

interface PlanPreviewProps {
  plan: TaskPlan;
  reasoning?: string;
  onApprove: () => void;
  onModify?: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
}

// =============================================================================
// TASK ICON HELPER
// =============================================================================

function TaskIcon({ type }: { type: PlanTask['type'] }) {
  switch (type) {
    case 'file':
      return <FileCode className="w-4 h-4 text-emerald-400" />;
    case 'modify':
      return <Edit className="w-4 h-4 text-amber-400" />;
    case 'shell':
      return <Terminal className="w-4 h-4 text-blue-400" />;
    case 'delete':
      return <Trash2 className="w-4 h-4 text-red-400" />;
    default:
      return <FileCode className="w-4 h-4 text-zinc-400" />;
  }
}

// =============================================================================
// COMPLEXITY INDICATOR
// =============================================================================

function ComplexityDots({ complexity }: { complexity: number }) {
  return (
    <div className="flex gap-0.5" title={`Complexity: ${complexity}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`w-1.5 h-1.5 rounded-full ${
            n <= complexity ? 'bg-violet-400' : 'bg-zinc-700'
          }`}
        />
      ))}
    </div>
  );
}

// =============================================================================
// TASK STATUS BADGE
// =============================================================================

function TaskStatusBadge({ status }: { status: PlanTask['status'] }) {
  const config = {
    pending: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Pending' },
    in_progress: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Running' },
    completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Done' },
    failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Failed' },
    skipped: { bg: 'bg-zinc-500/10', text: 'text-zinc-500', label: 'Skipped' },
  };

  const { bg, text, label } = config[status];

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

// =============================================================================
// TASK ITEM
// =============================================================================

interface TaskItemProps {
  task: PlanTask;
  index: number;
  isExecuting?: boolean;
}

function TaskItem({ task, index, isExecuting }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isCurrentlyExecuting = isExecuting && task.status === 'in_progress';

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        isCurrentlyExecuting
          ? 'border-violet-500/50 bg-violet-500/5'
          : task.status === 'completed'
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : task.status === 'failed'
          ? 'border-red-500/20 bg-red-500/5'
          : 'border-zinc-800/50'
      }`}
    >
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-zinc-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Index */}
        <span className="text-xs text-zinc-500 w-5 text-center">{index + 1}</span>

        {/* Icon */}
        <TaskIcon type={task.type} />

        {/* Description */}
        <span className="flex-1 text-sm text-zinc-300 truncate">
          {task.description}
        </span>

        {/* Status (during execution) */}
        {task.status !== 'pending' && <TaskStatusBadge status={task.status} />}

        {/* Executing indicator */}
        {isCurrentlyExecuting && (
          <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
        )}

        {/* Complexity */}
        <ComplexityDots complexity={task.complexity} />

        {/* Expand toggle */}
        {(task.filePath || task.command || task.dependsOn.length > 0) && (
          <button className="p-1 text-zinc-500 hover:text-zinc-300">
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 py-2 bg-zinc-900/50 border-t border-zinc-800/50 space-y-1.5">
          {task.filePath && (
            <div className="flex items-center gap-2 text-xs">
              <FileCode className="w-3 h-3 text-zinc-500" />
              <span className="text-zinc-500">Path:</span>
              <code className="text-violet-400 font-mono">{task.filePath}</code>
            </div>
          )}
          {task.command && (
            <div className="flex items-center gap-2 text-xs">
              <Terminal className="w-3 h-3 text-zinc-500" />
              <span className="text-zinc-500">Command:</span>
              <code className="text-blue-400 font-mono">{task.command}</code>
            </div>
          )}
          {task.dependsOn.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <GitBranch className="w-3 h-3 text-zinc-500" />
              <span className="text-zinc-500">Depends on:</span>
              <span className="text-zinc-400">
                Task {task.dependsOn.map((d) => d.replace('task-', '')).join(', ')}
              </span>
            </div>
          )}
          {task.error && (
            <div className="flex items-start gap-2 text-xs mt-2 p-2 bg-red-500/10 rounded border border-red-500/20">
              <X className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-red-300">{task.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PlanPreview({
  plan,
  reasoning,
  onApprove,
  onModify,
  onCancel,
  isExecuting = false,
}: PlanPreviewProps) {
  const totalComplexity = plan.tasks.reduce((sum, t) => sum + t.complexity, 0);
  const estimatedTime = Math.ceil(totalComplexity * 5); // Rough estimate: 5 seconds per complexity point
  const completedTasks = plan.tasks.filter((t) => t.status === 'completed').length;
  const progress = plan.tasks.length > 0 ? (completedTasks / plan.tasks.length) * 100 : 0;

  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{plan.summary}</h3>
          <span className="text-xs text-zinc-500">
            {plan.tasks.length} task{plan.tasks.length !== 1 ? 's' : ''}
          </span>
        </div>
        {plan.description && (
          <p className="text-sm text-zinc-400 mt-1">{plan.description}</p>
        )}
      </div>

      {/* AI Reasoning */}
      {reasoning && (
        <div className="px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/30">
          <p className="text-xs text-zinc-500 italic">
            <span className="font-medium text-zinc-400">Analysis: </span>
            {reasoning}
          </p>
        </div>
      )}

      {/* Progress Bar (during execution) */}
      {isExecuting && (
        <div className="px-4 py-2 border-b border-zinc-800/50">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Progress</span>
            <span>{completedTasks}/{plan.tasks.length} tasks</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-800/50 text-xs flex-wrap">
        <div className="flex items-center gap-1 text-zinc-400">
          <FileCode className="w-3.5 h-3.5" />
          <span>{plan.filesToCreate.length} new</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <Edit className="w-3.5 h-3.5" />
          <span>{plan.filesToModify.length} modified</span>
        </div>
        {plan.dependencies.length > 0 && (
          <div className="flex items-center gap-1 text-zinc-400">
            <Package className="w-3.5 h-3.5" />
            <span>
              {plan.dependencies.length} package
              {plan.dependencies.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-zinc-500">
          <Clock className="w-3.5 h-3.5" />
          <span>~{estimatedTime}s</span>
        </div>
      </div>

      {/* Task List */}
      <div className="p-3 space-y-2 max-h-64 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {plan.tasks.map((task, index) => (
          <TaskItem
            key={task.id}
            task={task}
            index={index}
            isExecuting={isExecuting}
          />
        ))}
      </div>

      {/* Dependencies */}
      {plan.dependencies.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800/50">
          <span className="text-xs text-zinc-500">Packages to install: </span>
          <span className="text-xs text-blue-400 font-mono">
            {plan.dependencies.join(', ')}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800/50 bg-zinc-900/30">
        <button
          onClick={onApprove}
          disabled={isExecuting}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Execute Plan
            </>
          )}
        </button>

        {onModify && !isExecuting && (
          <button
            onClick={onModify}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-sm"
          >
            <Edit className="w-4 h-4" />
            Modify
          </button>
        )}

        <button
          onClick={onCancel}
          disabled={isExecuting}
          className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-zinc-300 rounded-lg hover:bg-zinc-800/50 disabled:opacity-50 transition-colors text-sm"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// LOADING STATE
// =============================================================================

export function PlanPreviewSkeleton() {
  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        <span className="text-sm text-zinc-400">Generating plan...</span>
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-10 bg-zinc-800/50 rounded-lg animate-pulse"
            style={{ animationDelay: `${n * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// COMPACT PLAN SUMMARY (for use in messages)
// =============================================================================

interface PlanSummaryBadgeProps {
  plan: TaskPlan;
  onClick?: () => void;
}

export function PlanSummaryBadge({ plan, onClick }: PlanSummaryBadgeProps) {
  const statusColors = {
    draft: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
    approved: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
    executing: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    failed: 'border-red-500/30 bg-red-500/10 text-red-400',
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${statusColors[plan.status]} text-xs font-medium hover:opacity-80 transition-opacity`}
    >
      <FileCode className="w-3.5 h-3.5" />
      <span>{plan.summary}</span>
      <span className="opacity-60">
        ({plan.tasks.length} tasks)
      </span>
    </button>
  );
}
