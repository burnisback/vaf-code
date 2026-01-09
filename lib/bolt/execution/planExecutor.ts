/**
 * Plan Executor
 *
 * Client-side executor that runs task plans by:
 * 1. Calling the server API to generate code for file tasks
 * 2. Using ActionQueue to write files and run shell commands
 * 3. Tracking progress and reporting via callbacks
 */

import type { WebContainer } from '@webcontainer/api';
import type {
  TaskPlan,
  PlanTask,
  PlanExecutionCallbacks,
  PlanExecutionResult,
} from '../ai/planner';
import { ActionQueue } from './actionQueue';
import { BuildVerifier } from './verifier';
import { StaticAnalyzer } from './staticAnalyzer';
import { UnifiedVerifier, type UnifiedVerificationResult } from './unifiedVerifier';
import type { BoltAction } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ExecutorConfig {
  /** Timeout per task in milliseconds */
  taskTimeout: number;
  /** Whether to stop on first error */
  stopOnError: boolean;
  /** Whether to run verification after execution */
  runVerification: boolean;
  /** Wait time before verification (ms) */
  verificationWait: number;
  /** Whether to run static analysis (tsc --noEmit) for comprehensive checking */
  runStaticAnalysis: boolean;
  /** Whether to use unified verification (comprehensive, includes all checks) */
  useUnifiedVerification: boolean;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  taskTimeout: 60000,
  stopOnError: false,
  runVerification: true,
  verificationWait: 2000,
  runStaticAnalysis: true,
  useUnifiedVerification: false, // Opt-in to unified verification
};

interface TaskGenerationResponse {
  success: boolean;
  files?: { path: string; content: string }[];
  error?: string;
}

// =============================================================================
// PLAN EXECUTOR CLASS
// =============================================================================

export class PlanExecutor {
  private webcontainer: WebContainer;
  private actionQueue: ActionQueue;
  private verifier: BuildVerifier;
  private staticAnalyzer: StaticAnalyzer;
  private unifiedVerifier: UnifiedVerifier;
  private callbacks: PlanExecutionCallbacks;
  private config: ExecutorConfig;
  // Store unified verification result for access
  private lastUnifiedResult: UnifiedVerificationResult | null = null;

  constructor(
    webcontainer: WebContainer,
    callbacks: PlanExecutionCallbacks = {},
    config: Partial<ExecutorConfig> = {}
  ) {
    this.webcontainer = webcontainer;
    this.callbacks = callbacks;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create action queue with forwarded callbacks
    this.actionQueue = new ActionQueue(webcontainer, {
      onProgress: (msg) => this.callbacks.onTerminalOutput?.(`[ActionQueue] ${msg}\r\n`),
      onFilesystemChange: callbacks.onFilesystemChange,
      onTerminalOutput: callbacks.onTerminalOutput,
    });

    // Create verifier that captures terminal output
    this.verifier = new BuildVerifier(webcontainer, {
      waitBefore: this.config.verificationWait,
    });

    // Create static analyzer for comprehensive TypeScript checking
    this.staticAnalyzer = new StaticAnalyzer(webcontainer, {
      onProgress: (msg) => this.callbacks.onTerminalOutput?.(`\x1b[36m[StaticAnalyzer] ${msg}\x1b[0m\r\n`),
    });

    // Create unified verifier for comprehensive checking
    this.unifiedVerifier = new UnifiedVerifier(webcontainer, {
      phases: {
        typeCheck: true,
        lint: true,
        styleLint: true,
        envValidation: true,
        circularDeps: true,
        tests: false, // Don't run tests during plan execution
        runtimeSetup: false, // Already handled by runtime error capture
      },
      runTests: false,
      injectRuntimeCapture: false,
      onProgress: (msg) => this.callbacks.onTerminalOutput?.(`\x1b[36m[UnifiedVerifier] ${msg}\x1b[0m\r\n`),
    });
  }

  /**
   * Get the last unified verification result
   */
  getLastUnifiedResult(): UnifiedVerificationResult | null {
    return this.lastUnifiedResult;
  }

  /**
   * Capture output for verification analysis
   */
  captureOutput(data: string): void {
    this.verifier.captureOutput(data);
  }

  /**
   * Execute a complete plan
   */
  async execute(plan: TaskPlan): Promise<PlanExecutionResult> {
    const startTime = Date.now();

    // Clone plan to avoid mutating original
    const executingPlan: TaskPlan = {
      ...plan,
      status: 'executing',
      tasks: plan.tasks.map(t => ({ ...t })),
    };

    const result: PlanExecutionResult = {
      plan: executingPlan,
      success: true,
      completedTasks: 0,
      failedTasks: 0,
      errors: [],
      executionTime: 0,
    };

    const totalTasks = executingPlan.tasks.length;

    // Separate tasks by type - shell tasks run first (npm install)
    const shellTasks = executingPlan.tasks.filter(t => t.type === 'shell');
    const fileTasks = executingPlan.tasks.filter(t => t.type !== 'shell');

    this.callbacks.onTerminalOutput?.(
      `\r\n\x1b[36m══════════════════════════════════════════════════════════\x1b[0m\r\n`
    );
    this.callbacks.onTerminalOutput?.(
      `\x1b[36m  Executing Plan: ${executingPlan.summary}\x1b[0m\r\n`
    );
    this.callbacks.onTerminalOutput?.(
      `\x1b[36m  Tasks: ${totalTasks} (${shellTasks.length} shell, ${fileTasks.length} file)\x1b[0m\r\n`
    );
    this.callbacks.onTerminalOutput?.(
      `\x1b[36m══════════════════════════════════════════════════════════\x1b[0m\r\n\r\n`
    );

    // Execute shell tasks first (dependency installation)
    for (const task of shellTasks) {
      const taskResult = await this.executeShellTask(task);

      if (taskResult.success) {
        result.completedTasks++;
        task.status = 'completed';
        this.callbacks.onTaskComplete?.(task);
      } else {
        result.failedTasks++;
        task.status = 'failed';
        task.error = taskResult.error;
        result.errors.push({ taskId: task.id, error: taskResult.error || 'Unknown error' });
        this.callbacks.onTaskError?.(task, taskResult.error || 'Unknown error');

        if (this.config.stopOnError) {
          result.success = false;
          result.executionTime = Date.now() - startTime;
          return result;
        }
      }

      this.callbacks.onProgress?.(
        result.completedTasks + result.failedTasks,
        totalTasks,
        task.description
      );
    }

    // Execute file tasks
    for (const task of fileTasks) {
      task.status = 'in_progress';
      this.callbacks.onTaskStart?.(task);

      const taskResult = await this.executeFileTask(task, executingPlan);

      if (taskResult.success) {
        result.completedTasks++;
        task.status = 'completed';
        this.callbacks.onTaskComplete?.(task);
      } else {
        result.failedTasks++;
        task.status = 'failed';
        task.error = taskResult.error;
        result.errors.push({ taskId: task.id, error: taskResult.error || 'Unknown error' });
        this.callbacks.onTaskError?.(task, taskResult.error || 'Unknown error');

        if (this.config.stopOnError) {
          result.success = false;
          result.executionTime = Date.now() - startTime;
          return result;
        }
      }

      this.callbacks.onProgress?.(
        result.completedTasks + result.failedTasks,
        totalTasks,
        task.description
      );
    }

    // Determine overall success
    result.success = result.failedTasks === 0;
    result.plan.status = result.success ? 'completed' : 'failed';
    result.executionTime = Date.now() - startTime;

    // Final summary
    this.callbacks.onTerminalOutput?.(
      `\r\n\x1b[36m══════════════════════════════════════════════════════════\x1b[0m\r\n`
    );
    if (result.success) {
      this.callbacks.onTerminalOutput?.(
        `\x1b[32m  ✓ Plan completed successfully!\x1b[0m\r\n`
      );
    } else {
      this.callbacks.onTerminalOutput?.(
        `\x1b[33m  ⚠ Plan completed with ${result.failedTasks} error(s)\x1b[0m\r\n`
      );
    }
    this.callbacks.onTerminalOutput?.(
      `\x1b[36m  Tasks: ${result.completedTasks}/${totalTasks} succeeded\x1b[0m\r\n`
    );
    this.callbacks.onTerminalOutput?.(
      `\x1b[36m  Time: ${(result.executionTime / 1000).toFixed(1)}s\x1b[0m\r\n`
    );

    // Run verification if enabled
    if (this.config.runVerification) {
      this.callbacks.onProgress?.(
        result.completedTasks,
        totalTasks,
        'Verifying build...'
      );

      // Choose between unified verification and basic verification
      if (this.config.useUnifiedVerification) {
        this.callbacks.onTerminalOutput?.(
          `\x1b[36m  Running unified verification...\x1b[0m\r\n`
        );

        const unifiedResult = await this.unifiedVerifier.verify();
        this.lastUnifiedResult = unifiedResult;

        result.verification = {
          success: unifiedResult.success,
          typeErrors: unifiedResult.phases.typeCheck.errorCount,
          moduleErrors: unifiedResult.phases.lint.errorCount + unifiedResult.phases.styleLint.errorCount,
          runtimeErrors: unifiedResult.phases.circularDeps.errorCount,
        };

        if (unifiedResult.success) {
          this.callbacks.onTerminalOutput?.(
            `\x1b[32m  ✓ Unified verification passed\x1b[0m\r\n`
          );
        } else {
          this.callbacks.onTerminalOutput?.(
            `\x1b[33m  ⚠ ${unifiedResult.summary}\x1b[0m\r\n`
          );

          // Log phase summaries
          for (const [, phase] of Object.entries(unifiedResult.phases)) {
            if (!phase.skipped && !phase.passed) {
              this.callbacks.onTerminalOutput?.(
                `\x1b[33m    - ${phase.name}: ${phase.errorCount} error(s)\x1b[0m\r\n`
              );
            }
          }
        }
      } else {
        this.callbacks.onTerminalOutput?.(
          `\x1b[36m  Verifying build...\x1b[0m\r\n`
        );

        const verification = await this.verifier.verify();

        result.verification = {
          success: verification.success,
          typeErrors: verification.typeErrors.length,
          moduleErrors: verification.moduleErrors.length,
          runtimeErrors: verification.runtimeErrors.length,
        };

        if (verification.success) {
          this.callbacks.onTerminalOutput?.(
            `\x1b[32m  ✓ Build verified - no errors\x1b[0m\r\n`
          );
        } else {
          const totalErrors =
            verification.typeErrors.length +
            verification.moduleErrors.length +
            verification.runtimeErrors.length;

          this.callbacks.onTerminalOutput?.(
            `\x1b[33m  ⚠ Build verification found ${totalErrors} error(s)\x1b[0m\r\n`
          );

          // Log error summary
          if (verification.typeErrors.length > 0) {
            this.callbacks.onTerminalOutput?.(
              `\x1b[33m    - ${verification.typeErrors.length} type error(s)\x1b[0m\r\n`
            );
          }
          if (verification.moduleErrors.length > 0) {
            this.callbacks.onTerminalOutput?.(
              `\x1b[33m    - ${verification.moduleErrors.length} module error(s)\x1b[0m\r\n`
            );
          }
          if (verification.runtimeErrors.length > 0) {
            this.callbacks.onTerminalOutput?.(
              `\x1b[33m    - ${verification.runtimeErrors.length} runtime error(s)\x1b[0m\r\n`
            );
          }
        }
      }
    }

    // Phase 0: Run static analysis (tsc --noEmit) for comprehensive checking
    // This catches errors in orphaned files not in the import graph
    if (this.config.runStaticAnalysis) {
      this.callbacks.onTerminalOutput?.(
        `\x1b[36m  Running static analysis (tsc --noEmit)...\x1b[0m\r\n`
      );

      this.callbacks.onProgress?.(
        result.completedTasks,
        totalTasks,
        'Running static analysis...'
      );

      const staticResult = await this.staticAnalyzer.analyze();

      // If static analysis found errors not caught by build, add them
      if (!staticResult.success) {
        const staticTypeErrors = staticResult.errors.length;

        // Update verification result to include static analysis errors
        if (result.verification) {
          // Add any NEW errors not already counted
          const existingTypeErrors = result.verification.typeErrors;
          const additionalErrors = Math.max(0, staticTypeErrors - existingTypeErrors);

          if (additionalErrors > 0) {
            result.verification.typeErrors += additionalErrors;
            result.verification.success = false;

            this.callbacks.onTerminalOutput?.(
              `\x1b[33m  ⚠ Static analysis found ${additionalErrors} additional error(s) in orphaned files\x1b[0m\r\n`
            );

            // Log a few examples
            const examples = staticResult.errors.slice(0, 3);
            for (const err of examples) {
              this.callbacks.onTerminalOutput?.(
                `\x1b[33m    - ${err.file}:${err.line} ${err.code}: ${err.message}\x1b[0m\r\n`
              );
            }
            if (staticResult.errors.length > 3) {
              this.callbacks.onTerminalOutput?.(
                `\x1b[33m    ... and ${staticResult.errors.length - 3} more\x1b[0m\r\n`
              );
            }
          }
        } else {
          // No verification result yet, create one from static analysis
          result.verification = {
            success: false,
            typeErrors: staticTypeErrors,
            moduleErrors: 0,
            runtimeErrors: 0,
          };

          this.callbacks.onTerminalOutput?.(
            `\x1b[33m  ⚠ Static analysis found ${staticTypeErrors} error(s)\x1b[0m\r\n`
          );
        }
      } else {
        this.callbacks.onTerminalOutput?.(
          `\x1b[32m  ✓ Static analysis passed - no errors in any files\x1b[0m\r\n`
        );
      }
    }

    this.callbacks.onTerminalOutput?.(
      `\x1b[36m══════════════════════════════════════════════════════════\x1b[0m\r\n\r\n`
    );

    return result;
  }

  /**
   * Execute a shell task (npm install, etc.)
   */
  private async executeShellTask(task: PlanTask): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!task.command) {
      return { success: false, error: 'No command specified' };
    }

    task.status = 'in_progress';
    this.callbacks.onTaskStart?.(task);
    this.callbacks.onTerminalOutput?.(
      `\r\n\x1b[36m[${task.id}] Running: ${task.command}\x1b[0m\r\n`
    );

    try {
      const parts = task.command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      const process = await this.webcontainer.spawn(cmd, args);

      // Stream output
      process.output.pipeTo(
        new WritableStream({
          write: (data) => {
            this.callbacks.onTerminalOutput?.(data);
          },
        })
      ).catch(() => {});

      const exitCode = await process.exit;

      if (exitCode === 0) {
        this.callbacks.onTerminalOutput?.(
          `\x1b[32m[${task.id}] ✓ ${task.description}\x1b[0m\r\n`
        );
        return { success: true };
      } else {
        this.callbacks.onTerminalOutput?.(
          `\x1b[31m[${task.id}] ✗ Exit code: ${exitCode}\x1b[0m\r\n`
        );
        return { success: false, error: `Exit code: ${exitCode}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onTerminalOutput?.(
        `\x1b[31m[${task.id}] ✗ Error: ${errorMsg}\x1b[0m\r\n`
      );
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Execute a file task (generate and write code)
   */
  private async executeFileTask(
    task: PlanTask,
    plan: TaskPlan
  ): Promise<{ success: boolean; error?: string }> {
    if (!task.filePath && task.type !== 'delete') {
      return { success: false, error: 'No file path specified' };
    }

    this.callbacks.onTerminalOutput?.(
      `\r\n\x1b[36m[${task.id}] Generating: ${task.filePath || task.description}...\x1b[0m\r\n`
    );

    try {
      // Get existing file content if modifying
      let existingContent: string | null = null;
      if (task.type === 'modify' && task.filePath) {
        try {
          existingContent = await this.webcontainer.fs.readFile(task.filePath, 'utf-8');
        } catch {
          // File doesn't exist yet
        }
      }

      // Build file tree for context
      const fileTree = await this.buildFileTree();

      // Call the API to generate code
      const response = await fetch('/api/bolt-execute-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          plan: {
            id: plan.id,
            summary: plan.summary,
            description: plan.description,
            tasks: plan.tasks.map(t => ({
              id: t.id,
              description: t.description,
              type: t.type,
              filePath: t.filePath,
              status: t.status,
            })),
          },
          projectContext: {
            fileTree,
            framework: 'React + Vite',
            styling: 'Tailwind CSS',
          },
          existingFileContent: existingContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Code generation failed');
      }

      const data = await response.json() as TaskGenerationResponse;

      if (!data.success || !data.files || data.files.length === 0) {
        throw new Error(data.error || 'No code generated');
      }

      // Write all generated files using ActionQueue
      for (const file of data.files) {
        const action: BoltAction = {
          type: 'file',
          filePath: file.path,
          content: file.content,
          status: 'pending',
        };

        // Ensure directory exists
        const dirPath = file.path.split('/').slice(0, -1).join('/');
        if (dirPath) {
          await this.webcontainer.fs.mkdir(dirPath, { recursive: true });
        }

        // Write file
        await this.webcontainer.fs.writeFile(file.path, file.content);

        this.callbacks.onTerminalOutput?.(
          `\x1b[32m[${task.id}] ✓ Created ${file.path}\x1b[0m\r\n`
        );
      }

      this.callbacks.onFilesystemChange?.();
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onTerminalOutput?.(
        `\x1b[31m[${task.id}] ✗ Failed: ${errorMsg}\x1b[0m\r\n`
      );
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Build file tree string for context
   */
  private async buildFileTree(): Promise<string> {
    try {
      return await this.buildTreeRecursive('/', '', 0);
    } catch {
      return '(error reading file tree)';
    }
  }

  private async buildTreeRecursive(
    path: string,
    prefix: string,
    depth: number
  ): Promise<string> {
    if (depth > 3) return ''; // Limit depth

    try {
      const entries = await this.webcontainer.fs.readdir(path, { withFileTypes: true });
      let tree = '';

      for (const entry of entries) {
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
        tree += `${prefix}${entry.name}${entry.isDirectory() ? '/' : ''}\n`;

        if (entry.isDirectory() && depth < 3) {
          tree += await this.buildTreeRecursive(fullPath, prefix + '  ', depth + 1);
        }
      }

      return tree;
    } catch {
      return '';
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new plan executor
 */
export function createPlanExecutor(
  webcontainer: WebContainer,
  callbacks: PlanExecutionCallbacks = {},
  config: Partial<ExecutorConfig> = {}
): PlanExecutor {
  return new PlanExecutor(webcontainer, callbacks, config);
}
