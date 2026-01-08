/**
 * Action Queue System
 *
 * Manages the execution of file and shell actions with:
 * - Ordered execution
 * - Backup/rollback capability
 * - Progress tracking
 * - Execution history
 */

import type { WebContainer } from '@webcontainer/api';
import type { BoltAction, BoltExecutionResult } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface QueuedAction extends BoltAction {
  id: string;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  backup?: FileBackup;
}

export interface FileBackup {
  path: string;
  content: string | null; // null if file didn't exist
  createdAt: number;
}

export interface ExecutionHistoryEntry {
  id: string;
  action: QueuedAction;
  result: BoltExecutionResult;
  timestamp: number;
  canRollback: boolean;
}

export interface ActionQueueState {
  queue: QueuedAction[];
  executing: QueuedAction | null;
  completed: QueuedAction[];
  failed: QueuedAction[];
  history: ExecutionHistoryEntry[];
}

export interface ActionQueueCallbacks {
  onActionStart?: (action: QueuedAction) => void;
  onActionComplete?: (action: QueuedAction, result: BoltExecutionResult) => void;
  onActionError?: (action: QueuedAction, error: string) => void;
  onProgress?: (message: string) => void;
  onFilesystemChange?: () => void;
  onTerminalOutput?: (data: string) => void;
}

// =============================================================================
// UTILITIES
// =============================================================================

function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Create a simple diff between two strings
 */
export function createSimpleDiff(
  oldContent: string | null,
  newContent: string
): { added: number; removed: number; unchanged: number } {
  if (oldContent === null) {
    const lines = newContent.split('\n').length;
    return { added: lines, removed: 0, unchanged: 0 };
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  let added = 0;
  let removed = 0;
  let unchanged = 0;

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  for (const line of newLines) {
    if (oldSet.has(line)) {
      unchanged++;
    } else {
      added++;
    }
  }

  for (const line of oldLines) {
    if (!newSet.has(line)) {
      removed++;
    }
  }

  return { added, removed, unchanged };
}

// =============================================================================
// ACTION QUEUE CLASS
// =============================================================================

export class ActionQueue {
  private state: ActionQueueState = {
    queue: [],
    executing: null,
    completed: [],
    failed: [],
    history: [],
  };

  private webcontainer: WebContainer | null = null;
  private callbacks: ActionQueueCallbacks = {};
  private isProcessing = false;
  private maxHistorySize = 50;

  constructor(webcontainer: WebContainer | null, callbacks?: ActionQueueCallbacks) {
    this.webcontainer = webcontainer;
    this.callbacks = callbacks || {};
  }

  /**
   * Update the WebContainer reference
   */
  setWebContainer(webcontainer: WebContainer | null): void {
    this.webcontainer = webcontainer;
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: ActionQueueCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Add actions to the queue
   */
  enqueue(actions: BoltAction[]): QueuedAction[] {
    const queuedActions: QueuedAction[] = actions.map((action) => ({
      ...action,
      id: generateActionId(),
      queuedAt: Date.now(),
      status: 'pending' as const,
    }));

    this.state.queue.push(...queuedActions);
    this.processQueue();

    return queuedActions;
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || !this.webcontainer) return;
    if (this.state.queue.length === 0) return;

    this.isProcessing = true;

    while (this.state.queue.length > 0) {
      const action = this.state.queue.shift()!;
      action.startedAt = Date.now();
      action.status = 'executing';
      this.state.executing = action;

      this.callbacks.onActionStart?.(action);

      try {
        const result = await this.executeAction(action);
        action.completedAt = Date.now();
        action.status = result.success ? 'success' : 'error';

        if (result.success) {
          this.state.completed.push(action);
        } else {
          action.error = result.error;
          this.state.failed.push(action);
        }

        // Add to history
        this.addToHistory(action, result);

        this.callbacks.onActionComplete?.(action, result);
      } catch (error) {
        action.completedAt = Date.now();
        action.status = 'error';
        action.error = error instanceof Error ? error.message : 'Unknown error';
        this.state.failed.push(action);

        const result: BoltExecutionResult = {
          type: action.type,
          path: action.filePath,
          success: false,
          error: action.error,
        };

        this.addToHistory(action, result);
        this.callbacks.onActionError?.(action, action.error);
      }

      this.state.executing = null;
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: QueuedAction): Promise<BoltExecutionResult> {
    if (!this.webcontainer) {
      return {
        type: action.type,
        success: false,
        error: 'WebContainer not available',
      };
    }

    if (action.type === 'file' && action.filePath) {
      return this.executeFileAction(action);
    } else if (action.type === 'shell') {
      return this.executeShellAction(action);
    }

    return {
      type: action.type,
      success: false,
      error: 'Unknown action type',
    };
  }

  /**
   * Execute a file action with backup
   */
  private async executeFileAction(action: QueuedAction): Promise<BoltExecutionResult> {
    const { filePath, content } = action;
    if (!filePath || !this.webcontainer) {
      return { type: 'file', success: false, error: 'Invalid file action' };
    }

    try {
      // Create backup of existing file
      let existingContent: string | null = null;
      try {
        existingContent = await this.webcontainer.fs.readFile(filePath, 'utf-8');
      } catch {
        // File doesn't exist, that's okay
      }

      action.backup = {
        path: filePath,
        content: existingContent,
        createdAt: Date.now(),
      };

      this.callbacks.onProgress?.(`Creating ${filePath}...`);
      this.callbacks.onTerminalOutput?.(
        `\x1b[36m[Bolt] Creating ${filePath}...\x1b[0m\r\n`
      );

      // Ensure directory exists
      const dirPath = filePath.split('/').slice(0, -1).join('/');
      if (dirPath) {
        await this.webcontainer.fs.mkdir(dirPath, { recursive: true });
      }

      // Write file
      await this.webcontainer.fs.writeFile(filePath, content);

      // Calculate diff
      const diff = createSimpleDiff(existingContent, content);

      this.callbacks.onTerminalOutput?.(
        `\x1b[32m[Bolt] ✓ ${existingContent ? 'Updated' : 'Created'} ${filePath} ` +
        `(+${diff.added} -${diff.removed})\x1b[0m\r\n`
      );

      this.callbacks.onFilesystemChange?.();

      return {
        type: 'file',
        path: filePath,
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onTerminalOutput?.(
        `\x1b[31m[Bolt] ✗ Failed to create ${filePath}: ${message}\x1b[0m\r\n`
      );

      return {
        type: 'file',
        path: filePath,
        success: false,
        error: message,
      };
    }
  }

  /**
   * Execute a shell action with enhanced progress
   */
  private async executeShellAction(action: QueuedAction): Promise<BoltExecutionResult> {
    if (!this.webcontainer) {
      return { type: 'shell', success: false, error: 'WebContainer not available' };
    }

    const command = action.content.trim();

    try {
      this.callbacks.onProgress?.(`Running: ${command}...`);
      this.callbacks.onTerminalOutput?.(
        `\x1b[36m[Bolt] Running: ${command}\x1b[0m\r\n`
      );

      // Parse command
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      const process = await this.webcontainer.spawn(cmd, args);

      // Stream output in background - don't await pipeTo() as it may hang
      // The pipe will continue streaming while we wait for the process to exit
      process.output.pipeTo(
        new WritableStream({
          write: (data) => {
            this.callbacks.onTerminalOutput?.(data);
          },
        })
      ).catch((err) => {
        // Ignore pipe errors - process may have already exited
        console.warn('[ActionQueue] Pipe error (ignored):', err);
      });

      // Wait only for the process to exit - this is the reliable signal
      const exitCode = await process.exit;

      if (exitCode === 0) {
        this.callbacks.onTerminalOutput?.(
          `\x1b[32m[Bolt] ✓ Command completed successfully\x1b[0m\r\n`
        );
        return {
          type: 'shell',
          command,
          success: true,
          exitCode,
        };
      } else {
        this.callbacks.onTerminalOutput?.(
          `\x1b[33m[Bolt] ⚠ Command exited with code ${exitCode}\x1b[0m\r\n`
        );
        return {
          type: 'shell',
          command,
          success: false,
          exitCode,
          error: `Exit code: ${exitCode}`,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onTerminalOutput?.(
        `\x1b[31m[Bolt] ✗ Command failed: ${message}\x1b[0m\r\n`
      );

      return {
        type: 'shell',
        command,
        success: false,
        error: message,
      };
    }
  }

  /**
   * Add entry to execution history
   */
  private addToHistory(action: QueuedAction, result: BoltExecutionResult): void {
    const entry: ExecutionHistoryEntry = {
      id: action.id,
      action,
      result,
      timestamp: Date.now(),
      canRollback: action.type === 'file' && result.success && !!action.backup,
    };

    this.state.history.unshift(entry);

    // Trim history
    if (this.state.history.length > this.maxHistorySize) {
      this.state.history = this.state.history.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Rollback a file action
   */
  async rollback(actionId: string): Promise<boolean> {
    const entry = this.state.history.find((h) => h.id === actionId);
    if (!entry || !entry.canRollback || !entry.action.backup) {
      return false;
    }

    if (!this.webcontainer) {
      return false;
    }

    const { backup } = entry.action;

    try {
      if (backup.content === null) {
        // File didn't exist before, delete it
        await this.webcontainer.fs.rm(backup.path);
        this.callbacks.onTerminalOutput?.(
          `\x1b[33m[Bolt] ↩ Deleted ${backup.path} (rollback)\x1b[0m\r\n`
        );
      } else {
        // Restore previous content
        await this.webcontainer.fs.writeFile(backup.path, backup.content);
        this.callbacks.onTerminalOutput?.(
          `\x1b[33m[Bolt] ↩ Restored ${backup.path} (rollback)\x1b[0m\r\n`
        );
      }

      // Mark as rolled back
      entry.canRollback = false;

      this.callbacks.onFilesystemChange?.();
      return true;
    } catch (error) {
      this.callbacks.onTerminalOutput?.(
        `\x1b[31m[Bolt] ✗ Rollback failed: ${error}\x1b[0m\r\n`
      );
      return false;
    }
  }

  /**
   * Rollback all recent file actions
   */
  async rollbackAll(): Promise<number> {
    let count = 0;
    const rollbackable = this.state.history.filter((h) => h.canRollback);

    for (const entry of rollbackable) {
      const success = await this.rollback(entry.id);
      if (success) count++;
    }

    return count;
  }

  /**
   * Get current state
   */
  getState(): ActionQueueState {
    return { ...this.state };
  }

  /**
   * Get execution history
   */
  getHistory(): ExecutionHistoryEntry[] {
    return [...this.state.history];
  }

  /**
   * Clear completed and failed actions
   */
  clearCompleted(): void {
    this.state.completed = [];
    this.state.failed = [];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.state.history = [];
  }

  /**
   * Cancel pending actions
   */
  cancelPending(): QueuedAction[] {
    const cancelled = [...this.state.queue];
    this.state.queue = [];
    return cancelled;
  }

  /**
   * Retry a failed action
   */
  async retryAction(actionId: string): Promise<boolean> {
    // Find the failed action in history
    const entry = this.state.history.find((h) => h.id === actionId);
    if (!entry || entry.result.success) {
      return false; // Can only retry failed actions
    }

    // Re-enqueue the action
    const action: BoltAction = {
      type: entry.action.type,
      filePath: entry.action.filePath,
      content: entry.action.content,
      status: 'pending',
    };

    // Remove from failed list if present
    this.state.failed = this.state.failed.filter((a) => a.id !== actionId);

    // Enqueue and execute
    this.enqueue([action]);

    return true;
  }

  /**
   * Check if queue is processing
   */
  isExecuting(): boolean {
    return this.isProcessing;
  }

  /**
   * Get pending action count
   */
  getPendingCount(): number {
    return this.state.queue.length;
  }
}

/**
 * Create a singleton action queue
 */
let actionQueueInstance: ActionQueue | null = null;

export function getActionQueue(
  webcontainer?: WebContainer | null,
  callbacks?: ActionQueueCallbacks
): ActionQueue {
  if (!actionQueueInstance) {
    actionQueueInstance = new ActionQueue(webcontainer || null, callbacks);
  } else {
    if (webcontainer) {
      actionQueueInstance.setWebContainer(webcontainer);
    }
    if (callbacks) {
      actionQueueInstance.setCallbacks(callbacks);
    }
  }
  return actionQueueInstance;
}
