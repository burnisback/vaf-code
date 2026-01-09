'use client';

/**
 * TodoList Component
 *
 * Displays real-time todo progress with status indicators.
 * Integrates with the todo system from Phase 2.
 */

import React from 'react';
import type { Todo, TodoStatus } from '@/lib/bolt/todos';

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

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
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

// =============================================================================
// TYPES
// =============================================================================

interface TodoListProps {
  /** List of todos to display */
  todos: Todo[];
  /** Title of the list */
  title?: string;
  /** Whether to show compact mode */
  compact?: boolean;
  /** Maximum items to show before collapsing */
  maxVisible?: number;
}

// =============================================================================
// STATUS ICON COMPONENT
// =============================================================================

function StatusIcon({ status }: { status: TodoStatus }) {
  switch (status) {
    case 'completed':
      return <CheckIcon className="w-4 h-4 text-emerald-400" />;
    case 'in_progress':
      return <SpinnerIcon className="w-4 h-4 text-violet-400" />;
    case 'failed':
      return <XIcon className="w-4 h-4 text-red-400" />;
    default:
      return <CircleIcon className="w-4 h-4 text-zinc-500" />;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TodoList({
  todos,
  title = 'Tasks',
  compact = false,
  maxVisible = 10,
}: TodoListProps) {
  const [expanded, setExpanded] = React.useState(false);

  // Calculate stats
  const completedCount = todos.filter(t => t.status === 'completed').length;
  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  const failedCount = todos.filter(t => t.status === 'failed').length;
  const pendingCount = todos.filter(t => t.status === 'pending').length;
  const totalCount = todos.length;

  // Progress percentage
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Visible todos
  const visibleTodos = expanded ? todos : todos.slice(0, maxVisible);
  const hasMore = todos.length > maxVisible;

  if (totalCount === 0) {
    return null;
  }

  // Compact mode for inline display
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1">
          {inProgressCount > 0 && (
            <SpinnerIcon className="w-3 h-3 text-violet-400" />
          )}
          <span className="text-zinc-400">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 rounded-lg border border-zinc-800/50 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-800/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">{title}</span>
          <div className="flex items-center gap-2 text-xs">
            {inProgressCount > 0 && (
              <span className="text-violet-400">
                {inProgressCount} in progress
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-red-400">
                {failedCount} failed
              </span>
            )}
            <span className="text-zinc-500">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              failedCount > 0
                ? 'bg-gradient-to-r from-amber-500 to-red-500'
                : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Todo List */}
      <div className="p-2 space-y-1 max-h-64 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {visibleTodos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}

        {/* Expand/Collapse Button */}
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? 'Show less' : `Show ${todos.length - maxVisible} more`}
          </button>
        )}
      </div>

      {/* Completion Status */}
      {progress === 100 && (
        <div className={`px-3 py-2 border-t border-zinc-800/50 text-sm flex items-center gap-2 ${
          failedCount > 0 ? 'bg-amber-500/5 text-amber-400' : 'bg-emerald-500/5 text-emerald-400'
        }`}>
          {failedCount > 0 ? (
            <>
              <XIcon className="w-4 h-4" />
              <span>Completed with {failedCount} error(s)</span>
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4" />
              <span>All tasks completed!</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TODO ITEM COMPONENT
// =============================================================================

interface TodoItemProps {
  todo: Todo;
}

function TodoItem({ todo }: TodoItemProps) {
  const isActive = todo.status === 'in_progress';
  const isComplete = todo.status === 'completed';
  const isFailed = todo.status === 'failed';

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
        isActive
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
        <StatusIcon status={todo.status} />
      </div>

      {/* Content */}
      <span
        className={`flex-1 text-sm truncate ${
          isComplete
            ? 'text-emerald-300'
            : isFailed
            ? 'text-red-300'
            : isActive
            ? 'text-white'
            : 'text-zinc-400'
        }`}
      >
        {isActive ? todo.activeForm : todo.content}
      </span>

      {/* Files involved */}
      {todo.files && todo.files.length > 0 && (
        <span className="text-xs text-zinc-500">
          {todo.files.length} file(s)
        </span>
      )}
    </div>
  );
}

// =============================================================================
// MINI TODO LIST (for inline display)
// =============================================================================

interface MiniTodoListProps {
  todos: Todo[];
  showCount?: number;
}

export function MiniTodoList({ todos, showCount = 3 }: MiniTodoListProps) {
  const activeTodo = todos.find(t => t.status === 'in_progress');
  const completedCount = todos.filter(t => t.status === 'completed').length;
  const totalCount = todos.length;

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {activeTodo ? (
        <>
          <SpinnerIcon className="w-3 h-3 text-violet-400" />
          <span className="text-zinc-300 truncate max-w-48">
            {activeTodo.activeForm}
          </span>
        </>
      ) : (
        <span className="text-zinc-500">
          {completedCount === totalCount ? 'All done' : 'Ready'}
        </span>
      )}
      <span className="text-zinc-500 text-xs">
        ({completedCount}/{totalCount})
      </span>
    </div>
  );
}

// =============================================================================
// CURRENT TODO DISPLAY
// =============================================================================

interface CurrentTodoProps {
  todo: Todo | undefined;
}

export function CurrentTodo({ todo }: CurrentTodoProps) {
  if (!todo) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg">
      <SpinnerIcon className="w-4 h-4 text-violet-400 flex-shrink-0" />
      <span className="text-sm text-white truncate">{todo.activeForm}</span>
    </div>
  );
}
