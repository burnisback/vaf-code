/**
 * Error Tracker
 *
 * Phase 3 of the Debugging Strategy Implementation.
 *
 * Tracks error counts before and after changes to detect:
 * 1. If errors increased (trigger rollback)
 * 2. If errors decreased (progress made)
 * 3. Before/after comparison for evidence-based completion
 *
 * Key principle: Only proceed if error count decreases or stays the same
 */

import type { WebContainer } from '@webcontainer/api';
import { StaticAnalyzer, type StaticAnalysisResult, type StaticAnalysisError } from './staticAnalyzer';

// =============================================================================
// TYPES
// =============================================================================

export interface ErrorSnapshot {
  /** Unique identifier for this snapshot */
  id: string;

  /** When the snapshot was taken */
  timestamp: number;

  /** Total error count */
  errorCount: number;

  /** Breakdown by file */
  byFile: Map<string, number>;

  /** All errors for detailed comparison */
  errors: StaticAnalysisError[];

  /** Label for this snapshot (e.g., "baseline", "after file1.tsx") */
  label: string;
}

export interface ErrorComparison {
  /** The baseline snapshot */
  baseline: ErrorSnapshot;

  /** The current snapshot */
  current: ErrorSnapshot;

  /** Net change in error count (negative = improvement) */
  delta: number;

  /** Whether errors increased (trigger for rollback) */
  errorsIncreased: boolean;

  /** Whether errors decreased (progress) */
  errorsDecreased: boolean;

  /** New errors that didn't exist before */
  newErrors: StaticAnalysisError[];

  /** Errors that were fixed */
  fixedErrors: StaticAnalysisError[];

  /** Human-readable summary */
  summary: string;
}

export interface ErrorTrackerConfig {
  /** Threshold for acceptable error increase (default: 0) */
  increaseThreshold: number;

  /** Whether to track per-file changes */
  trackPerFile: boolean;

  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

const DEFAULT_CONFIG: ErrorTrackerConfig = {
  increaseThreshold: 0,
  trackPerFile: true,
};

// =============================================================================
// ERROR TRACKER CLASS
// =============================================================================

export class ErrorTracker {
  private webcontainer: WebContainer;
  private analyzer: StaticAnalyzer;
  private config: ErrorTrackerConfig;

  /** All snapshots taken during this session */
  private snapshots: ErrorSnapshot[] = [];

  /** The baseline snapshot (before any changes) */
  private baseline: ErrorSnapshot | null = null;

  /** Counter for generating snapshot IDs */
  private snapshotCounter = 0;

  constructor(
    webcontainer: WebContainer,
    config: Partial<ErrorTrackerConfig> = {}
  ) {
    this.webcontainer = webcontainer;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.analyzer = new StaticAnalyzer(webcontainer, {
      onProgress: config.onProgress,
    });
  }

  /**
   * Take a snapshot of current errors
   * This should be called BEFORE making changes to establish baseline
   */
  async captureBaseline(): Promise<ErrorSnapshot> {
    this.config.onProgress?.('[ErrorTracker] Capturing baseline error state...');

    const result = await this.analyzer.analyze();
    const snapshot = this.createSnapshot(result, 'baseline');

    this.baseline = snapshot;
    this.snapshots.push(snapshot);

    this.config.onProgress?.(
      `[ErrorTracker] Baseline: ${snapshot.errorCount} error(s)`
    );

    return snapshot;
  }

  /**
   * Take a snapshot of current errors with a custom label
   */
  async captureSnapshot(label: string): Promise<ErrorSnapshot> {
    const result = await this.analyzer.analyze();
    const snapshot = this.createSnapshot(result, label);

    this.snapshots.push(snapshot);

    return snapshot;
  }

  /**
   * Check if current error state is acceptable compared to baseline
   * Returns true if errors did not increase beyond threshold
   */
  async checkErrorState(): Promise<{
    acceptable: boolean;
    comparison: ErrorComparison | null;
    message: string;
  }> {
    if (!this.baseline) {
      return {
        acceptable: true,
        comparison: null,
        message: 'No baseline captured - accepting current state',
      };
    }

    const current = await this.captureSnapshot('current');
    const comparison = this.compare(this.baseline, current);

    const acceptable = !comparison.errorsIncreased ||
      comparison.delta <= this.config.increaseThreshold;

    return {
      acceptable,
      comparison,
      message: comparison.summary,
    };
  }

  /**
   * Quick check after a single file change
   * Returns true if the change didn't introduce new errors
   */
  async checkAfterFileChange(filePath: string): Promise<{
    acceptable: boolean;
    newErrors: StaticAnalysisError[];
    message: string;
  }> {
    // Run quick analysis on just the changed file
    const fileResult = await this.analyzer.checkFile(filePath);

    if (fileResult.valid) {
      return {
        acceptable: true,
        newErrors: [],
        message: `File ${filePath} has no TypeScript errors`,
      };
    }

    // Check if these are NEW errors (not existing before)
    const newErrors = this.baseline
      ? this.findNewErrors(fileResult.errors, this.baseline.errors)
      : fileResult.errors;

    return {
      acceptable: newErrors.length === 0,
      newErrors,
      message: newErrors.length > 0
        ? `File ${filePath} introduced ${newErrors.length} new error(s)`
        : `File ${filePath} has errors but they existed before`,
    };
  }

  /**
   * Get the baseline snapshot
   */
  getBaseline(): ErrorSnapshot | null {
    return this.baseline;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): ErrorSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get the most recent snapshot
   */
  getLatestSnapshot(): ErrorSnapshot | null {
    return this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : null;
  }

  /**
   * Compare two snapshots
   */
  compare(baseline: ErrorSnapshot, current: ErrorSnapshot): ErrorComparison {
    const delta = current.errorCount - baseline.errorCount;
    const errorsIncreased = delta > 0;
    const errorsDecreased = delta < 0;

    // Find new and fixed errors
    const newErrors = this.findNewErrors(current.errors, baseline.errors);
    const fixedErrors = this.findNewErrors(baseline.errors, current.errors);

    // Build summary
    let summary: string;
    if (delta === 0) {
      summary = 'No change in error count';
    } else if (delta > 0) {
      summary = `Error count increased by ${delta} (${baseline.errorCount} -> ${current.errorCount})`;
    } else {
      summary = `Error count decreased by ${Math.abs(delta)} (${baseline.errorCount} -> ${current.errorCount})`;
    }

    return {
      baseline,
      current,
      delta,
      errorsIncreased,
      errorsDecreased,
      newErrors,
      fixedErrors,
      summary,
    };
  }

  /**
   * Generate evidence report for completion
   */
  generateEvidenceReport(): string {
    if (!this.baseline) {
      return 'No baseline captured - cannot generate evidence report';
    }

    const current = this.getLatestSnapshot();
    if (!current) {
      return 'No current snapshot - cannot generate evidence report';
    }

    const comparison = this.compare(this.baseline, current);

    const lines: string[] = [
      '## Error Resolution Evidence',
      '',
      `| Metric | Before | After | Change |`,
      `|--------|--------|-------|--------|`,
      `| Total Errors | ${comparison.baseline.errorCount} | ${comparison.current.errorCount} | ${comparison.delta >= 0 ? '+' : ''}${comparison.delta} |`,
      '',
    ];

    if (comparison.fixedErrors.length > 0) {
      lines.push('### Fixed Errors:');
      for (const error of comparison.fixedErrors.slice(0, 10)) {
        lines.push(`- ${error.file}:${error.line} - ${error.code}: ${error.message}`);
      }
      if (comparison.fixedErrors.length > 10) {
        lines.push(`- ... and ${comparison.fixedErrors.length - 10} more`);
      }
      lines.push('');
    }

    if (comparison.newErrors.length > 0) {
      lines.push('### New Errors Introduced:');
      for (const error of comparison.newErrors.slice(0, 10)) {
        lines.push(`- ${error.file}:${error.line} - ${error.code}: ${error.message}`);
      }
      if (comparison.newErrors.length > 10) {
        lines.push(`- ... and ${comparison.newErrors.length - 10} more`);
      }
      lines.push('');
    }

    if (comparison.current.errorCount === 0) {
      lines.push('**All errors have been resolved.**');
    } else if (comparison.errorsDecreased) {
      lines.push(`**Progress made:** ${Math.abs(comparison.delta)} error(s) fixed.`);
    } else if (comparison.errorsIncreased) {
      lines.push(`**Warning:** ${comparison.delta} new error(s) introduced.`);
    }

    return lines.join('\n');
  }

  /**
   * Reset the tracker (clear all snapshots)
   */
  reset(): void {
    this.snapshots = [];
    this.baseline = null;
    this.snapshotCounter = 0;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Create a snapshot from static analysis result
   */
  private createSnapshot(
    result: StaticAnalysisResult,
    label: string
  ): ErrorSnapshot {
    const byFile = new Map<string, number>();

    for (const error of result.errors) {
      const file = error.file || '(unknown)';
      byFile.set(file, (byFile.get(file) || 0) + 1);
    }

    return {
      id: `snapshot_${++this.snapshotCounter}_${Date.now()}`,
      timestamp: Date.now(),
      errorCount: result.errors.length,
      byFile,
      errors: result.errors,
      label,
    };
  }

  /**
   * Find errors in 'current' that don't exist in 'baseline'
   */
  private findNewErrors(
    current: StaticAnalysisError[],
    baseline: StaticAnalysisError[]
  ): StaticAnalysisError[] {
    const baselineSet = new Set(
      baseline.map(e => `${e.file}:${e.line}:${e.code}`)
    );

    return current.filter(e => {
      const key = `${e.file}:${e.line}:${e.code}`;
      return !baselineSet.has(key);
    });
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an error tracker instance
 */
export function createErrorTracker(
  webcontainer: WebContainer,
  config?: Partial<ErrorTrackerConfig>
): ErrorTracker {
  return new ErrorTracker(webcontainer, config);
}

/**
 * Quick check if errors increased
 */
export async function didErrorsIncrease(
  webcontainer: WebContainer,
  baseline: ErrorSnapshot
): Promise<boolean> {
  const tracker = new ErrorTracker(webcontainer);
  const current = await tracker.captureSnapshot('check');
  const comparison = tracker.compare(baseline, current);
  return comparison.errorsIncreased;
}
