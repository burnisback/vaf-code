/**
 * Planner Types
 *
 * Type definitions for the task planning system.
 * Used when handling complex requests that need structured execution.
 */

// =============================================================================
// TASK TYPES
// =============================================================================

/**
 * Type of task to execute
 */
export type TaskType = 'file' | 'shell' | 'modify' | 'delete';

/**
 * Current status of a task
 */
export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * A single task in the execution plan
 */
export interface PlanTask {
  /** Unique task identifier */
  id: string;

  /** Human-readable description */
  description: string;

  /** Type of task */
  type: TaskType;

  /** File path (for file/modify/delete tasks) */
  filePath?: string;

  /** Shell command (for shell tasks) */
  command?: string;

  /** Task status */
  status: TaskStatus;

  /** IDs of tasks this depends on */
  dependsOn: string[];

  /** Error message if failed */
  error?: string;

  /** Estimated complexity (1-5) */
  complexity: number;

  /** Output/result of the task (for logging) */
  output?: string;
}

// =============================================================================
// PLAN TYPES
// =============================================================================

/**
 * Status of an overall plan
 */
export type PlanStatus = 'draft' | 'approved' | 'executing' | 'completed' | 'failed';

/**
 * A complete task plan for a complex request
 */
export interface TaskPlan {
  /** Unique plan identifier */
  id: string;

  /** Brief summary of what we're building */
  summary: string;

  /** Detailed description */
  description: string;

  /** Ordered list of tasks */
  tasks: PlanTask[];

  /** Files that will be created */
  filesToCreate: string[];

  /** Files that will be modified */
  filesToModify: string[];

  /** NPM packages to install */
  dependencies: string[];

  /** Plan creation timestamp */
  createdAt: number;

  /** Plan status */
  status: PlanStatus;

  /** Current iteration (for refinement) */
  iteration: number;

  /** Total estimated complexity */
  totalComplexity?: number;
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Language info for project context
 */
export interface ProjectLanguageInfo {
  primary: 'typescript' | 'javascript';
  hasTypeScript: boolean;
  hasJavaScript: boolean;
  hasTsConfig: boolean;
  fileExtensions: {
    components: '.tsx' | '.jsx';
    modules: '.ts' | '.js';
  };
}

/**
 * Request to generate a plan
 */
export interface PlanGenerationRequest {
  /** User's original prompt */
  prompt: string;

  /** Current project context */
  projectContext: {
    fileTree: string;
    framework: string;
    styling: string;
    language?: ProjectLanguageInfo;
    existingFiles?: { path: string; content: string }[];
  };

  /** Conversation history for context */
  conversationHistory?: { role: string; content: string }[];

  /** Request mode for model selection (affects cost) */
  mode?: 'simple' | 'moderate' | 'complex' | 'mega-complex';

  /** Complexity score for fine-grained model selection */
  complexityScore?: number;
}

/**
 * Response from plan generation
 */
export interface PlanGenerationResponse {
  /** The generated plan */
  plan: TaskPlan;

  /** AI's reasoning for the plan structure */
  reasoning: string;
}

// =============================================================================
// PLAN EXECUTION
// =============================================================================

/**
 * Callbacks for plan execution events
 */
export interface PlanExecutionCallbacks {
  /** Called when a task starts */
  onTaskStart?: (task: PlanTask) => void;

  /** Called when a task completes successfully */
  onTaskComplete?: (task: PlanTask) => void;

  /** Called when a task fails */
  onTaskError?: (task: PlanTask, error: string) => void;

  /** Called to report overall progress */
  onProgress?: (completedCount: number, totalCount: number, currentTask: string) => void;

  /** Called when filesystem changes */
  onFilesystemChange?: () => void;

  /** Called for terminal output */
  onTerminalOutput?: (data: string) => void;
}

/**
 * Result of plan execution
 */
export interface PlanExecutionResult {
  /** The executed plan (with updated task statuses) */
  plan: TaskPlan;

  /** Whether all tasks completed successfully */
  success: boolean;

  /** Number of completed tasks */
  completedTasks: number;

  /** Number of failed tasks */
  failedTasks: number;

  /** List of errors encountered */
  errors: { taskId: string; error: string }[];

  /** Total execution time in ms */
  executionTime: number;

  /** Build verification result (if verification was run) */
  verification?: {
    success: boolean;
    typeErrors: number;
    moduleErrors: number;
    runtimeErrors: number;
  };
}

// =============================================================================
// PLAN VALIDATION
// =============================================================================

/**
 * Validation result for a plan
 */
export interface PlanValidationResult {
  /** Whether the plan is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];
}
