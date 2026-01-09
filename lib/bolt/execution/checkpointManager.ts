/**
 * Checkpoint Manager
 *
 * Provides named checkpoint/restore point functionality for batch operations.
 * Allows creating snapshots of file states that can be restored later.
 *
 * Use Cases:
 * - Create checkpoint before risky multi-file operations
 * - Restore to known-good state after failed fix attempts
 * - Named restore points for different implementation approaches
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FileSnapshot {
  /** File path */
  path: string;
  /** File content at snapshot time */
  content: string;
  /** Whether file existed at snapshot time */
  existed: boolean;
}

export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string;
  /** User-provided name for the checkpoint */
  name: string;
  /** Description or reason for checkpoint */
  description?: string;
  /** Timestamp when checkpoint was created */
  timestamp: number;
  /** Snapshot of all tracked files */
  files: FileSnapshot[];
  /** Error count at checkpoint time (if known) */
  errorCount?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface CheckpointManagerConfig {
  /** Maximum checkpoints to retain */
  maxCheckpoints: number;
  /** Function to read file content */
  readFile: (path: string) => Promise<string | null>;
  /** Function to write file content */
  writeFile: (path: string, content: string) => Promise<void>;
  /** Function to delete a file */
  deleteFile: (path: string) => Promise<void>;
  /** Optional callback when checkpoint is created */
  onCheckpointCreated?: (checkpoint: Checkpoint) => void;
  /** Optional callback when checkpoint is restored */
  onCheckpointRestored?: (checkpoint: Checkpoint, restoredCount: number) => void;
}

export interface RestoreResult {
  /** Whether restore was successful */
  success: boolean;
  /** Checkpoint that was restored */
  checkpoint: Checkpoint;
  /** Number of files restored */
  filesRestored: number;
  /** Number of files deleted (didn't exist at checkpoint) */
  filesDeleted: number;
  /** Files that failed to restore */
  failures: Array<{ path: string; error: string }>;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: Partial<CheckpointManagerConfig> = {
  maxCheckpoints: 10,
};

// =============================================================================
// CHECKPOINT MANAGER CLASS
// =============================================================================

export class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private config: CheckpointManagerConfig;
  private checkpointCounter = 0;

  constructor(config: CheckpointManagerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as CheckpointManagerConfig;
  }

  /**
   * Create a new checkpoint with the specified files
   */
  async createCheckpoint(
    name: string,
    filePaths: string[],
    options: {
      description?: string;
      errorCount?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<Checkpoint> {
    const id = `checkpoint_${++this.checkpointCounter}_${Date.now()}`;

    // Capture file snapshots
    const files: FileSnapshot[] = [];
    for (const path of filePaths) {
      const content = await this.config.readFile(path);
      files.push({
        path,
        content: content ?? '',
        existed: content !== null,
      });
    }

    const checkpoint: Checkpoint = {
      id,
      name,
      description: options.description,
      timestamp: Date.now(),
      files,
      errorCount: options.errorCount,
      metadata: options.metadata,
    };

    this.checkpoints.set(id, checkpoint);

    // Enforce max checkpoints
    this.trimCheckpoints();

    this.config.onCheckpointCreated?.(checkpoint);

    return checkpoint;
  }

  /**
   * Create a quick auto-checkpoint with timestamp-based name
   */
  async autoCheckpoint(
    filePaths: string[],
    reason?: string
  ): Promise<Checkpoint> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `auto_${timestamp}`;
    return this.createCheckpoint(name, filePaths, {
      description: reason || 'Auto-checkpoint',
    });
  }

  /**
   * Restore to a specific checkpoint
   */
  async restoreCheckpoint(checkpointId: string): Promise<RestoreResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return {
        success: false,
        checkpoint: { id: checkpointId, name: 'unknown', timestamp: 0, files: [] },
        filesRestored: 0,
        filesDeleted: 0,
        failures: [{ path: '', error: `Checkpoint not found: ${checkpointId}` }],
      };
    }

    let filesRestored = 0;
    let filesDeleted = 0;
    const failures: Array<{ path: string; error: string }> = [];

    for (const snapshot of checkpoint.files) {
      try {
        if (snapshot.existed) {
          // Restore file content
          await this.config.writeFile(snapshot.path, snapshot.content);
          filesRestored++;
        } else {
          // File didn't exist at checkpoint - delete it
          try {
            await this.config.deleteFile(snapshot.path);
            filesDeleted++;
          } catch {
            // File might not exist now either, which is fine
          }
        }
      } catch (error) {
        failures.push({
          path: snapshot.path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const result: RestoreResult = {
      success: failures.length === 0,
      checkpoint,
      filesRestored,
      filesDeleted,
      failures,
    };

    this.config.onCheckpointRestored?.(checkpoint, filesRestored + filesDeleted);

    return result;
  }

  /**
   * Restore to the most recent checkpoint
   */
  async restoreLatest(): Promise<RestoreResult | null> {
    const latest = this.getLatestCheckpoint();
    if (!latest) {
      return null;
    }
    return this.restoreCheckpoint(latest.id);
  }

  /**
   * Restore to a checkpoint by name
   */
  async restoreByName(name: string): Promise<RestoreResult | null> {
    const checkpoint = this.getCheckpointByName(name);
    if (!checkpoint) {
      return null;
    }
    return this.restoreCheckpoint(checkpoint.id);
  }

  /**
   * Get a checkpoint by ID
   */
  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  /**
   * Get a checkpoint by name
   */
  getCheckpointByName(name: string): Checkpoint | undefined {
    return Array.from(this.checkpoints.values()).find(cp => cp.name === name);
  }

  /**
   * Get the most recent checkpoint
   */
  getLatestCheckpoint(): Checkpoint | undefined {
    const sorted = this.listCheckpoints();
    return sorted[0];
  }

  /**
   * List all checkpoints (newest first)
   */
  listCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Delete a checkpoint
   */
  deleteCheckpoint(id: string): boolean {
    return this.checkpoints.delete(id);
  }

  /**
   * Clear all checkpoints
   */
  clearAll(): void {
    this.checkpoints.clear();
  }

  /**
   * Get checkpoint count
   */
  getCount(): number {
    return this.checkpoints.size;
  }

  /**
   * Check if a checkpoint exists
   */
  hasCheckpoint(id: string): boolean {
    return this.checkpoints.has(id);
  }

  /**
   * Format checkpoints for display
   */
  formatCheckpoints(): string {
    const checkpoints = this.listCheckpoints();
    if (checkpoints.length === 0) {
      return 'No checkpoints available.';
    }

    const lines = ['## Available Checkpoints', ''];
    for (const cp of checkpoints) {
      const date = new Date(cp.timestamp).toLocaleString();
      const errorInfo = cp.errorCount !== undefined ? ` (${cp.errorCount} errors)` : '';
      lines.push(`- **${cp.name}**${errorInfo}`);
      lines.push(`  - ID: ${cp.id}`);
      lines.push(`  - Created: ${date}`);
      lines.push(`  - Files: ${cp.files.length}`);
      if (cp.description) {
        lines.push(`  - Note: ${cp.description}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Trim old checkpoints to stay under max limit
   */
  private trimCheckpoints(): void {
    const maxCheckpoints = this.config.maxCheckpoints;
    if (this.checkpoints.size <= maxCheckpoints) {
      return;
    }

    // Sort by timestamp, oldest first
    const sorted = Array.from(this.checkpoints.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest until at limit
    while (sorted.length > maxCheckpoints) {
      const [id] = sorted.shift()!;
      this.checkpoints.delete(id);
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a checkpoint manager instance
 */
export function createCheckpointManager(
  config: CheckpointManagerConfig
): CheckpointManager {
  return new CheckpointManager(config);
}
