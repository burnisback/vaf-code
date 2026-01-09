/**
 * Rollback Controller
 *
 * Phase 3 of the Debugging Strategy Implementation.
 *
 * Orchestrates rollback decisions and execution:
 * 1. Tracks all files modified in current operation
 * 2. Decides when to trigger rollback (error increase, critical failures)
 * 3. Executes batch rollback of all changes
 * 4. Provides recovery state for retry
 *
 * Key principle: If changes make things worse, restore previous state
 */

import type { WebContainer } from '@webcontainer/api';
import { ErrorTracker, type ErrorSnapshot, type ErrorComparison } from './errorTracker';
import { PerFileVerifier, type PerFileVerifyResult } from './perFileVerifier';

// =============================================================================
// TYPES
// =============================================================================

export interface FileChange {
  /** File path */
  path: string;

  /** Type of change */
  type: 'create' | 'modify' | 'delete';

  /** Original content (null if file didn't exist) */
  originalContent: string | null;

  /** New content (null if deleted) */
  newContent: string | null;

  /** When the change was made */
  timestamp: number;

  /** Whether the change has been rolled back */
  rolledBack: boolean;

  /** Verification result if available */
  verifyResult?: PerFileVerifyResult;
}

export interface RollbackResult {
  /** Whether rollback was successful */
  success: boolean;

  /** Number of files rolled back */
  filesRolledBack: number;

  /** Any errors during rollback */
  errors: string[];

  /** Duration in milliseconds */
  duration: number;
}

export interface RollbackDecision {
  /** Whether to rollback */
  shouldRollback: boolean;

  /** Reason for decision */
  reason: string;

  /** Files to rollback */
  filesToRollback: string[];

  /** Severity of the issue */
  severity: 'critical' | 'error' | 'warning' | 'none';
}

export interface RollbackControllerConfig {
  /** Auto-rollback when errors increase */
  autoRollbackOnErrorIncrease: boolean;

  /** Auto-rollback when per-file verification fails */
  autoRollbackOnVerifyFail: boolean;

  /** Maximum allowed error increase before rollback */
  maxErrorIncrease: number;

  /** Callback for progress updates */
  onProgress?: (message: string) => void;

  /** Callback when rollback is triggered */
  onRollback?: (decision: RollbackDecision) => void;

  /** Callback when rollback completes */
  onRollbackComplete?: (result: RollbackResult) => void;
}

const DEFAULT_CONFIG: RollbackControllerConfig = {
  autoRollbackOnErrorIncrease: true,
  autoRollbackOnVerifyFail: true,
  maxErrorIncrease: 0,
};

// =============================================================================
// ROLLBACK CONTROLLER CLASS
// =============================================================================

export class RollbackController {
  private webcontainer: WebContainer;
  private config: RollbackControllerConfig;

  /** Error tracker for baseline comparison */
  private errorTracker: ErrorTracker;

  /** Per-file verifier for quick checks */
  private perFileVerifier: PerFileVerifier;

  /** All changes tracked in this session */
  private changes: Map<string, FileChange> = new Map();

  /** Whether a rollback has been executed */
  private rollbackExecuted = false;

  /** Last rollback result */
  private lastRollbackResult: RollbackResult | null = null;

  constructor(
    webcontainer: WebContainer,
    config: Partial<RollbackControllerConfig> = {}
  ) {
    this.webcontainer = webcontainer;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.errorTracker = new ErrorTracker(webcontainer, {
      onProgress: config.onProgress,
    });

    this.perFileVerifier = new PerFileVerifier(webcontainer, {
      onProgress: config.onProgress,
      onRollbackNeeded: (filePath, reason) => {
        this.config.onProgress?.(
          `[RollbackController] Per-file verification failed: ${filePath} - ${reason}`
        );
      },
    });
  }

  /**
   * Start tracking a new batch of changes
   * Should be called BEFORE any modifications
   */
  async startTracking(): Promise<ErrorSnapshot> {
    this.config.onProgress?.('[RollbackController] Starting change tracking...');

    // Reset state
    this.changes.clear();
    this.rollbackExecuted = false;
    this.lastRollbackResult = null;
    this.perFileVerifier.reset();

    // Capture baseline
    const baseline = await this.errorTracker.captureBaseline();

    this.config.onProgress?.(
      `[RollbackController] Baseline captured: ${baseline.errorCount} error(s)`
    );

    return baseline;
  }

  /**
   * Record a file change (call this BEFORE making the actual change)
   */
  async recordChange(
    filePath: string,
    type: 'create' | 'modify' | 'delete',
    newContent: string | null
  ): Promise<void> {
    // Read original content
    let originalContent: string | null = null;
    try {
      originalContent = await this.webcontainer.fs.readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist
    }

    const change: FileChange = {
      path: filePath,
      type,
      originalContent,
      newContent,
      timestamp: Date.now(),
      rolledBack: false,
    };

    this.changes.set(filePath, change);

    this.config.onProgress?.(
      `[RollbackController] Recorded ${type} for ${filePath}`
    );
  }

  /**
   * Verify a file after change and decide if rollback is needed
   */
  async verifyAndDecide(filePath: string): Promise<RollbackDecision> {
    const verifyResult = await this.perFileVerifier.verifyFile(filePath);

    // Store result in change record
    const change = this.changes.get(filePath);
    if (change) {
      change.verifyResult = verifyResult;
    }

    // Check if rollback needed
    if (verifyResult.shouldRollback && this.config.autoRollbackOnVerifyFail) {
      const decision: RollbackDecision = {
        shouldRollback: true,
        reason: verifyResult.rollbackReason || 'Per-file verification failed',
        filesToRollback: [filePath],
        severity: 'error',
      };

      this.config.onRollback?.(decision);
      return decision;
    }

    return {
      shouldRollback: false,
      reason: 'Verification passed',
      filesToRollback: [],
      severity: 'none',
    };
  }

  /**
   * Check if errors increased compared to baseline
   */
  async checkErrorIncrease(): Promise<RollbackDecision> {
    const state = await this.errorTracker.checkErrorState();

    if (!state.comparison) {
      return {
        shouldRollback: false,
        reason: 'No baseline for comparison',
        filesToRollback: [],
        severity: 'none',
      };
    }

    const { comparison } = state;

    if (comparison.errorsIncreased && comparison.delta > this.config.maxErrorIncrease) {
      const decision: RollbackDecision = {
        shouldRollback: this.config.autoRollbackOnErrorIncrease,
        reason: comparison.summary,
        filesToRollback: Array.from(this.changes.keys()),
        severity: 'critical',
      };

      if (decision.shouldRollback) {
        this.config.onRollback?.(decision);
      }

      return decision;
    }

    return {
      shouldRollback: false,
      reason: comparison.summary,
      filesToRollback: [],
      severity: comparison.errorsDecreased ? 'none' : 'warning',
    };
  }

  /**
   * Execute rollback of specified files
   */
  async rollback(filePaths?: string[]): Promise<RollbackResult> {
    const startTime = Date.now();
    const pathsToRollback = filePaths || Array.from(this.changes.keys());

    this.config.onProgress?.(
      `[RollbackController] Rolling back ${pathsToRollback.length} file(s)...`
    );

    const result: RollbackResult = {
      success: true,
      filesRolledBack: 0,
      errors: [],
      duration: 0,
    };

    // Roll back in reverse order (newest first)
    const sortedChanges = pathsToRollback
      .map(path => this.changes.get(path))
      .filter((c): c is FileChange => c !== undefined && !c.rolledBack)
      .sort((a, b) => b.timestamp - a.timestamp);

    for (const change of sortedChanges) {
      try {
        await this.rollbackChange(change);
        change.rolledBack = true;
        result.filesRolledBack++;

        this.config.onProgress?.(
          `[RollbackController] Rolled back ${change.path}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to rollback ${change.path}: ${errorMessage}`);
        result.success = false;

        this.config.onProgress?.(
          `[RollbackController] Failed to rollback ${change.path}: ${errorMessage}`
        );
      }
    }

    result.duration = Date.now() - startTime;
    this.rollbackExecuted = true;
    this.lastRollbackResult = result;

    this.config.onRollbackComplete?.(result);

    this.config.onProgress?.(
      `[RollbackController] Rollback complete: ${result.filesRolledBack} file(s) restored`
    );

    return result;
  }

  /**
   * Rollback all tracked changes
   */
  async rollbackAll(): Promise<RollbackResult> {
    return this.rollback();
  }

  /**
   * Get tracked changes
   */
  getChanges(): Map<string, FileChange> {
    return new Map(this.changes);
  }

  /**
   * Get changes that haven't been rolled back
   */
  getPendingChanges(): FileChange[] {
    return Array.from(this.changes.values()).filter(c => !c.rolledBack);
  }

  /**
   * Check if any changes have been tracked
   */
  hasChanges(): boolean {
    return this.changes.size > 0;
  }

  /**
   * Check if rollback was executed
   */
  wasRollbackExecuted(): boolean {
    return this.rollbackExecuted;
  }

  /**
   * Get last rollback result
   */
  getLastRollbackResult(): RollbackResult | null {
    return this.lastRollbackResult;
  }

  /**
   * Get error tracker for external access
   */
  getErrorTracker(): ErrorTracker {
    return this.errorTracker;
  }

  /**
   * Get per-file verifier for external access
   */
  getPerFileVerifier(): PerFileVerifier {
    return this.perFileVerifier;
  }

  /**
   * Generate status report
   */
  getStatusReport(): string {
    const lines: string[] = [
      '## Rollback Controller Status',
      '',
    ];

    const pendingChanges = this.getPendingChanges();
    const rolledBackChanges = Array.from(this.changes.values()).filter(c => c.rolledBack);

    lines.push(`- Total changes tracked: ${this.changes.size}`);
    lines.push(`- Pending (not rolled back): ${pendingChanges.length}`);
    lines.push(`- Rolled back: ${rolledBackChanges.length}`);
    lines.push(`- Rollback executed: ${this.rollbackExecuted}`);
    lines.push('');

    if (pendingChanges.length > 0) {
      lines.push('### Pending Changes:');
      for (const change of pendingChanges) {
        const status = change.verifyResult?.passed ? '✓' : '✗';
        lines.push(`  ${status} ${change.type} ${change.path}`);
      }
      lines.push('');
    }

    if (rolledBackChanges.length > 0) {
      lines.push('### Rolled Back:');
      for (const change of rolledBackChanges) {
        lines.push(`  ↩ ${change.path}`);
      }
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Rollback a single change
   */
  private async rollbackChange(change: FileChange): Promise<void> {
    switch (change.type) {
      case 'create':
        // File was created - delete it
        if (change.originalContent === null) {
          await this.webcontainer.fs.rm(change.path);
        } else {
          // File existed but was overwritten - restore
          await this.webcontainer.fs.writeFile(change.path, change.originalContent);
        }
        break;

      case 'modify':
        // File was modified - restore original content
        if (change.originalContent !== null) {
          await this.webcontainer.fs.writeFile(change.path, change.originalContent);
        }
        break;

      case 'delete':
        // File was deleted - recreate it
        if (change.originalContent !== null) {
          // Ensure directory exists
          const dirPath = change.path.split('/').slice(0, -1).join('/');
          if (dirPath) {
            await this.webcontainer.fs.mkdir(dirPath, { recursive: true });
          }
          await this.webcontainer.fs.writeFile(change.path, change.originalContent);
        }
        break;
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a rollback controller instance
 */
export function createRollbackController(
  webcontainer: WebContainer,
  config?: Partial<RollbackControllerConfig>
): RollbackController {
  return new RollbackController(webcontainer, config);
}
