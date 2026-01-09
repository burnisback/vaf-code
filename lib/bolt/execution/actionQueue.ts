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

  // Phase 3: Per-file verification callbacks
  /** Called after a file is written - return false to trigger rollback */
  onFileVerify?: (filePath: string) => Promise<{ valid: boolean; errors: string[] }>;
  /** Called when auto-rollback is triggered */
  onAutoRollback?: (filePath: string, reason: string) => void;
}

export interface ActionQueueConfig {
  /** Enable per-file verification after writes (Phase 3) */
  enablePerFileVerify: boolean;
  /** Auto-rollback on verification failure (Phase 3) */
  autoRollbackOnFailure: boolean;
  /** Maximum history size */
  maxHistorySize: number;
}

const DEFAULT_QUEUE_CONFIG: ActionQueueConfig = {
  enablePerFileVerify: false, // Off by default, enable via configuration
  autoRollbackOnFailure: true,
  maxHistorySize: 50,
};

// =============================================================================
// DANGEROUS COMMAND DETECTION (Phase 2)
// =============================================================================

/**
 * Patterns that indicate dangerous/destructive commands
 */
const DANGEROUS_PATTERNS = [
  // File deletion
  /\brm\s+(-rf?|--recursive|--force)?\s*[^\s|&;]+/i,
  /\brmdir\s+/i,
  /\bdel\s+/i,
  // Directory operations that could be destructive
  /\bmv\s+.*\s+\/dev\/null/i,
  // Git destructive operations
  /\bgit\s+(push\s+--force|reset\s+--hard|clean\s+-fd)/i,
];

/**
 * Check if a shell command is dangerous/destructive
 */
export function isDangerousCommand(command: string): { dangerous: boolean; reason?: string } {
  const normalized = command.trim().toLowerCase();

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(normalized)) {
      // Determine specific reason
      if (/\brm\s/.test(normalized)) {
        return {
          dangerous: true,
          reason: 'rm command bypasses file tracking and rollback. Use delete action type instead.',
        };
      }
      if (/\brmdir\s/.test(normalized) || /\bdel\s/.test(normalized)) {
        return {
          dangerous: true,
          reason: 'Directory deletion command detected. Use tracked delete operations.',
        };
      }
      if (/\bgit\s+push\s+--force/.test(normalized)) {
        return {
          dangerous: true,
          reason: 'Force push can destroy remote history. Manual confirmation required.',
        };
      }
      if (/\bgit\s+reset\s+--hard/.test(normalized)) {
        return {
          dangerous: true,
          reason: 'Hard reset can lose uncommitted changes.',
        };
      }
      return { dangerous: true, reason: 'Potentially destructive operation.' };
    }
  }

  return { dangerous: false };
}

/**
 * Extract file paths from rm commands for conversion to delete actions
 */
export function extractRmPaths(command: string): string[] {
  // Match: rm [-rf] path1 path2 ...
  const match = command.match(/\brm\s+(?:-[rfRF]+\s+)?(.+)/);
  if (!match) return [];

  // Split paths, handling quotes
  const pathsPart = match[1];
  const paths: string[] = [];

  // Simple split - could be improved for quoted paths
  const tokens = pathsPart.split(/\s+/).filter(t => !t.startsWith('-'));

  for (const token of tokens) {
    // Remove quotes
    const cleaned = token.replace(/^["']|["']$/g, '').trim();
    if (cleaned) {
      paths.push(cleaned);
    }
  }

  return paths;
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
  private config: ActionQueueConfig;
  private isProcessing = false;

  // Phase 3: Track files modified in current batch for potential rollback
  private currentBatchFiles: string[] = [];

  constructor(
    webcontainer: WebContainer | null,
    callbacks?: ActionQueueCallbacks,
    config?: Partial<ActionQueueConfig>
  ) {
    this.webcontainer = webcontainer;
    this.callbacks = callbacks || {};
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ActionQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable Phase 3 per-file verification
   */
  enablePerFileVerification(enabled: boolean = true): void {
    this.config.enablePerFileVerify = enabled;
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
    } else if (action.type === 'delete' && action.filePath) {
      return this.executeDeleteAction(action);
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
   * Execute a delete action with backup and reference checking
   * Phase 2: Safe file deletion with tracking
   */
  private async executeDeleteAction(action: QueuedAction): Promise<BoltExecutionResult> {
    const { filePath } = action;
    if (!filePath || !this.webcontainer) {
      return { type: 'delete', success: false, error: 'Invalid delete action' };
    }

    try {
      // Check if file exists
      let existingContent: string | null = null;
      try {
        existingContent = await this.webcontainer.fs.readFile(filePath, 'utf-8');
      } catch {
        // File doesn't exist - nothing to delete
        this.callbacks.onTerminalOutput?.(
          `\x1b[33m[Bolt] File ${filePath} does not exist, skipping delete\x1b[0m\r\n`
        );
        return {
          type: 'delete',
          path: filePath,
          success: true, // Success - nothing to do
        };
      }

      // Create backup before deletion
      action.backup = {
        path: filePath,
        content: existingContent,
        createdAt: Date.now(),
      };

      this.callbacks.onProgress?.(`Deleting ${filePath}...`);
      this.callbacks.onTerminalOutput?.(
        `\x1b[33m[Bolt] Deleting ${filePath}...\x1b[0m\r\n`
      );

      // Perform the deletion
      await this.webcontainer.fs.rm(filePath);

      this.callbacks.onTerminalOutput?.(
        `\x1b[32m[Bolt] ✓ Deleted ${filePath} (backup saved for rollback)\x1b[0m\r\n`
      );

      this.callbacks.onFilesystemChange?.();

      return {
        type: 'delete',
        path: filePath,
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onTerminalOutput?.(
        `\x1b[31m[Bolt] ✗ Failed to delete ${filePath}: ${message}\x1b[0m\r\n`
      );

      return {
        type: 'delete',
        path: filePath,
        success: false,
        error: message,
      };
    }
  }

  /**
   * Execute a file action with backup
   * Phase 3: Now includes optional per-file verification after write
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

      // Track file for potential batch rollback
      this.currentBatchFiles.push(filePath);

      // Phase 3: Per-file verification after write
      if (this.config.enablePerFileVerify && this.callbacks.onFileVerify) {
        this.callbacks.onTerminalOutput?.(
          `\x1b[36m[Bolt] Verifying ${filePath}...\x1b[0m\r\n`
        );

        const verifyResult = await this.callbacks.onFileVerify(filePath);

        if (!verifyResult.valid) {
          // Verification failed - optionally auto-rollback
          this.callbacks.onTerminalOutput?.(
            `\x1b[31m[Bolt] ✗ Verification failed for ${filePath}\x1b[0m\r\n`
          );

          for (const error of verifyResult.errors.slice(0, 3)) {
            this.callbacks.onTerminalOutput?.(
              `\x1b[31m[Bolt]   - ${error}\x1b[0m\r\n`
            );
          }

          if (this.config.autoRollbackOnFailure) {
            // Rollback this file immediately
            this.callbacks.onTerminalOutput?.(
              `\x1b[33m[Bolt] ↩ Auto-rolling back ${filePath}...\x1b[0m\r\n`
            );

            await this.rollbackSingleFile(action);

            this.callbacks.onAutoRollback?.(
              filePath,
              `Verification failed: ${verifyResult.errors.join(', ')}`
            );

            return {
              type: 'file',
              path: filePath,
              success: false,
              error: `Verification failed (auto-rolled back): ${verifyResult.errors.join(', ')}`,
            };
          }
        } else {
          this.callbacks.onTerminalOutput?.(
            `\x1b[32m[Bolt] ✓ ${filePath} verified\x1b[0m\r\n`
          );
        }
      }

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
   * Phase 3: Rollback a single file from its backup
   */
  private async rollbackSingleFile(action: QueuedAction): Promise<boolean> {
    if (!action.backup || !this.webcontainer) {
      return false;
    }

    try {
      const { backup } = action;

      if (backup.content === null) {
        // File didn't exist before - delete it
        await this.webcontainer.fs.rm(backup.path);
      } else {
        // Restore previous content
        await this.webcontainer.fs.writeFile(backup.path, backup.content);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Phase 3: Get files modified in current batch
   */
  getCurrentBatchFiles(): string[] {
    return [...this.currentBatchFiles];
  }

  /**
   * Phase 3: Clear current batch tracking
   */
  clearCurrentBatch(): void {
    this.currentBatchFiles = [];
  }

  /**
   * Execute a shell action with enhanced progress
   * Phase 2: Includes dangerous command detection
   */
  private async executeShellAction(action: QueuedAction): Promise<BoltExecutionResult> {
    if (!this.webcontainer) {
      return { type: 'shell', success: false, error: 'WebContainer not available' };
    }

    const command = action.content.trim();

    // Phase 2 + Fix: Convert rm commands to delete actions instead of blocking
    if (/\brm\s/.test(command.toLowerCase())) {
      const paths = extractRmPaths(command);
      if (paths.length > 0) {
        this.callbacks.onTerminalOutput?.(
          `\x1b[33m[Bolt] Converting rm command to tracked delete operations...\x1b[0m\r\n`
        );

        // Execute delete actions for each path
        let allSuccess = true;
        const errors: string[] = [];

        for (const filePath of paths) {
          const deleteAction: QueuedAction = {
            id: generateActionId(),
            type: 'delete',
            filePath,
            content: '',
            status: 'pending',
            queuedAt: Date.now(),
          };

          const result = await this.executeDeleteAction(deleteAction);
          if (!result.success) {
            allSuccess = false;
            errors.push(result.error || `Failed to delete ${filePath}`);
          }
        }

        if (allSuccess) {
          return {
            type: 'shell',
            command,
            success: true,
            exitCode: 0,
          };
        } else {
          return {
            type: 'shell',
            command,
            success: false,
            error: `Some deletions failed: ${errors.join(', ')}`,
          };
        }
      }
    }

    // Phase 2: Check for other dangerous commands (not rm)
    const dangerCheck = isDangerousCommand(command);
    if (dangerCheck.dangerous && !/\brm\s/.test(command.toLowerCase())) {
      const blockedMsg = `BLOCKED: ${dangerCheck.reason}`;

      this.callbacks.onTerminalOutput?.(
        `\x1b[31m[Bolt] ⛔ Command blocked: ${command}\x1b[0m\r\n`
      );
      this.callbacks.onTerminalOutput?.(
        `\x1b[31m[Bolt] Reason: ${dangerCheck.reason}\x1b[0m\r\n`
      );

      return {
        type: 'shell',
        command,
        success: false,
        error: blockedMsg,
      };
    }

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
    if (this.state.history.length > this.config.maxHistorySize) {
      this.state.history = this.state.history.slice(0, this.config.maxHistorySize);
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
