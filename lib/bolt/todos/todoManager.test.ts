/**
 * Todo Manager Tests
 *
 * Comprehensive test suite for the todo management system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TodoManager,
  createTodoManager,
  generateTodosForMode,
  generateQuestionTodos,
  generateSimpleTodos,
  generateModerateTodos,
  generateComplexTodos,
  generateMegaComplexTodos,
  generateDebugTodos,
} from './index';
import type { TodoEvent } from './types';

describe('Todo Manager', () => {
  let manager: TodoManager;

  beforeEach(() => {
    manager = createTodoManager('simple');
  });

  // ===========================================================================
  // CREATION TESTS
  // ===========================================================================

  describe('createTodo', () => {
    it('should create a todo with unique ID', () => {
      const todo = manager.createTodo('Test todo', 'Testing', 'execute');

      expect(todo.id).toBeDefined();
      expect(todo.id).toMatch(/^todo_\d+_[a-z0-9]+$/);
    });

    it('should create a todo with pending status', () => {
      const todo = manager.createTodo('Test todo', 'Testing', 'execute');

      expect(todo.status).toBe('pending');
    });

    it('should create a todo with correct content', () => {
      const todo = manager.createTodo('Test content', 'Testing content', 'investigate');

      expect(todo.content).toBe('Test content');
      expect(todo.activeForm).toBe('Testing content');
      expect(todo.type).toBe('investigate');
    });

    it('should add todo to the list', () => {
      manager.createTodo('Test todo', 'Testing', 'execute');

      expect(manager.getAllTodos()).toHaveLength(1);
    });

    it('should handle optional model parameter', () => {
      const todo = manager.createTodo('Test todo', 'Testing', 'execute', {
        model: 'flash-lite',
      });

      expect(todo.model).toBe('flash-lite');
    });

    it('should handle optional files parameter', () => {
      const todo = manager.createTodo('Test todo', 'Testing', 'execute', {
        files: ['file1.ts', 'file2.ts'],
      });

      expect(todo.files).toEqual(['file1.ts', 'file2.ts']);
    });
  });

  describe('createTodos', () => {
    it('should create multiple todos at once', () => {
      const todos = manager.createTodos([
        { content: 'Todo 1', activeForm: 'Doing 1', type: 'investigate' },
        { content: 'Todo 2', activeForm: 'Doing 2', type: 'execute' },
        { content: 'Todo 3', activeForm: 'Doing 3', type: 'verify' },
      ]);

      expect(todos).toHaveLength(3);
      expect(manager.getAllTodos()).toHaveLength(3);
    });

    it('should assign unique IDs to each todo', () => {
      const todos = manager.createTodos([
        { content: 'Todo 1', activeForm: 'Doing 1', type: 'investigate' },
        { content: 'Todo 2', activeForm: 'Doing 2', type: 'execute' },
      ]);

      expect(todos[0].id).not.toBe(todos[1].id);
    });
  });

  // ===========================================================================
  // STATE TRANSITION TESTS
  // ===========================================================================

  describe('startTodo', () => {
    it('should change status to in_progress', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);

      expect(manager.getTodo(todo.id)?.status).toBe('in_progress');
    });

    it('should set startedAt timestamp', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      const before = Date.now();
      manager.startTodo(todo.id);
      const after = Date.now();

      const started = manager.getTodo(todo.id)?.startedAt;
      expect(started).toBeGreaterThanOrEqual(before);
      expect(started).toBeLessThanOrEqual(after);
    });

    it('should only allow ONE in_progress todo at a time', () => {
      const todo1 = manager.createTodo('Todo 1', 'Doing 1', 'execute');
      const todo2 = manager.createTodo('Todo 2', 'Doing 2', 'execute');

      manager.startTodo(todo1.id);
      const result = manager.startTodo(todo2.id);

      expect(result).toBe(false);
      expect(manager.getTodo(todo1.id)?.status).toBe('in_progress');
      expect(manager.getTodo(todo2.id)?.status).toBe('pending');
    });

    it('should not start non-pending todo', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);
      manager.completeTodo(todo.id);

      const result = manager.startTodo(todo.id);

      expect(result).toBe(false);
    });

    it('should return false for non-existent todo', () => {
      const result = manager.startTodo('non_existent_id');

      expect(result).toBe(false);
    });
  });

  describe('completeTodo', () => {
    it('should change status to completed', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);
      manager.completeTodo(todo.id);

      expect(manager.getTodo(todo.id)?.status).toBe('completed');
    });

    it('should set completedAt timestamp', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);
      const before = Date.now();
      manager.completeTodo(todo.id);
      const after = Date.now();

      const completed = manager.getTodo(todo.id)?.completedAt;
      expect(completed).toBeGreaterThanOrEqual(before);
      expect(completed).toBeLessThanOrEqual(after);
    });

    it('should add evidence if provided', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);
      manager.completeTodo(todo.id, 'Found 3 files');

      expect(manager.getTodo(todo.id)?.evidence).toBe('Found 3 files');
    });

    it('should clear currentTodoId', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);
      manager.completeTodo(todo.id);

      expect(manager.getCurrentTodo()).toBeNull();
    });

    it('should only complete in_progress todos', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      const result = manager.completeTodo(todo.id);

      expect(result).toBe(false);
      expect(manager.getTodo(todo.id)?.status).toBe('pending');
    });
  });

  describe('failTodo', () => {
    it('should change status to failed', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);
      manager.failTodo(todo.id, 'Something went wrong');

      expect(manager.getTodo(todo.id)?.status).toBe('failed');
    });

    it('should set error message', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);
      manager.failTodo(todo.id, 'Error message');

      expect(manager.getTodo(todo.id)?.error).toBe('Error message');
    });

    it('should only fail in_progress todos', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      const result = manager.failTodo(todo.id, 'Error');

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // QUERY TESTS
  // ===========================================================================

  describe('getCurrentTodo', () => {
    it('should return null when no todo is in progress', () => {
      manager.createTodo('Test', 'Testing', 'execute');

      expect(manager.getCurrentTodo()).toBeNull();
    });

    it('should return the in_progress todo', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);

      expect(manager.getCurrentTodo()?.id).toBe(todo.id);
    });
  });

  describe('getNextPending', () => {
    it('should return the first pending todo', () => {
      const todo1 = manager.createTodo('Todo 1', 'Doing 1', 'execute');
      manager.createTodo('Todo 2', 'Doing 2', 'execute');
      manager.startTodo(todo1.id);
      manager.completeTodo(todo1.id);

      const next = manager.getNextPending();
      expect(next?.content).toBe('Todo 2');
    });

    it('should return null when no pending todos', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);
      manager.completeTodo(todo.id);

      expect(manager.getNextPending()).toBeNull();
    });
  });

  describe('getProgress', () => {
    it('should return correct counts', () => {
      manager.createTodos([
        { content: 'Todo 1', activeForm: 'Doing 1', type: 'execute' },
        { content: 'Todo 2', activeForm: 'Doing 2', type: 'execute' },
        { content: 'Todo 3', activeForm: 'Doing 3', type: 'execute' },
        { content: 'Todo 4', activeForm: 'Doing 4', type: 'execute' },
      ]);

      const todos = manager.getAllTodos();
      manager.startTodo(todos[0].id);
      manager.completeTodo(todos[0].id);
      manager.startTodo(todos[1].id);
      manager.failTodo(todos[1].id, 'Error');

      const progress = manager.getProgress();

      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(1);
      expect(progress.failed).toBe(1);
      expect(progress.pending).toBe(2);
    });

    it('should calculate correct percentage', () => {
      manager.createTodos([
        { content: 'Todo 1', activeForm: 'Doing 1', type: 'execute' },
        { content: 'Todo 2', activeForm: 'Doing 2', type: 'execute' },
        { content: 'Todo 3', activeForm: 'Doing 3', type: 'execute' },
        { content: 'Todo 4', activeForm: 'Doing 4', type: 'execute' },
      ]);

      const todos = manager.getAllTodos();
      manager.startTodo(todos[0].id);
      manager.completeTodo(todos[0].id);
      manager.startTodo(todos[1].id);
      manager.completeTodo(todos[1].id);

      const progress = manager.getProgress();

      expect(progress.percentage).toBe(50);
    });
  });

  // ===========================================================================
  // TOKEN TRACKING TESTS
  // ===========================================================================

  describe('recordTokens', () => {
    it('should record token usage on todo', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.recordTokens(todo.id, 1000, 500, 'flash');

      const updated = manager.getTodo(todo.id);
      expect(updated?.tokens).toEqual({ input: 1000, output: 500 });
      expect(updated?.model).toBe('flash');
    });
  });

  describe('getTokenSummary', () => {
    it('should aggregate tokens correctly', () => {
      const todo1 = manager.createTodo('Test 1', 'Testing 1', 'execute');
      const todo2 = manager.createTodo('Test 2', 'Testing 2', 'verify');

      manager.recordTokens(todo1.id, 1000, 500, 'flash');
      manager.recordTokens(todo2.id, 500, 200, 'flash-lite');

      const summary = manager.getTokenSummary();

      expect(summary.totalInput).toBe(1500);
      expect(summary.totalOutput).toBe(700);
      expect(summary.byTier['flash'].input).toBe(1000);
      expect(summary.byTier['flash-lite'].input).toBe(500);
    });

    it('should calculate estimated cost', () => {
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.recordTokens(todo.id, 1_000_000, 1_000_000, 'flash');

      const summary = manager.getTokenSummary();

      // Flash: $0.30 input + $2.50 output = $2.80 per 1M
      expect(summary.estimatedCost).toBeCloseTo(2.80);
    });
  });

  // ===========================================================================
  // EVENT TESTS
  // ===========================================================================

  describe('events', () => {
    it('should emit todo_created event', () => {
      const callback = vi.fn();
      manager.subscribe(callback);

      manager.createTodo('Test', 'Testing', 'execute');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'todo_created' })
      );
    });

    it('should emit todo_started event', () => {
      const callback = vi.fn();
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.subscribe(callback);

      manager.startTodo(todo.id);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'todo_started', todoId: todo.id })
      );
    });

    it('should emit todo_completed event', () => {
      const callback = vi.fn();
      const todo = manager.createTodo('Test', 'Testing', 'execute');
      manager.startTodo(todo.id);
      manager.subscribe(callback);

      manager.completeTodo(todo.id, 'Evidence');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'todo_completed',
          todoId: todo.id,
          evidence: 'Evidence',
        })
      );
    });

    it('should emit progress_updated on state changes', () => {
      const callback = vi.fn();
      manager.subscribe(callback);

      manager.createTodo('Test', 'Testing', 'execute');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'progress_updated' })
      );
    });

    it('should allow unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe(callback);

      unsubscribe();
      manager.createTodo('Test', 'Testing', 'execute');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // RESET TESTS
  // ===========================================================================

  describe('reset', () => {
    it('should clear all todos', () => {
      manager.createTodos([
        { content: 'Todo 1', activeForm: 'Doing 1', type: 'execute' },
        { content: 'Todo 2', activeForm: 'Doing 2', type: 'execute' },
      ]);

      manager.reset();

      expect(manager.getAllTodos()).toHaveLength(0);
    });

    it('should emit todos_reset event', () => {
      const callback = vi.fn();
      manager.subscribe(callback);

      manager.reset();

      expect(callback).toHaveBeenCalledWith({ type: 'todos_reset' });
    });
  });
});

// =============================================================================
// GENERATOR TESTS
// =============================================================================

describe('Todo Generators', () => {
  let manager: TodoManager;

  beforeEach(() => {
    manager = createTodoManager('simple');
  });

  describe('generateQuestionTodos', () => {
    it('should generate 2 todos for question mode', () => {
      const todos = generateQuestionTodos(manager, 'What does this do?');

      expect(todos).toHaveLength(2);
    });

    it('should use flash-lite model', () => {
      const todos = generateQuestionTodos(manager, 'What does this do?');

      expect(todos.every((t) => t.model === 'flash-lite')).toBe(true);
    });
  });

  describe('generateSimpleTodos', () => {
    it('should generate 4 todos for simple mode', () => {
      const todos = generateSimpleTodos(manager, 'Add console.log to handleClick');

      expect(todos).toHaveLength(4);
    });

    it('should have investigate, read, execute, verify types in order', () => {
      const todos = generateSimpleTodos(manager, 'Test prompt');

      expect(todos[0].type).toBe('investigate');
      expect(todos[1].type).toBe('read');
      expect(todos[2].type).toBe('execute');
      expect(todos[3].type).toBe('verify');
    });
  });

  describe('generateModerateTodos', () => {
    it('should generate 8+ todos for moderate mode', () => {
      const todos = generateModerateTodos(manager, 'Add dark mode toggle');

      expect(todos.length).toBeGreaterThanOrEqual(8);
    });

    it('should include investigation, planning, and verification phases', () => {
      const todos = generateModerateTodos(manager, 'Add dark mode toggle');
      const types = todos.map((t) => t.type);

      expect(types.filter((t) => t === 'investigate').length).toBeGreaterThanOrEqual(2);
      expect(types).toContain('plan');
      expect(types).toContain('verify');
    });
  });

  describe('generateComplexTodos', () => {
    it('should generate 15+ todos for complex mode', () => {
      const todos = generateComplexTodos(manager, 'Add user authentication');

      expect(todos.length).toBeGreaterThanOrEqual(15);
    });

    it('should include architecture phase with pro model', () => {
      const todos = generateComplexTodos(manager, 'Add authentication');
      const archTodo = todos.find((t) => t.type === 'architecture');

      expect(archTodo).toBeDefined();
      expect(archTodo?.model).toBe('pro');
    });

    it('should include approval checkpoints', () => {
      const todos = generateComplexTodos(manager, 'Add authentication');
      const approvals = todos.filter((t) => t.type === 'approve');

      expect(approvals.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateMegaComplexTodos', () => {
    it('should generate todos for mega-complex mode', () => {
      const todos = generateMegaComplexTodos(manager, 'Build e-commerce platform');

      expect(todos.length).toBeGreaterThanOrEqual(8);
    });

    it('should include research, PRD, and architecture phases', () => {
      const todos = generateMegaComplexTodos(manager, 'Build platform');
      const types = todos.map((t) => t.type);

      expect(types).toContain('research');
      expect(types).toContain('prd');
      expect(types).toContain('architecture');
    });

    it('should include multiple approval checkpoints', () => {
      const todos = generateMegaComplexTodos(manager, 'Build platform');
      const approvals = todos.filter((t) => t.type === 'approve');

      expect(approvals.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('generateDebugTodos', () => {
    it('should generate 7 todos for debug mode', () => {
      const todos = generateDebugTodos(manager);

      expect(todos).toHaveLength(7);
    });

    it('should have error collection, analysis, and fix phases', () => {
      const todos = generateDebugTodos(manager);

      expect(todos[0].content).toContain('Collect');
      expect(todos[1].content).toContain('categorize');
      expect(todos[5].content).toContain('fix');
      expect(todos[6].type).toBe('verify');
    });
  });

  describe('generateTodosForMode', () => {
    it('should dispatch to correct generator based on mode', () => {
      const questionTodos = generateTodosForMode(createTodoManager('question'), {
        mode: 'question',
        prompt: 'What is this?',
      });
      expect(questionTodos).toHaveLength(2);

      const simpleTodos = generateTodosForMode(createTodoManager('simple'), {
        mode: 'simple',
        prompt: 'Add feature',
      });
      expect(simpleTodos).toHaveLength(4);
    });

    it('should use debug generator when isDebug is true', () => {
      const todos = generateTodosForMode(createTodoManager('simple'), {
        mode: 'simple',
        prompt: 'Fix the bug',
        isDebug: true,
      });

      expect(todos).toHaveLength(7);
      expect(todos[0].content).toContain('Collect');
    });
  });
});
