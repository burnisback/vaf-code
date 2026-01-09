/**
 * Evidence Reporter - Phase 4: Evidence-Based Completion
 *
 * Ensures that "fixed" claims are backed by actual verification evidence.
 * Prevents false completion claims and provides before/after comparison.
 *
 * Strategy Requirements:
 * - Cannot claim "fixed" without running verification
 * - Must show before/after error counts
 * - Completion message with proof: TypeScript, Build, Tests status
 */

import type { WebContainer } from '@webcontainer/api';
import type { StaticAnalysisResult } from './staticAnalyzer';
import type { BuildResult } from './buildRunner';

// =============================================================================
// TYPES
// =============================================================================

export interface ErrorCounts {
  /** TypeScript errors from tsc --noEmit */
  typescript: number;
  /** Build errors from npm run build */
  build: number;
  /** Lint errors from npm run lint */
  lint: number;
  /** Test failures from npm test */
  tests: {
    passed: number;
    failed: number;
    total: number;
  };
  /** Runtime errors captured from browser */
  runtime: number;
  /** Total error count */
  total: number;
}

export interface VerificationEvidence {
  /** When verification was run */
  timestamp: number;
  /** TypeScript check result */
  typescript: {
    exitCode: number;
    errorCount: number;
    errors: string[];
  };
  /** Build result */
  build: {
    success: boolean;
    errorCount: number;
    errors: string[];
  };
  /** Lint result */
  lint: {
    success: boolean;
    errorCount: number;
    warningCount: number;
  };
  /** Test result */
  tests: {
    ran: boolean;
    passed: number;
    failed: number;
    total: number;
  };
}

export interface EvidenceReport {
  /** State before changes */
  before: ErrorCounts;
  /** State after changes */
  after: ErrorCounts;
  /** Verification evidence */
  evidence: VerificationEvidence | null;
  /** Whether changes improved the situation */
  improved: boolean;
  /** Number of errors fixed */
  errorsFixed: number;
  /** Number of new errors introduced */
  errorsIntroduced: number;
  /** Human-readable summary */
  summary: string;
  /** Formatted completion message */
  completionMessage: string;
}

export interface CompletionClaim {
  /** What was claimed to be fixed */
  claim: string;
  /** Whether the claim is valid (backed by evidence) */
  valid: boolean;
  /** Evidence supporting the claim */
  evidence: VerificationEvidence | null;
  /** Reason if claim is invalid */
  reason?: string;
}

export interface EvidenceReporterConfig {
  /** Require verification before allowing completion claims */
  requireVerification?: boolean;
  /** Include detailed error messages in report */
  includeDetails?: boolean;
  /** Maximum errors to show in summary */
  maxErrorsInSummary?: number;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

// =============================================================================
// EVIDENCE REPORTER CLASS
// =============================================================================

export class EvidenceReporter {
  private webcontainer: WebContainer;
  private config: Required<EvidenceReporterConfig>;

  private beforeState: ErrorCounts | null = null;
  private afterState: ErrorCounts | null = null;
  private evidence: VerificationEvidence | null = null;
  private verificationRan: boolean = false;

  constructor(webcontainer: WebContainer, config: EvidenceReporterConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = {
      requireVerification: config.requireVerification ?? true,
      includeDetails: config.includeDetails ?? true,
      maxErrorsInSummary: config.maxErrorsInSummary ?? 5,
      onProgress: config.onProgress || (() => {}),
    };
  }

  /**
   * Capture the state before making changes
   */
  capturePreChangeState(counts: ErrorCounts): void {
    this.beforeState = { ...counts };
    this.config.onProgress?.(`[Evidence] Captured baseline: ${counts.total} error(s)`);
  }

  /**
   * Capture the state after making changes
   */
  capturePostChangeState(counts: ErrorCounts): void {
    this.afterState = { ...counts };
    this.config.onProgress?.(`[Evidence] Captured result: ${counts.total} error(s)`);
  }

  /**
   * Record verification evidence
   */
  recordEvidence(evidence: VerificationEvidence): void {
    this.evidence = evidence;
    this.verificationRan = true;
    this.config.onProgress?.('[Evidence] Verification evidence recorded');
  }

  /**
   * Check if a completion claim is valid
   */
  validateCompletionClaim(claim: string): CompletionClaim {
    // If verification is required but not run, claim is invalid
    if (this.config.requireVerification && !this.verificationRan) {
      return {
        claim,
        valid: false,
        evidence: null,
        reason: 'Verification was not run. Cannot claim "fixed" without proof.',
      };
    }

    // If we have no before/after state, claim is invalid
    if (!this.beforeState || !this.afterState) {
      return {
        claim,
        valid: false,
        evidence: this.evidence,
        reason: 'Error counts not captured. Cannot verify improvement.',
      };
    }

    // Check if errors actually decreased or stayed at zero
    const errorsFixed = this.beforeState.total - this.afterState.total;
    const isImproved = errorsFixed > 0 || this.afterState.total === 0;

    if (!isImproved && this.beforeState.total > 0) {
      return {
        claim,
        valid: false,
        evidence: this.evidence,
        reason: `Errors not reduced. Before: ${this.beforeState.total}, After: ${this.afterState.total}`,
      };
    }

    return {
      claim,
      valid: true,
      evidence: this.evidence,
    };
  }

  /**
   * Generate the full evidence report
   */
  generateReport(): EvidenceReport {
    const before = this.beforeState || this.createEmptyCounts();
    const after = this.afterState || this.createEmptyCounts();

    const errorsFixed = Math.max(0, before.total - after.total);
    const errorsIntroduced = Math.max(0, after.total - before.total);
    const improved = errorsFixed > 0 || (before.total === 0 && after.total === 0);

    const summary = this.generateSummary(before, after, errorsFixed, errorsIntroduced);
    const completionMessage = this.generateCompletionMessage(before, after, improved);

    return {
      before,
      after,
      evidence: this.evidence,
      improved,
      errorsFixed,
      errorsIntroduced,
      summary,
      completionMessage,
    };
  }

  /**
   * Generate a human-readable summary
   */
  private generateSummary(
    before: ErrorCounts,
    after: ErrorCounts,
    errorsFixed: number,
    errorsIntroduced: number
  ): string {
    const lines: string[] = [];

    lines.push('## Verification Summary');
    lines.push('');

    // Before/After comparison
    lines.push('| Category | Before | After | Change |');
    lines.push('|----------|--------|-------|--------|');
    lines.push(`| TypeScript | ${before.typescript} | ${after.typescript} | ${this.formatChange(before.typescript, after.typescript)} |`);
    lines.push(`| Build | ${before.build} | ${after.build} | ${this.formatChange(before.build, after.build)} |`);
    lines.push(`| Lint | ${before.lint} | ${after.lint} | ${this.formatChange(before.lint, after.lint)} |`);
    lines.push(`| Tests | ${before.tests.failed}/${before.tests.total} failed | ${after.tests.failed}/${after.tests.total} failed | ${this.formatChange(before.tests.failed, after.tests.failed)} |`);
    lines.push(`| **Total** | **${before.total}** | **${after.total}** | **${this.formatChange(before.total, after.total)}** |`);
    lines.push('');

    // Overall result
    if (errorsFixed > 0 && after.total === 0) {
      lines.push(`### Result: All ${errorsFixed} error(s) fixed`);
    } else if (errorsFixed > 0) {
      lines.push(`### Result: ${errorsFixed} error(s) fixed, ${after.total} remaining`);
    } else if (errorsIntroduced > 0) {
      lines.push(`### Result: ${errorsIntroduced} new error(s) introduced`);
    } else if (before.total === 0 && after.total === 0) {
      lines.push('### Result: Project was clean, remains clean');
    } else {
      lines.push('### Result: No change in error count');
    }

    return lines.join('\n');
  }

  /**
   * Generate the completion message with proof
   */
  private generateCompletionMessage(
    before: ErrorCounts,
    after: ErrorCounts,
    improved: boolean
  ): string {
    const lines: string[] = [];

    if (after.total === 0 && before.total > 0) {
      // All errors fixed
      lines.push(`### Fixed ${before.total} error(s). Verification passed:`);
    } else if (after.total === 0 && before.total === 0) {
      // Project was already clean
      lines.push('### No errors detected. Project is clean:');
    } else if (improved) {
      // Some errors fixed
      const fixed = before.total - after.total;
      lines.push(`### Fixed ${fixed} error(s). ${after.total} remaining:`);
    } else {
      // No improvement or worse
      lines.push(`### Verification completed (${after.total} error(s)):`);
    }

    lines.push('');

    // TypeScript status
    if (after.typescript === 0) {
      lines.push('- TypeScript: 0 errors');
    } else {
      lines.push(`- TypeScript: ${after.typescript} error(s)`);
    }

    // Build status
    if (after.build === 0) {
      lines.push('- Build: Success');
    } else {
      lines.push(`- Build: ${after.build} error(s)`);
    }

    // Lint status
    if (after.lint === 0) {
      lines.push('- Lint: Passed');
    } else {
      lines.push(`- Lint: ${after.lint} issue(s)`);
    }

    // Test status
    if (after.tests.total > 0) {
      if (after.tests.failed === 0) {
        lines.push(`- Tests: ${after.tests.passed}/${after.tests.total} passed`);
      } else {
        lines.push(`- Tests: ${after.tests.passed}/${after.tests.total} passed, ${after.tests.failed} failed`);
      }
    } else {
      lines.push('- Tests: Not configured');
    }

    return lines.join('\n');
  }

  /**
   * Format change indicator
   */
  private formatChange(before: number, after: number): string {
    const diff = after - before;
    if (diff === 0) return '-';
    if (diff < 0) return `${diff}`;
    return `+${diff}`;
  }

  /**
   * Create empty error counts
   */
  private createEmptyCounts(): ErrorCounts {
    return {
      typescript: 0,
      build: 0,
      lint: 0,
      tests: { passed: 0, failed: 0, total: 0 },
      runtime: 0,
      total: 0,
    };
  }

  /**
   * Create error counts from various verification results
   */
  static createErrorCounts(
    typescript?: StaticAnalysisResult,
    build?: BuildResult,
    lint?: { errorCount: number },
    tests?: { passed: number; failed: number; total: number }
  ): ErrorCounts {
    const tsErrors = typescript?.errors?.length ?? 0;
    const buildErrors = build?.errors?.length ?? 0;
    const lintErrors = lint?.errorCount ?? 0;
    const testResults = tests ?? { passed: 0, failed: 0, total: 0 };

    return {
      typescript: tsErrors,
      build: buildErrors,
      lint: lintErrors,
      tests: testResults,
      runtime: 0,
      total: tsErrors + buildErrors + lintErrors + testResults.failed,
    };
  }

  /**
   * Reset the reporter state
   */
  reset(): void {
    this.beforeState = null;
    this.afterState = null;
    this.evidence = null;
    this.verificationRan = false;
  }

  /**
   * Check if evidence has been collected
   */
  hasEvidence(): boolean {
    return this.verificationRan && this.evidence !== null;
  }

  /**
   * Check if before/after states have been captured
   */
  hasComparison(): boolean {
    return this.beforeState !== null && this.afterState !== null;
  }

  /**
   * Get the before state
   */
  getBeforeState(): ErrorCounts | null {
    return this.beforeState;
  }

  /**
   * Get the after state
   */
  getAfterState(): ErrorCounts | null {
    return this.afterState;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an evidence reporter
 */
export function createEvidenceReporter(
  webcontainer: WebContainer,
  config?: EvidenceReporterConfig
): EvidenceReporter {
  return new EvidenceReporter(webcontainer, config);
}

/**
 * Quick function to validate a completion claim
 */
export function validateFixClaim(
  claim: string,
  before: ErrorCounts,
  after: ErrorCounts,
  evidenceRecorded: boolean
): CompletionClaim {
  if (!evidenceRecorded) {
    return {
      claim,
      valid: false,
      evidence: null,
      reason: 'No verification evidence. Run verification before claiming "fixed".',
    };
  }

  const errorsFixed = before.total - after.total;
  if (errorsFixed <= 0 && before.total > 0) {
    return {
      claim,
      valid: false,
      evidence: null,
      reason: `No improvement. Errors: ${before.total} -> ${after.total}`,
    };
  }

  return {
    claim,
    valid: true,
    evidence: null,
  };
}

/**
 * Format a completion message
 */
export function formatCompletionMessage(
  errorsFixed: number,
  typescript: number,
  buildSuccess: boolean,
  testsPassed: number,
  testsTotal: number
): string {
  const lines: string[] = [];

  if (errorsFixed > 0) {
    lines.push(`### Fixed ${errorsFixed} error(s). Verification passed:`);
  } else {
    lines.push('### Verification completed:');
  }

  lines.push('');
  lines.push(`- TypeScript: ${typescript === 0 ? '0 errors' : `${typescript} error(s)`}`);
  lines.push(`- Build: ${buildSuccess ? 'Success' : 'Failed'}`);

  if (testsTotal > 0) {
    lines.push(`- Tests: ${testsPassed}/${testsTotal} passed`);
  }

  return lines.join('\n');
}
