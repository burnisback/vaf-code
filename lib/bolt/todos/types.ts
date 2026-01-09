/**
 * Todo System Types
 *
 * Type definitions for the visible, real-time todo tracking system.
 * Todos provide transparency into what the AI is doing at each step.
 */

import type { RequestMode } from '../ai/classifier/types';
import type { ModelTier } from '../ai/modelRouter/types';

// =============================================================================
// STATUS TYPES
// =============================================================================

/**
 * Status of a single todo item
 */
export type TodoStatus =
  | 'pending'      // Not yet started
  | 'in_progress'  // Currently being worked on (only ONE at a time)
  | 'completed'    // Successfully finished
  | 'failed';      // Failed with error

/**
 * Type of todo item (determines what the AI does)
 */
export type TodoType =
  | 'investigate'  // Search/explore codebase
  | 'read'         // Read specific file(s)
  | 'plan'         // Create execution plan
  | 'execute'      // Generate/modify code
  | 'verify'       // Run verification checks
  | 'research'     // Web research (mega-complex)
  | 'prd'          // PRD generation (mega-complex)
  | 'architecture' // Architecture design (mega-complex)
  | 'approve';     // Await user approval

// =============================================================================
// TODO ITEM
// =============================================================================

/**
 * A single todo item in the task list
 */
export interface Todo {
  /** Unique identifier */
  id: string;

  /** What needs to be done (imperative form, e.g., "Search for handleClick") */
  content: string;

  /** Present continuous form for display (e.g., "Searching for handleClick") */
  activeForm: string;

  /** Current status */
  status: TodoStatus;

  /** Type of todo (determines AI action) */
  type: TodoType;

  /** Evidence/findings from this todo (filled on completion) */
  evidence?: string;

  /** Model tier used for this todo */
  model?: ModelTier;

  /** Token usage for this todo */
  tokens?: {
    input: number;
    output: number;
  };

  /** Timestamp when todo started */
  startedAt?: number;

  /** Timestamp when todo completed */
  completedAt?: number;

  /** Error message if failed */
  error?: string;

  /** File paths involved (if any) */
  files?: string[];

  /** Phase number for mega-complex (e.g., phase 1, 2, 3) */
  phase?: number;
}

// =============================================================================
// TODO LIST
// =============================================================================

/**
 * A complete todo list for a request
 */
export interface TodoList {
  /** Unique identifier for this list */
  id: string;

  /** Request mode that generated this list */
  mode: RequestMode;

  /** All todos in order */
  todos: Todo[];

  /** Current todo being executed (id) */
  currentTodoId?: string;

  /** When the list was created */
  createdAt: number;

  /** When the list was last updated */
  updatedAt: number;
}

// =============================================================================
// PROGRESS TRACKING
// =============================================================================

/**
 * Progress summary for UI display
 */
export interface TodoProgress {
  /** Total number of todos */
  total: number;

  /** Number of completed todos */
  completed: number;

  /** Number of failed todos */
  failed: number;

  /** Number of pending todos */
  pending: number;

  /** Current todo (if any) */
  current?: Todo;

  /** Progress percentage (0-100) */
  percentage: number;

  /** Estimated time remaining (if calculable) */
  estimatedTimeRemaining?: number;
}

// =============================================================================
// TOKEN & COST TRACKING
// =============================================================================

/**
 * Aggregated token usage across all todos
 */
export interface TodoTokenSummary {
  /** Total input tokens */
  totalInput: number;

  /** Total output tokens */
  totalOutput: number;

  /** Tokens by model tier */
  byTier: Record<ModelTier, { input: number; output: number }>;

  /** Estimated total cost */
  estimatedCost: number;
}

// =============================================================================
// EVENTS
// =============================================================================

/**
 * Event emitted when todo state changes
 */
export type TodoEvent =
  | { type: 'todo_created'; todo: Todo }
  | { type: 'todo_started'; todoId: string }
  | { type: 'todo_completed'; todoId: string; evidence?: string }
  | { type: 'todo_failed'; todoId: string; error: string }
  | { type: 'todos_reset' }
  | { type: 'progress_updated'; progress: TodoProgress };

/**
 * Callback for todo events
 */
export type TodoEventCallback = (event: TodoEvent) => void;

// =============================================================================
// GENERATOR CONFIG
// =============================================================================

/**
 * Configuration for generating todos for a specific mode
 */
export interface TodoGeneratorConfig {
  /** Mode to generate for */
  mode: RequestMode;

  /** User prompt (for context-aware generation) */
  prompt: string;

  /** Whether this is a debug/error-fix request */
  isDebug?: boolean;

  /** Errors to fix (if debug mode) */
  errors?: string[];

  /** Complexity score (for fine-tuning todo count) */
  complexityScore?: number;
}

// =============================================================================
// TEMPLATES
// =============================================================================

/**
 * Todo template for common patterns
 */
export interface TodoTemplate {
  /** Template content (with placeholders) */
  content: string;

  /** Active form template */
  activeForm: string;

  /** Todo type */
  type: TodoType;

  /** Optional model tier override */
  model?: ModelTier;
}

/**
 * Standard todo templates by type
 */
export const TODO_TEMPLATES: Record<string, TodoTemplate> = {
  // Investigation templates
  search: {
    content: 'Search for {target} in the codebase',
    activeForm: 'Searching for {target}',
    type: 'investigate',
    model: 'flash-lite',
  },
  read: {
    content: 'Read {file} to understand its structure',
    activeForm: 'Reading {file}',
    type: 'read',
    model: 'flash-lite',
  },
  analyze: {
    content: 'Analyze {target} for {purpose}',
    activeForm: 'Analyzing {target}',
    type: 'investigate',
    model: 'flash-lite',
  },

  // Planning templates
  plan: {
    content: 'Create implementation plan for {feature}',
    activeForm: 'Planning {feature}',
    type: 'plan',
    model: 'flash',
  },

  // Execution templates
  create: {
    content: 'Create {file}',
    activeForm: 'Creating {file}',
    type: 'execute',
    model: 'flash',
  },
  modify: {
    content: 'Update {file} to {change}',
    activeForm: 'Updating {file}',
    type: 'execute',
    model: 'flash',
  },
  implement: {
    content: 'Implement {feature}',
    activeForm: 'Implementing {feature}',
    type: 'execute',
    model: 'flash',
  },

  // Verification templates
  verify: {
    content: 'Verify changes compile without errors',
    activeForm: 'Verifying changes',
    type: 'verify',
    model: 'flash-lite',
  },
  test: {
    content: 'Run tests to confirm functionality',
    activeForm: 'Running tests',
    type: 'verify',
    model: 'flash-lite',
  },

  // Debug templates
  collectErrors: {
    content: 'Collect all error information',
    activeForm: 'Collecting error information',
    type: 'investigate',
    model: 'flash-lite',
  },
  analyzeErrors: {
    content: 'Analyze errors to identify root cause',
    activeForm: 'Analyzing errors',
    type: 'investigate',
    model: 'flash-lite',
  },
  fixError: {
    content: 'Fix the error in {file}',
    activeForm: 'Fixing error in {file}',
    type: 'execute',
    model: 'flash',
  },

  // Mega-complex templates
  research: {
    content: 'Research {topic}',
    activeForm: 'Researching {topic}',
    type: 'research',
    model: 'flash',
  },
  generatePrd: {
    content: 'Generate Product Requirements Document',
    activeForm: 'Generating PRD',
    type: 'prd',
    model: 'pro',
  },
  designArchitecture: {
    content: 'Design system architecture',
    activeForm: 'Designing architecture',
    type: 'architecture',
    model: 'pro',
  },
  awaitApproval: {
    content: 'Await user approval for {artifact}',
    activeForm: 'Awaiting approval',
    type: 'approve',
  },
};
