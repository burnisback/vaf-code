/**
 * Parallel Executor
 *
 * Executes multiple agent tasks in parallel with result aggregation.
 */

/**
 * Task definition
 */
export interface ParallelTask<T> {
  id: string;
  name: string;
  execute: () => Promise<T>;
  required?: boolean;
  timeout?: number;
  dependencies?: string[];
}

/**
 * Task result
 */
export interface TaskResult<T> {
  id: string;
  name: string;
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
  startedAt: number;
  completedAt: number;
}

/**
 * Parallel execution result
 */
export interface ParallelExecutionResult<T> {
  success: boolean;
  results: TaskResult<T>[];
  successCount: number;
  failureCount: number;
  totalDuration: number;
  errors: Error[];
}

/**
 * Parallel executor configuration
 */
export interface ParallelExecutorConfig {
  maxConcurrent: number;
  stopOnFirstFailure: boolean;
  defaultTimeout: number;
  onTaskStart?: (task: ParallelTask<unknown>) => void;
  onTaskComplete?: (result: TaskResult<unknown>) => void;
  onTaskError?: (task: ParallelTask<unknown>, error: Error) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ParallelExecutorConfig = {
  maxConcurrent: 5,
  stopOnFirstFailure: false,
  defaultTimeout: 60000,
};

/**
 * Parallel Executor class
 */
export class ParallelExecutor {
  private config: ParallelExecutorConfig;

  constructor(config: Partial<ParallelExecutorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute multiple tasks in parallel
   */
  async execute<T>(tasks: ParallelTask<T>[]): Promise<ParallelExecutionResult<T>> {
    const startTime = Date.now();
    const results: TaskResult<T>[] = [];
    const errors: Error[] = [];
    let shouldStop = false;

    // Separate tasks by dependencies
    const { independent, dependent } = this.separateTasks(tasks);

    // Execute independent tasks first
    const independentResults = await this.executeGroup(
      independent,
      () => shouldStop,
      (error) => {
        errors.push(error);
        if (this.config.stopOnFirstFailure) {
          shouldStop = true;
        }
      }
    );
    results.push(...independentResults);

    // Execute dependent tasks if not stopped
    if (!shouldStop && dependent.length > 0) {
      const completedIds = new Set(
        results.filter((r) => r.success).map((r) => r.id)
      );

      // Filter tasks whose dependencies are met
      const readyTasks = dependent.filter((task) =>
        (task.dependencies ?? []).every((dep) => completedIds.has(dep))
      );

      const dependentResults = await this.executeGroup(
        readyTasks,
        () => shouldStop,
        (error) => {
          errors.push(error);
          if (this.config.stopOnFirstFailure) {
            shouldStop = true;
          }
        }
      );
      results.push(...dependentResults);
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    // Check if required tasks failed
    const requiredFailed = tasks
      .filter((t) => t.required)
      .some((t) => {
        const result = results.find((r) => r.id === t.id);
        return !result || !result.success;
      });

    return {
      success: failureCount === 0 || !requiredFailed,
      results,
      successCount,
      failureCount,
      totalDuration: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Execute a group of tasks with concurrency control
   */
  private async executeGroup<T>(
    tasks: ParallelTask<T>[],
    shouldStop: () => boolean,
    onError: (error: Error) => void
  ): Promise<TaskResult<T>[]> {
    const results: TaskResult<T>[] = [];
    const executing: Promise<void>[] = [];
    const taskQueue = [...tasks];

    const executeNext = async (): Promise<void> => {
      while (taskQueue.length > 0 && !shouldStop()) {
        const task = taskQueue.shift();
        if (!task) break;

        this.config.onTaskStart?.(task as ParallelTask<unknown>);

        const result = await this.executeTask(task);
        results.push(result);

        this.config.onTaskComplete?.(result as TaskResult<unknown>);

        if (!result.success && result.error) {
          this.config.onTaskError?.(task as ParallelTask<unknown>, result.error);
          onError(result.error);
        }
      }
    };

    // Start initial batch
    for (let i = 0; i < Math.min(this.config.maxConcurrent, tasks.length); i++) {
      executing.push(executeNext());
    }

    await Promise.all(executing);

    return results;
  }

  /**
   * Execute a single task
   */
  private async executeTask<T>(task: ParallelTask<T>): Promise<TaskResult<T>> {
    const startedAt = Date.now();

    try {
      const timeout = task.timeout ?? this.config.defaultTimeout;
      const result = await this.withTimeout(task.execute(), timeout, task.name);

      return {
        id: task.id,
        name: task.name,
        success: true,
        result,
        duration: Date.now() - startedAt,
        startedAt,
        completedAt: Date.now(),
      };
    } catch (error) {
      return {
        id: task.id,
        name: task.name,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startedAt,
        startedAt,
        completedAt: Date.now(),
      };
    }
  }

  /**
   * Execute with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    taskName: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Task '${taskName}' timed out after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
  }

  /**
   * Separate tasks by dependencies
   */
  private separateTasks<T>(
    tasks: ParallelTask<T>[]
  ): { independent: ParallelTask<T>[]; dependent: ParallelTask<T>[] } {
    const independent: ParallelTask<T>[] = [];
    const dependent: ParallelTask<T>[] = [];

    for (const task of tasks) {
      if (!task.dependencies || task.dependencies.length === 0) {
        independent.push(task);
      } else {
        dependent.push(task);
      }
    }

    return { independent, dependent };
  }
}

// Singleton instance
export const parallelExecutor = new ParallelExecutor();

/**
 * Execute tasks in parallel (convenience function)
 */
export async function executeParallel<T>(
  tasks: ParallelTask<T>[],
  config?: Partial<ParallelExecutorConfig>
): Promise<ParallelExecutionResult<T>> {
  const executor = config ? new ParallelExecutor(config) : parallelExecutor;
  return executor.execute(tasks);
}

/**
 * Execute functions in parallel (simple API)
 */
export async function runParallel<T>(
  fns: (() => Promise<T>)[],
  names?: string[]
): Promise<{ results: (T | Error)[]; success: boolean }> {
  const tasks: ParallelTask<T>[] = fns.map((fn, i) => ({
    id: `task_${i}`,
    name: names?.[i] ?? `Task ${i}`,
    execute: fn,
  }));

  const result = await executeParallel(tasks);

  return {
    results: result.results.map((r) => (r.success ? r.result! : r.error!)),
    success: result.success,
  };
}

/**
 * Map with parallel execution
 */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const executor = new ParallelExecutor({ maxConcurrent: concurrency });

  const tasks: ParallelTask<R>[] = items.map((item, index) => ({
    id: `map_${index}`,
    name: `Map item ${index}`,
    execute: () => fn(item, index),
  }));

  const result = await executor.execute(tasks);

  // Preserve order
  const ordered: R[] = new Array(items.length);
  for (const taskResult of result.results) {
    const index = parseInt(taskResult.id.split('_')[1], 10);
    if (taskResult.success && taskResult.result !== undefined) {
      ordered[index] = taskResult.result;
    }
  }

  return ordered;
}
