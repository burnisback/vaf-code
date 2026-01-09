/**
 * useTodos Hook
 *
 * React hook for integrating the todo system with UI components.
 * Provides state management, event handling, and progress tracking.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  TodoManager,
  createTodoManager,
  generateTodosForMode,
  type Todo,
  type TodoProgress,
  type TodoTokenSummary,
  type TodoEvent,
  type TodoGeneratorConfig,
} from '@/lib/bolt/todos';
import type { RequestMode } from '@/lib/bolt/ai/classifier/types';
import type { ModelTier } from '@/lib/bolt/ai/modelRouter/types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseTodosReturn {
  /** All current todos */
  todos: Todo[];

  /** Current in-progress todo (if any) */
  currentTodo: Todo | null;

  /** Progress summary */
  progress: TodoProgress;

  /** Token/cost summary */
  tokenSummary: TodoTokenSummary;

  /** Initialize todos for a new request */
  initTodos: (config: TodoGeneratorConfig) => Todo[];

  /** Start the next pending todo */
  startNextTodo: () => boolean;

  /** Start a specific todo by ID */
  startTodo: (id: string) => boolean;

  /** Complete the current todo */
  completeTodo: (evidence?: string) => boolean;

  /** Complete a specific todo by ID */
  completeTodoById: (id: string, evidence?: string) => boolean;

  /** Fail the current todo */
  failTodo: (error: string) => boolean;

  /** Fail a specific todo by ID */
  failTodoById: (id: string, error: string) => boolean;

  /** Record token usage for a todo */
  recordTokens: (id: string, input: number, output: number, model?: ModelTier) => void;

  /** Reset all todos */
  reset: (mode?: RequestMode) => void;

  /** Add a custom todo */
  addTodo: (
    content: string,
    activeForm: string,
    type: Todo['type'],
    options?: { model?: ModelTier; files?: string[] }
  ) => Todo;

  /** Get todo by ID */
  getTodo: (id: string) => Todo | null;

  /** Check if all todos are complete */
  isComplete: boolean;

  /** Check if any todos have failed */
  hasFailed: boolean;

  /** Current mode */
  mode: RequestMode;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useTodos(initialMode: RequestMode = 'simple'): UseTodosReturn {
  // Manager ref (persists across renders)
  const managerRef = useRef<TodoManager | null>(null);

  // Initialize manager if needed
  if (!managerRef.current) {
    managerRef.current = createTodoManager(initialMode);
  }

  const manager = managerRef.current;

  // State
  const [todos, setTodos] = useState<Todo[]>([]);
  const [currentTodo, setCurrentTodo] = useState<Todo | null>(null);
  const [progress, setProgress] = useState<TodoProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    percentage: 0,
  });
  const [tokenSummary, setTokenSummary] = useState<TodoTokenSummary>({
    totalInput: 0,
    totalOutput: 0,
    byTier: {
      'flash-lite': { input: 0, output: 0 },
      'flash': { input: 0, output: 0 },
      'pro': { input: 0, output: 0 },
    },
    estimatedCost: 0,
  });
  const [mode, setMode] = useState<RequestMode>(initialMode);

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  // Subscribe to manager events
  useEffect(() => {
    const unsubscribe = manager.subscribe((event: TodoEvent) => {
      // Update state based on event
      switch (event.type) {
        case 'todo_created':
        case 'todo_started':
        case 'todo_completed':
        case 'todo_failed':
        case 'todos_reset':
          setTodos(manager.getAllTodos());
          setCurrentTodo(manager.getCurrentTodo());
          setTokenSummary(manager.getTokenSummary());
          break;

        case 'progress_updated':
          setProgress(event.progress);
          break;
      }
    });

    return unsubscribe;
  }, [manager]);

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  const initTodos = useCallback(
    (config: TodoGeneratorConfig): Todo[] => {
      // Reset manager with new mode
      manager.reset(config.mode);
      setMode(config.mode);

      // Generate todos for the mode
      const newTodos = generateTodosForMode(manager, config);

      // Update state
      setTodos(manager.getAllTodos());
      setProgress(manager.getProgress());
      setTokenSummary(manager.getTokenSummary());

      return newTodos;
    },
    [manager]
  );

  // ===========================================================================
  // TODO OPERATIONS
  // ===========================================================================

  const startNextTodo = useCallback((): boolean => {
    const next = manager.getNextPending();
    if (!next) return false;
    return manager.startTodo(next.id);
  }, [manager]);

  const startTodo = useCallback(
    (id: string): boolean => {
      return manager.startTodo(id);
    },
    [manager]
  );

  const completeTodo = useCallback(
    (evidence?: string): boolean => {
      const current = manager.getCurrentTodo();
      if (!current) return false;
      return manager.completeTodo(current.id, evidence);
    },
    [manager]
  );

  const completeTodoById = useCallback(
    (id: string, evidence?: string): boolean => {
      return manager.completeTodo(id, evidence);
    },
    [manager]
  );

  const failTodo = useCallback(
    (error: string): boolean => {
      const current = manager.getCurrentTodo();
      if (!current) return false;
      return manager.failTodo(current.id, error);
    },
    [manager]
  );

  const failTodoById = useCallback(
    (id: string, error: string): boolean => {
      return manager.failTodo(id, error);
    },
    [manager]
  );

  const recordTokens = useCallback(
    (id: string, input: number, output: number, model?: ModelTier): void => {
      manager.recordTokens(id, input, output, model);
      setTokenSummary(manager.getTokenSummary());
    },
    [manager]
  );

  const reset = useCallback(
    (newMode?: RequestMode): void => {
      manager.reset(newMode || mode);
      if (newMode) setMode(newMode);
      setTodos([]);
      setCurrentTodo(null);
    },
    [manager, mode]
  );

  const addTodo = useCallback(
    (
      content: string,
      activeForm: string,
      type: Todo['type'],
      options?: { model?: ModelTier; files?: string[] }
    ): Todo => {
      return manager.createTodo(content, activeForm, type, options);
    },
    [manager]
  );

  const getTodo = useCallback(
    (id: string): Todo | null => {
      return manager.getTodo(id);
    },
    [manager]
  );

  // ===========================================================================
  // COMPUTED VALUES
  // ===========================================================================

  const isComplete = todos.length > 0 && todos.every(
    (t) => t.status === 'completed' || t.status === 'failed'
  );

  const hasFailed = todos.some((t) => t.status === 'failed');

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    todos,
    currentTodo,
    progress,
    tokenSummary,
    initTodos,
    startNextTodo,
    startTodo,
    completeTodo,
    completeTodoById,
    failTodo,
    failTodoById,
    recordTokens,
    reset,
    addTodo,
    getTodo,
    isComplete,
    hasFailed,
    mode,
  };
}

// =============================================================================
// HELPER HOOKS
// =============================================================================

/**
 * Hook to watch a specific todo by ID
 */
export function useTodo(todoId: string | undefined, todos: Todo[]): Todo | null {
  if (!todoId) return null;
  return todos.find((t) => t.id === todoId) || null;
}

/**
 * Hook to get formatted progress string
 */
export function useProgressText(progress: TodoProgress): string {
  if (progress.total === 0) return '';
  return `${progress.completed}/${progress.total} (${progress.percentage}%)`;
}

/**
 * Hook to get formatted cost string
 */
export function useCostText(tokenSummary: TodoTokenSummary): string {
  return `$${tokenSummary.estimatedCost.toFixed(4)}`;
}
