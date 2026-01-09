/**
 * Plan Utilities (Client-Safe)
 *
 * Client-safe utility functions for working with task plans.
 * No genkit or Node.js-specific dependencies.
 */

import type {
  TaskPlan,
  PlanTask,
  TaskType,
  PlanValidationResult,
} from './types';

// =============================================================================
// PLAN VALIDATION
// =============================================================================

/**
 * Validate a plan for correctness
 */
export function validatePlan(plan: TaskPlan): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty plan
  if (plan.tasks.length === 0) {
    errors.push('Plan has no tasks');
  }

  // Check for too many tasks
  if (plan.tasks.length > 15) {
    warnings.push(`Plan has ${plan.tasks.length} tasks - consider splitting into phases`);
  }

  // Check task dependencies
  const taskIds = new Set(plan.tasks.map((t) => t.id));
  for (const task of plan.tasks) {
    for (const depId of task.dependsOn) {
      if (!taskIds.has(depId)) {
        errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
      }
    }
  }

  // Check for circular dependencies
  if (hasCircularDependency(plan.tasks)) {
    errors.push('Plan has circular dependencies');
  }

  // Check file tasks have filePath
  for (const task of plan.tasks) {
    if ((task.type === 'file' || task.type === 'modify' || task.type === 'delete') && !task.filePath) {
      warnings.push(`Task ${task.id} (${task.type}) is missing filePath`);
    }
    if (task.type === 'shell' && !task.command) {
      warnings.push(`Task ${task.id} (shell) is missing command`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check for circular dependencies in tasks
 */
function hasCircularDependency(tasks: PlanTask[]): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(taskId: string): boolean {
    if (inStack.has(taskId)) return true; // Circular dependency
    if (visited.has(taskId)) return false;

    visited.add(taskId);
    inStack.add(taskId);

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      for (const depId of task.dependsOn) {
        if (dfs(depId)) return true;
      }
    }

    inStack.delete(taskId);
    return false;
  }

  for (const task of tasks) {
    if (dfs(task.id)) return true;
  }

  return false;
}

// =============================================================================
// PLAN UTILITIES
// =============================================================================

/**
 * Get tasks that are ready to execute (no pending dependencies)
 */
export function getReadyTasks(plan: TaskPlan): PlanTask[] {
  return plan.tasks.filter((task) => {
    if (task.status !== 'pending') return false;

    // Check all dependencies are completed
    return task.dependsOn.every((depId) => {
      const dep = plan.tasks.find((t) => t.id === depId);
      return dep?.status === 'completed';
    });
  });
}

/**
 * Get the next task to execute
 */
export function getNextTask(plan: TaskPlan): PlanTask | null {
  const ready = getReadyTasks(plan);
  if (ready.length === 0) return null;

  // Prioritize by type: shell > file > modify > delete
  const priority: Record<TaskType, number> = {
    shell: 0,
    file: 1,
    modify: 2,
    delete: 3,
  };

  return ready.sort((a, b) => priority[a.type] - priority[b.type])[0];
}

/**
 * Calculate total complexity of a plan
 */
export function getPlanComplexity(plan: TaskPlan): number {
  return plan.tasks.reduce((sum, task) => sum + task.complexity, 0);
}

/**
 * Get plan progress percentage
 */
export function getPlanProgress(plan: TaskPlan): number {
  const completed = plan.tasks.filter((t) => t.status === 'completed').length;
  return plan.tasks.length > 0 ? (completed / plan.tasks.length) * 100 : 0;
}

/**
 * Check if plan has failed tasks
 */
export function hasFailedTasks(plan: TaskPlan): boolean {
  return plan.tasks.some((t) => t.status === 'failed');
}

/**
 * Check if plan is complete
 */
export function isPlanComplete(plan: TaskPlan): boolean {
  return plan.tasks.every(
    (t) => t.status === 'completed' || t.status === 'skipped'
  );
}

/**
 * Check if plan is blocked (has failed dependencies)
 */
export function isPlanBlocked(plan: TaskPlan): boolean {
  // A plan is blocked if there are pending tasks but none are ready
  const hasPending = plan.tasks.some((t) => t.status === 'pending');
  const hasReady = getReadyTasks(plan).length > 0;
  return hasPending && !hasReady && hasFailedTasks(plan);
}

/**
 * Update task status in a plan (immutable)
 */
export function updateTaskStatus(
  plan: TaskPlan,
  taskId: string,
  status: PlanTask['status'],
  error?: string
): TaskPlan {
  return {
    ...plan,
    tasks: plan.tasks.map((t) =>
      t.id === taskId ? { ...t, status, error } : t
    ),
  };
}

/**
 * Get a summary of the plan status
 */
export function getPlanSummary(plan: TaskPlan): {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  skipped: number;
} {
  return {
    total: plan.tasks.length,
    pending: plan.tasks.filter((t) => t.status === 'pending').length,
    inProgress: plan.tasks.filter((t) => t.status === 'in_progress').length,
    completed: plan.tasks.filter((t) => t.status === 'completed').length,
    failed: plan.tasks.filter((t) => t.status === 'failed').length,
    skipped: plan.tasks.filter((t) => t.status === 'skipped').length,
  };
}

/**
 * Estimate execution time in seconds based on complexity
 */
export function estimateExecutionTime(plan: TaskPlan): number {
  // Rough estimate: 5 seconds per complexity point
  return getPlanComplexity(plan) * 5;
}
