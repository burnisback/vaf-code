/**
 * Per-File Verifier
 *
 * Phase 3 of the Debugging Strategy Implementation.
 *
 * Verifies a single file IMMEDIATELY after it's written, before proceeding
 * to the next file. This enables:
 * 1. Early detection of errors
 * 2. Immediate rollback of bad changes
 * 3. Prevention of error cascades
 *
 * Key principle: Verify after EACH file, not in a batch at the end
 */

import type { WebContainer } from '@webcontainer/api';
import { StaticAnalyzer, type StaticAnalysisError } from './staticAnalyzer';

// =============================================================================
// TYPES
// =============================================================================

export interface PerFileVerifyResult {
  /** The file that was verified */
  filePath: string;

  /** Whether the file passed verification */
  passed: boolean;

  /** Errors found in this specific file */
  errors: StaticAnalysisError[];

  /** Warnings (non-blocking) */
  warnings: StaticAnalysisError[];

  /** Whether rollback is recommended */
  shouldRollback: boolean;

  /** Reason for rollback recommendation */
  rollbackReason?: string;

  /** Duration of verification in milliseconds */
  duration: number;
}

export interface PerFileVerifierConfig {
  /** Timeout for verification in milliseconds */
  timeout: number;

  /** Whether to recommend rollback on any error */
  rollbackOnAnyError: boolean;

  /** Error codes that should trigger rollback */
  criticalErrorCodes: string[];

  /** Callback for progress updates */
  onProgress?: (message: string) => void;

  /** Callback when rollback is needed */
  onRollbackNeeded?: (filePath: string, reason: string) => void;
}

const DEFAULT_CONFIG: PerFileVerifierConfig = {
  timeout: 30000,
  rollbackOnAnyError: true,
  criticalErrorCodes: [
    'TS2304', // Cannot find name
    'TS2307', // Cannot find module
    'TS2339', // Property does not exist
    'TS2345', // Argument of type X is not assignable
    'TS2322', // Type X is not assignable to type Y
    'TS1005', // Expected X
    'TS1128', // Declaration or statement expected
    'TS1109', // Expression expected
  ],
};

// =============================================================================
// PER-FILE VERIFIER CLASS
// =============================================================================

export class PerFileVerifier {
  private webcontainer: WebContainer;
  private analyzer: StaticAnalyzer;
  private config: PerFileVerifierConfig;

  /** Files that have been verified in this session */
  private verifiedFiles: Map<string, PerFileVerifyResult> = new Map();

  constructor(
    webcontainer: WebContainer,
    config: Partial<PerFileVerifierConfig> = {}
  ) {
    this.webcontainer = webcontainer;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.analyzer = new StaticAnalyzer(webcontainer, {
      timeout: this.config.timeout,
    });
  }

  /**
   * Verify a single file immediately after it's written
   *
   * This is the core method - call it right after each file write
   */
  async verifyFile(filePath: string): Promise<PerFileVerifyResult> {
    const startTime = Date.now();

    this.config.onProgress?.(`[PerFileVerifier] Verifying ${filePath}...`);

    const result: PerFileVerifyResult = {
      filePath,
      passed: true,
      errors: [],
      warnings: [],
      shouldRollback: false,
      duration: 0,
    };

    try {
      // Run type check on the specific file
      const checkResult = await this.analyzer.checkFile(filePath);

      result.errors = checkResult.errors.filter(e => e.severity === 'error');
      result.warnings = checkResult.errors.filter(e => e.severity === 'warning');
      result.passed = checkResult.valid;

      // Determine if rollback is needed
      if (!result.passed) {
        const criticalErrors = result.errors.filter(e =>
          this.config.criticalErrorCodes.includes(e.code)
        );

        if (this.config.rollbackOnAnyError && result.errors.length > 0) {
          result.shouldRollback = true;
          result.rollbackReason = `File has ${result.errors.length} TypeScript error(s)`;
        } else if (criticalErrors.length > 0) {
          result.shouldRollback = true;
          result.rollbackReason = `File has ${criticalErrors.length} critical error(s): ${criticalErrors.map(e => e.code).join(', ')}`;
        }
      }

      // Store result
      this.verifiedFiles.set(filePath, result);

      // Notify if rollback needed
      if (result.shouldRollback && result.rollbackReason) {
        this.config.onRollbackNeeded?.(filePath, result.rollbackReason);
        this.config.onProgress?.(
          `[PerFileVerifier] ROLLBACK NEEDED: ${result.rollbackReason}`
        );
      } else if (result.passed) {
        this.config.onProgress?.(
          `[PerFileVerifier] ${filePath} passed verification`
        );
      } else {
        this.config.onProgress?.(
          `[PerFileVerifier] ${filePath} has ${result.errors.length} error(s) but rollback not required`
        );
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // If verification itself fails, don't recommend rollback
      // (might be a temporary issue)
      this.config.onProgress?.(
        `[PerFileVerifier] Verification failed for ${filePath}: ${errorMessage}`
      );

      result.passed = false;
      result.errors.push({
        code: 'VERIFY_ERROR',
        message: `Verification failed: ${errorMessage}`,
        file: filePath,
        line: 0,
        column: 0,
        severity: 'error',
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Verify multiple files (useful for batch verification)
   */
  async verifyFiles(filePaths: string[]): Promise<Map<string, PerFileVerifyResult>> {
    const results = new Map<string, PerFileVerifyResult>();

    for (const filePath of filePaths) {
      const result = await this.verifyFile(filePath);
      results.set(filePath, result);

      // Stop early if rollback is needed
      if (result.shouldRollback) {
        this.config.onProgress?.(
          `[PerFileVerifier] Stopping batch verification - rollback needed for ${filePath}`
        );
        break;
      }
    }

    return results;
  }

  /**
   * Check if any verified file needs rollback
   */
  needsRollback(): boolean {
    for (const result of this.verifiedFiles.values()) {
      if (result.shouldRollback) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get files that need rollback
   */
  getFilesNeedingRollback(): string[] {
    const files: string[] = [];
    for (const [filePath, result] of this.verifiedFiles) {
      if (result.shouldRollback) {
        files.push(filePath);
      }
    }
    return files;
  }

  /**
   * Get verification result for a specific file
   */
  getResult(filePath: string): PerFileVerifyResult | undefined {
    return this.verifiedFiles.get(filePath);
  }

  /**
   * Get all verification results
   */
  getAllResults(): Map<string, PerFileVerifyResult> {
    return new Map(this.verifiedFiles);
  }

  /**
   * Get summary of all verifications
   */
  getSummary(): {
    totalVerified: number;
    passed: number;
    failed: number;
    needingRollback: number;
    totalErrors: number;
  } {
    let passed = 0;
    let failed = 0;
    let needingRollback = 0;
    let totalErrors = 0;

    for (const result of this.verifiedFiles.values()) {
      if (result.passed) {
        passed++;
      } else {
        failed++;
      }
      if (result.shouldRollback) {
        needingRollback++;
      }
      totalErrors += result.errors.length;
    }

    return {
      totalVerified: this.verifiedFiles.size,
      passed,
      failed,
      needingRollback,
      totalErrors,
    };
  }

  /**
   * Reset the verifier (clear all results)
   */
  reset(): void {
    this.verifiedFiles.clear();
  }

  /**
   * Format results for display
   */
  formatResults(): string {
    const summary = this.getSummary();
    const lines: string[] = [
      `## Per-File Verification Results`,
      '',
      `- Total files verified: ${summary.totalVerified}`,
      `- Passed: ${summary.passed}`,
      `- Failed: ${summary.failed}`,
      `- Needing rollback: ${summary.needingRollback}`,
      `- Total errors: ${summary.totalErrors}`,
      '',
    ];

    for (const [filePath, result] of this.verifiedFiles) {
      const status = result.passed ? '✓' : (result.shouldRollback ? '✗ (rollback)' : '⚠');
      lines.push(`${status} ${filePath}`);

      if (result.errors.length > 0) {
        for (const error of result.errors.slice(0, 3)) {
          lines.push(`  - Line ${error.line}: ${error.code} - ${error.message}`);
        }
        if (result.errors.length > 3) {
          lines.push(`  - ... and ${result.errors.length - 3} more errors`);
        }
      }
    }

    return lines.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a per-file verifier instance
 */
export function createPerFileVerifier(
  webcontainer: WebContainer,
  config?: Partial<PerFileVerifierConfig>
): PerFileVerifier {
  return new PerFileVerifier(webcontainer, config);
}

/**
 * Quick check if a single file has errors
 */
export async function quickVerifyFile(
  webcontainer: WebContainer,
  filePath: string
): Promise<{ passed: boolean; errors: number }> {
  const verifier = new PerFileVerifier(webcontainer);
  const result = await verifier.verifyFile(filePath);
  return {
    passed: result.passed,
    errors: result.errors.length,
  };
}
