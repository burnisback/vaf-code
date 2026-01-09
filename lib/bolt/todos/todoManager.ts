/**
 * Todo Manager
 *
 * Core logic for managing todo state, transitions, and tracking.
 * Enforces the rule that only ONE todo can be in_progress at a time.
 */

import type {
  Todo,
  TodoList,
  TodoStatus,
  TodoType,
  TodoProgress,
  TodoTokenSummary,
  TodoEvent,
  TodoEventCallback,
} from './types';
import type { RequestMode } from '../ai/classifier/types';
import type { ModelTier } from '../ai/modelRouter/types';
import { MODEL_PRICING } from '../ai/modelRouter/types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique ID for todos
 */
function generateId(prefix: string = 'todo'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// TODO MANAGER CLASS
// =============================================================================

/**
 * Manages todo state and transitions
 */
export class TodoManager {
  private list: TodoList;
  private listeners: Set<TodoEventCallback> = new Set();

  constructor(mode: RequestMode = 'simple') {
    this.list = {
      id: generateId('list'),
      mode,
      todos: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  /**
   * Subscribe to todo events
   */
  subscribe(callback: TodoEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: TodoEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        console.error('[TodoManager] Listener error:', e);
      }
    });
  }

  // ===========================================================================
  // TODO CREATION
  // ===========================================================================

  /**
   * Create a new todo and add it to the list
   */
  createTodo(
    content: string,
    activeForm: string,
    type: TodoType,
    options: {
      model?: ModelTier;
      files?: string[];
      phase?: number;
    } = {}
  ): Todo {
    const todo: Todo = {
      id: generateId(),
      content,
      activeForm,
      status: 'pending',
      type,
      model: options.model,
      files: options.files,
      phase: options.phase,
    };

    this.list.todos.push(todo);
    this.list.updatedAt = Date.now();

    this.emit({ type: 'todo_created', todo });
    this.emit({ type: 'progress_updated', progress: this.getProgress() });

    return todo;
  }

  /**
   * Create multiple todos at once
   */
  createTodos(
    todos: Array<{
      content: string;
      activeForm: string;
      type: TodoType;
      model?: ModelTier;
      files?: string[];
      phase?: number;
    }>
  ): Todo[] {
    return todos.map((t) =>
      this.createTodo(t.content, t.activeForm, t.type, {
        model: t.model,
        files: t.files,
        phase: t.phase,
      })
    );
  }

  // ===========================================================================
  // TODO STATE TRANSITIONS
  // ===========================================================================

  /**
   * Start a todo (mark as in_progress)
   * Enforces only ONE in_progress at a time
   */
  startTodo(id: string): boolean {
    // Check if another todo is already in progress
    const inProgress = this.list.todos.find((t) => t.status === 'in_progress');
    if (inProgress) {
      console.warn(
        `[TodoManager] Cannot start ${id}: ${inProgress.id} is already in progress`
      );
      return false;
    }

    const todo = this.list.todos.find((t) => t.id === id);
    if (!todo) {
      console.warn(`[TodoManager] Todo not found: ${id}`);
      return false;
    }

    if (todo.status !== 'pending') {
      console.warn(`[TodoManager] Cannot start ${id}: status is ${todo.status}`);
      return false;
    }

    todo.status = 'in_progress';
    todo.startedAt = Date.now();
    this.list.currentTodoId = id;
    this.list.updatedAt = Date.now();

    this.emit({ type: 'todo_started', todoId: id });
    this.emit({ type: 'progress_updated', progress: this.getProgress() });

    return true;
  }

  /**
   * Complete a todo (mark as completed)
   */
  completeTodo(id: string, evidence?: string): boolean {
    const todo = this.list.todos.find((t) => t.id === id);
    if (!todo) {
      console.warn(`[TodoManager] Todo not found: ${id}`);
      return false;
    }

    if (todo.status !== 'in_progress') {
      console.warn(`[TodoManager] Cannot complete ${id}: status is ${todo.status}`);
      return false;
    }

    todo.status = 'completed';
    todo.completedAt = Date.now();
    todo.evidence = evidence;

    // Clear current if this was it
    if (this.list.currentTodoId === id) {
      this.list.currentTodoId = undefined;
    }
    this.list.updatedAt = Date.now();

    this.emit({ type: 'todo_completed', todoId: id, evidence });
    this.emit({ type: 'progress_updated', progress: this.getProgress() });

    return true;
  }

  /**
   * Fail a todo (mark as failed)
   */
  failTodo(id: string, error: string): boolean {
    const todo = this.list.todos.find((t) => t.id === id);
    if (!todo) {
      console.warn(`[TodoManager] Todo not found: ${id}`);
      return false;
    }

    if (todo.status !== 'in_progress') {
      console.warn(`[TodoManager] Cannot fail ${id}: status is ${todo.status}`);
      return false;
    }

    todo.status = 'failed';
    todo.completedAt = Date.now();
    todo.error = error;

    // Clear current if this was it
    if (this.list.currentTodoId === id) {
      this.list.currentTodoId = undefined;
    }
    this.list.updatedAt = Date.now();

    this.emit({ type: 'todo_failed', todoId: id, error });
    this.emit({ type: 'progress_updated', progress: this.getProgress() });

    return true;
  }

  /**
   * Record token usage for a todo
   */
  recordTokens(id: string, input: number, output: number, model?: ModelTier): void {
    const todo = this.list.todos.find((t) => t.id === id);
    if (!todo) return;

    todo.tokens = { input, output };
    if (model) todo.model = model;
    this.list.updatedAt = Date.now();
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /**
   * Get the current in-progress todo
   */
  getCurrentTodo(): Todo | null {
    return this.list.todos.find((t) => t.status === 'in_progress') || null;
  }

  /**
   * Get all todos
   */
  getAllTodos(): Todo[] {
    return [...this.list.todos];
  }

  /**
   * Get the full list
   */
  getList(): TodoList {
    return { ...this.list };
  }

  /**
   * Get a specific todo by ID
   */
  getTodo(id: string): Todo | null {
    return this.list.todos.find((t) => t.id === id) || null;
  }

  /**
   * Get the next pending todo
   */
  getNextPending(): Todo | null {
    return this.list.todos.find((t) => t.status === 'pending') || null;
  }

  /**
   * Get progress summary
   */
  getProgress(): TodoProgress {
    const todos = this.list.todos;
    const total = todos.length;
    const completed = todos.filter((t) => t.status === 'completed').length;
    const failed = todos.filter((t) => t.status === 'failed').length;
    const pending = todos.filter((t) => t.status === 'pending').length;
    const current = this.getCurrentTodo() || undefined;

    return {
      total,
      completed,
      failed,
      pending,
      current,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Get token summary
   */
  getTokenSummary(): TodoTokenSummary {
    const summary: TodoTokenSummary = {
      totalInput: 0,
      totalOutput: 0,
      byTier: {
        'flash-lite': { input: 0, output: 0 },
        'flash': { input: 0, output: 0 },
        'pro': { input: 0, output: 0 },
      },
      estimatedCost: 0,
    };

    for (const todo of this.list.todos) {
      if (todo.tokens) {
        summary.totalInput += todo.tokens.input;
        summary.totalOutput += todo.tokens.output;

        const tier = todo.model || 'flash';
        summary.byTier[tier].input += todo.tokens.input;
        summary.byTier[tier].output += todo.tokens.output;
      }
    }

    // Calculate cost
    for (const tier of Object.keys(summary.byTier) as ModelTier[]) {
      const tokens = summary.byTier[tier];
      const pricing = MODEL_PRICING[tier];
      summary.estimatedCost +=
        (tokens.input / 1_000_000) * pricing.inputPer1M +
        (tokens.output / 1_000_000) * pricing.outputPer1M;
    }

    return summary;
  }

  // ===========================================================================
  // LIST MANAGEMENT
  // ===========================================================================

  /**
   * Reset the todo list (start fresh)
   */
  reset(mode?: RequestMode): void {
    this.list = {
      id: generateId('list'),
      mode: mode || this.list.mode,
      todos: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.emit({ type: 'todos_reset' });
    this.emit({ type: 'progress_updated', progress: this.getProgress() });
  }

  /**
   * Remove a pending todo (only pending can be removed)
   */
  removeTodo(id: string): boolean {
    const index = this.list.todos.findIndex((t) => t.id === id);
    if (index === -1) return false;

    const todo = this.list.todos[index];
    if (todo.status !== 'pending') {
      console.warn(`[TodoManager] Cannot remove ${id}: status is ${todo.status}`);
      return false;
    }

    this.list.todos.splice(index, 1);
    this.list.updatedAt = Date.now();
    this.emit({ type: 'progress_updated', progress: this.getProgress() });

    return true;
  }

  /**
   * Insert a todo at a specific position
   */
  insertTodoAt(
    index: number,
    content: string,
    activeForm: string,
    type: TodoType,
    options: { model?: ModelTier; files?: string[] } = {}
  ): Todo {
    const todo: Todo = {
      id: generateId(),
      content,
      activeForm,
      status: 'pending',
      type,
      model: options.model,
      files: options.files,
    };

    this.list.todos.splice(index, 0, todo);
    this.list.updatedAt = Date.now();

    this.emit({ type: 'todo_created', todo });
    this.emit({ type: 'progress_updated', progress: this.getProgress() });

    return todo;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new TodoManager instance
 */
export function createTodoManager(mode: RequestMode = 'simple'): TodoManager {
  return new TodoManager(mode);
}
