/**
 * Pre-Change Verifier
 *
 * Phase 1 of the Debugging Strategy Implementation.
 * Updated in Phase 3 to fix stale build verification issue.
 *
 * ALWAYS verifies the current state BEFORE making any changes.
 * This prevents unnecessary destructive changes when no errors exist.
 *
 * Key behaviors:
 * 1. When user says "fix errors" or "review files" - run verification FIRST
 * 2. If NO errors found - report "No errors detected" and STOP
 * 3. If errors found - return detailed error list for targeted fixes
 *
 * Phase 3 FIX: Now uses BuildRunner to ACTIVELY run npm run build
 * instead of reading stale terminal buffer from BuildVerifier.
 */

import type { WebContainer } from '@webcontainer/api';
import { StaticAnalyzer, type StaticAnalysisResult } from './staticAnalyzer';
import { BuildRunner, type BuildResult } from './buildRunner';
import { UnifiedVerifier, type UnifiedVerificationResult } from './unifiedVerifier';
import { ESLintRunner, type ESLintResult } from './eslintRunner';
import { TargetedTestRunner, type TargetedTestResult } from './targetedTestRunner';

// =============================================================================
// TYPES
// =============================================================================

export interface PreVerificationResult {
  /** Whether the project is clean (no errors) */
  isClean: boolean;

  /** Total number of errors found */
  totalErrors: number;

  /** Static analysis result (tsc --noEmit) */
  staticAnalysis: StaticAnalysisResult | null;

  /** Build result from actively running npm run build (Phase 3 fix) */
  buildResult: BuildResult | null;

  /** Lint result from npm run lint */
  lintResult: BuildResult | null;

  /** Test result from npm test */
  testResult: BuildResult | null;

  /** ESLint result (fallback for JS-only projects) */
  eslintResult: ESLintResult | null;

  /** Targeted test result (for running specific failing tests) */
  targetedTestResult: TargetedTestResult | null;

  /** Unified verification result (when using enhanced mode) */
  unifiedResult: UnifiedVerificationResult | null;

  /** Human-readable summary */
  summary: string;

  /** Detailed error list for AI context */
  errorDetails: string;

  /** Whether changes should proceed */
  shouldProceed: boolean;

  /** Duration of verification in milliseconds */
  duration: number;

  /** Whether user approval is required before proceeding */
  requiresApproval: boolean;

  /** Whether this is a JS-only project (no TypeScript) */
  isJSOnlyProject: boolean;
}

export interface PreVerifierConfig {
  /** Whether to run static analysis (tsc --noEmit) */
  runStaticAnalysis: boolean;

  /** Whether to check build output */
  runBuildCheck: boolean;

  /** Whether to run lint check (npm run lint) */
  runLintCheck: boolean;

  /** Whether to run test check (npm test) */
  runTestCheck: boolean;

  /** Whether to use ESLint as fallback for JS-only projects */
  useESLintFallback: boolean;

  /** Whether to use targeted test running (failing tests first) */
  useTargetedTests: boolean;

  /** Timeout for verification in milliseconds */
  timeout: number;

  /** Callback for progress updates */
  onProgress?: (message: string) => void;

  /** Use unified verification (comprehensive, includes env check, circular deps, etc.) */
  useUnifiedVerification: boolean;
}

const DEFAULT_CONFIG: PreVerifierConfig = {
  runStaticAnalysis: true,
  runBuildCheck: true,
  runLintCheck: true,
  runTestCheck: false, // Disabled by default since tests can be slow
  useESLintFallback: true, // Enable ESLint fallback for JS-only projects
  useTargetedTests: false, // Opt-in to targeted test running
  timeout: 60000,
  useUnifiedVerification: false, // Opt-in to unified verification
};

// =============================================================================
// INTENT DETECTION
// =============================================================================

/**
 * Patterns that indicate user wants to fix/review errors
 */
const ERROR_FIX_PATTERNS = [
  /fix\s+(the\s+)?errors?/i,
  /review\s+(all\s+)?(the\s+)?(files?|code)/i,
  /ensure\s+(there\s+are\s+)?no\s+errors?/i,
  /check\s+(for\s+)?errors?/i,
  /find\s+(and\s+fix\s+)?errors?/i,
  /debug\s+(the\s+)?(code|files?|project)/i,
  /what('s|\s+is)\s+wrong/i,
  /why\s+is\s+it\s+(not\s+)?working/i,
  /make\s+it\s+work/i,
  /clean\s+up\s+(the\s+)?(code|files?)/i,
  /resolve\s+(the\s+)?issues?/i,
  /address\s+(the\s+)?errors?/i,
];

/**
 * Patterns that indicate vague/unclear debugging requests
 * These need clarification before proceeding
 */
const VAGUE_REQUEST_PATTERNS = [
  /^(it('s|\s+is)?\s+)?(not\s+working|broken|bugged?)$/i,
  /^(something('s|\s+is)?\s+)?wrong$/i,
  /^help(\s+me)?$/i,
  /^(it('s|\s+is)?\s+)?broken$/i,
  /^fix\s+(it|this)$/i,
  /^(there('s|\s+is)?\s+)?(a\s+)?(problem|issue)$/i,
  /^(it\s+)?doesn('t|t)\s+work$/i,
  /^error$/i,
  /^bug$/i,
  /^(i\s+)?(got|have|see)\s+(an?\s+)?error$/i,
  /^(i\s+)?(need|want)\s+help$/i,
];

/**
 * Information we need to clarify vague requests
 */
export interface ClarificationRequest {
  /** Whether the request is vague */
  isVague: boolean;

  /** The original request */
  originalRequest: string;

  /** Suggested questions to ask */
  questions: string[];

  /** Generated clarification response */
  response: string;
}

/**
 * Check if user prompt indicates error-fixing intent
 *
 * Returns true only if the prompt specifically asks for error fixing.
 * Does NOT trigger for general implementation requests like "add X" or "make Y the default".
 */
export function isErrorFixIntent(prompt: string, debug = false): boolean {
  const normalized = prompt.toLowerCase().trim();

  // First check - must match one of our error fix patterns
  const matchingPattern = ERROR_FIX_PATTERNS.find(pattern => pattern.test(normalized));

  if (!matchingPattern) {
    if (debug) {
      console.log('[isErrorFixIntent] No pattern match for:', normalized);
    }
    return false;
  }

  // Second check - exclude implementation requests that happen to contain error-related words
  // e.g., "make the login page the default" should NOT trigger error-fix
  const IMPLEMENTATION_PATTERNS = [
    /^(make|add|create|build|implement|set|change|update)\s+/i,
    /as\s+(the\s+)?default/i,
    /add\s+(a|an|the)\s+/i,
    /^(i\s+)?(want|need)\s+/i,
  ];

  const isImplementationRequest = IMPLEMENTATION_PATTERNS.some(p => p.test(normalized));

  // If it looks like an implementation request, don't treat as error-fix
  // unless it explicitly mentions "fix", "error", "debug", etc.
  if (isImplementationRequest) {
    const explicitErrorWords = /\b(fix|error|bug|debug|broken|wrong|issue|problem)\b/i;
    const hasExplicitErrorWords = explicitErrorWords.test(normalized);

    if (!hasExplicitErrorWords) {
      if (debug) {
        console.log('[isErrorFixIntent] Skipping - implementation request without explicit error words:', normalized);
      }
      return false;
    }
  }

  if (debug) {
    console.log('[isErrorFixIntent] Matched pattern:', matchingPattern.toString(), 'for:', normalized);
  }

  return true;
}

/**
 * Check if user prompt is too vague to act on
 */
export function isVagueRequest(prompt: string): boolean {
  const normalized = prompt.toLowerCase().trim();
  return VAGUE_REQUEST_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Generate clarification request for vague debugging requests
 */
export function generateClarificationRequest(prompt: string): ClarificationRequest {
  const normalized = prompt.toLowerCase().trim();

  if (!isVagueRequest(prompt)) {
    return {
      isVague: false,
      originalRequest: prompt,
      questions: [],
      response: '',
    };
  }

  // Generate appropriate questions based on the type of vague request
  const questions: string[] = [];
  let context = 'issue';

  if (/error/i.test(normalized)) {
    context = 'error';
    questions.push('What is the exact error message you are seeing?');
    questions.push('Where does the error appear (terminal, browser console, or editor)?');
  } else if (/not\s+working|broken|doesn('t|t)\s+work/i.test(normalized)) {
    context = 'behavior';
    questions.push('What specific behavior are you seeing?');
    questions.push('What did you expect to happen instead?');
    questions.push('What were you doing when this started happening?');
  } else if (/bug/i.test(normalized)) {
    context = 'bug';
    questions.push('What is the unexpected behavior you are observing?');
    questions.push('Can you describe the steps to reproduce this bug?');
  } else {
    questions.push('What specific issue are you experiencing?');
    questions.push('Are there any error messages in the terminal or browser console?');
  }

  // Always add these helpful questions
  questions.push('Which file or feature is affected?');

  const response = generateVagueClarificationResponse(context, questions);

  return {
    isVague: true,
    originalRequest: prompt,
    questions,
    response,
  };
}

/**
 * Generate a user-friendly clarification response
 */
function generateVagueClarificationResponse(context: string, questions: string[]): string {
  const intro = context === 'error'
    ? "I'd like to help you fix this error, but I need a bit more information."
    : context === 'behavior'
      ? "I'd like to help fix this issue, but I need to understand what's happening."
      : context === 'bug'
        ? "I'd like to help fix this bug, but I need more details to investigate."
        : "I'd like to help, but I need more information to understand the issue.";

  const questionList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

  return `${intro}

**Please provide more details:**
${questionList}

Alternatively, you can:
- Share the exact error message you're seeing
- Paste the terminal output
- Describe what's not working as expected

This will help me diagnose and fix the issue more effectively.`;
}

// =============================================================================
// PRE-VERIFIER CLASS
// =============================================================================

export class PreVerifier {
  private webcontainer: WebContainer;
  private staticAnalyzer: StaticAnalyzer;
  private buildRunner: BuildRunner;
  private eslintRunner: ESLintRunner;
  private targetedTestRunner: TargetedTestRunner;
  private config: PreVerifierConfig;

  constructor(
    webcontainer: WebContainer,
    config: Partial<PreVerifierConfig> = {}
  ) {
    this.webcontainer = webcontainer;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.staticAnalyzer = new StaticAnalyzer(webcontainer, {
      onProgress: config.onProgress,
    });

    // Phase 3 FIX: Use BuildRunner for ACTIVE build execution
    // instead of BuildVerifier which reads stale terminal buffer
    this.buildRunner = new BuildRunner(webcontainer, {
      timeout: this.config.timeout,
      onProgress: config.onProgress,
    });

    // ESLint runner for JS-only projects
    this.eslintRunner = new ESLintRunner(webcontainer, {
      onProgress: config.onProgress,
    });

    // Targeted test runner for running failing tests first
    this.targetedTestRunner = new TargetedTestRunner({
      webcontainer,
      onProgress: config.onProgress,
    });
  }

  /**
   * Run comprehensive pre-change verification
   *
   * This should be called BEFORE any code changes are made
   * when the user's intent suggests error fixing.
   *
   * Phase 3 FIX: Now actively runs npm run build instead of
   * reading stale terminal buffer.
   */
  async verify(): Promise<PreVerificationResult> {
    const startTime = Date.now();

    const result: PreVerificationResult = {
      isClean: true,
      totalErrors: 0,
      staticAnalysis: null,
      buildResult: null,
      lintResult: null,
      testResult: null,
      eslintResult: null,
      targetedTestResult: null,
      unifiedResult: null,
      summary: '',
      errorDetails: '',
      shouldProceed: false,
      duration: 0,
      requiresApproval: true, // Always require approval before making changes
      isJSOnlyProject: false,
    };

    this.config.onProgress?.('[PreVerify] Running pre-change verification...');

    // Use unified verification if configured
    if (this.config.useUnifiedVerification) {
      return this.verifyUnified();
    }

    try {
      // Check if this is a JS-only project
      const isJSOnly = await this.eslintRunner.isJSOnlyProject();
      result.isJSOnlyProject = isJSOnly;

      // Run static analysis first (most comprehensive)
      if (this.config.runStaticAnalysis) {
        if (isJSOnly && this.config.useESLintFallback) {
          // JS-only project: use ESLint instead of tsc
          this.config.onProgress?.('[PreVerify] JS-only project - running ESLint instead of tsc...');
          result.eslintResult = await this.eslintRunner.run();

          if (!result.eslintResult.success && result.eslintResult.available) {
            result.isClean = false;
            result.totalErrors += result.eslintResult.errorCount;
          }
        } else {
          // TypeScript project: use tsc --noEmit
          this.config.onProgress?.('[PreVerify] Running TypeScript static analysis (tsc --noEmit)...');
          result.staticAnalysis = await this.staticAnalyzer.analyze();

          if (!result.staticAnalysis.success) {
            result.isClean = false;
            result.totalErrors += result.staticAnalysis.errors.length;
          }
        }
      }

      // Phase 3 FIX: Run ACTIVE build check (not stale buffer)
      if (this.config.runBuildCheck) {
        this.config.onProgress?.('[PreVerify] Running npm run build (fresh build)...');
        result.buildResult = await this.buildRunner.run();

        if (!result.buildResult.success) {
          result.isClean = false;
          result.totalErrors += result.buildResult.errors.length;
        }
      }

      // Run lint check if configured
      if (this.config.runLintCheck) {
        this.config.onProgress?.('[PreVerify] Running lint check (npm run lint)...');
        result.lintResult = await this.buildRunner.runLint();

        if (!result.lintResult.success) {
          result.isClean = false;
          result.totalErrors += result.lintResult.errors.length;
        }
      }

      // Run test check if configured
      if (this.config.runTestCheck) {
        if (this.config.useTargetedTests) {
          // Use targeted test runner (failing tests first)
          this.config.onProgress?.('[PreVerify] Running targeted test check...');
          result.targetedTestResult = await this.targetedTestRunner.runTests();

          if (!result.targetedTestResult.passed) {
            result.isClean = false;
            // Count failures from fullResult or targetedResult
            const failures = result.targetedTestResult.fullResult?.failedTests
              || result.targetedTestResult.targetedResult?.failedTests
              || 0;
            result.totalErrors += failures;
          }
        } else {
          // Standard test check
          this.config.onProgress?.('[PreVerify] Running test check (npm test)...');
          result.testResult = await this.buildRunner.runTests();

          if (!result.testResult.success) {
            result.isClean = false;
            result.totalErrors += result.testResult.errors.length;
          }
        }
      }

      // Build summary and details
      result.summary = this.buildSummary(result);
      result.errorDetails = this.buildErrorDetails(result);

      // Determine if changes should proceed
      // Phase 3: Only proceed if there are actual errors AND user approves
      result.shouldProceed = !result.isClean;
      result.requiresApproval = !result.isClean; // Require approval when errors exist

      if (result.isClean) {
        this.config.onProgress?.('[PreVerify] ✓ No errors found - project is clean');
      } else {
        this.config.onProgress?.(
          `[PreVerify] Found ${result.totalErrors} error(s) - awaiting approval to fix`
        );
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.summary = `Pre-verification failed: ${errorMessage}`;
      result.shouldProceed = false;
      result.requiresApproval = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Quick check - only runs static analysis
   */
  async quickCheck(): Promise<{ isClean: boolean; errors: number; summary: string }> {
    this.config.onProgress?.('Running quick TypeScript check...');

    const analysis = await this.staticAnalyzer.analyze();

    return {
      isClean: analysis.success,
      errors: analysis.errors.length,
      summary: analysis.success
        ? 'No TypeScript errors found.'
        : `Found ${analysis.errors.length} TypeScript error(s).`,
    };
  }

  /**
   * Run unified verification (comprehensive)
   * Includes: type check, lint, stylelint, env validation, circular deps
   */
  async verifyUnified(): Promise<PreVerificationResult> {
    const startTime = Date.now();

    const result: PreVerificationResult = {
      isClean: true,
      totalErrors: 0,
      staticAnalysis: null,
      buildResult: null,
      lintResult: null,
      testResult: null,
      eslintResult: null,
      targetedTestResult: null,
      unifiedResult: null,
      summary: '',
      errorDetails: '',
      shouldProceed: false,
      duration: 0,
      requiresApproval: true,
      isJSOnlyProject: false,
    };

    this.config.onProgress?.('[PreVerify] Running unified verification...');

    try {
      const unifiedVerifier = new UnifiedVerifier(this.webcontainer, {
        phases: {
          typeCheck: this.config.runStaticAnalysis,
          lint: this.config.runLintCheck,
          styleLint: true,
          envValidation: true,
          circularDeps: true,
          tests: this.config.runTestCheck,
          runtimeSetup: false, // Don't inject during pre-verification
        },
        runTests: this.config.runTestCheck,
        injectRuntimeCapture: false,
        onProgress: this.config.onProgress,
      });

      result.unifiedResult = await unifiedVerifier.verify();

      result.isClean = result.unifiedResult.success;
      result.totalErrors = result.unifiedResult.totalErrors;
      result.summary = result.unifiedResult.summary;
      result.errorDetails = result.unifiedResult.report;
      result.shouldProceed = !result.isClean;
      result.requiresApproval = !result.isClean;

      if (result.isClean) {
        this.config.onProgress?.('[PreVerify] ✓ Unified verification passed - no errors');
      } else {
        this.config.onProgress?.(
          `[PreVerify] Found ${result.totalErrors} error(s) via unified verification`
        );
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.summary = `Unified verification failed: ${errorMessage}`;
      result.shouldProceed = false;
      result.requiresApproval = false;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Build human-readable summary
   */
  private buildSummary(result: PreVerificationResult): string {
    if (result.isClean) {
      return '✓ No errors detected. The project is clean - no changes needed.';
    }

    const parts: string[] = [];

    // TypeScript errors
    if (result.staticAnalysis && !result.staticAnalysis.success) {
      parts.push(`${result.staticAnalysis.errors.length} TypeScript error(s)`);
    }

    // ESLint errors (JS-only projects)
    if (result.eslintResult && result.eslintResult.available && result.eslintResult.errorCount > 0) {
      parts.push(`${result.eslintResult.errorCount} ESLint error(s)`);
    }

    // Phase 3 FIX: Use buildResult from BuildRunner
    if (result.buildResult && !result.buildResult.success) {
      if (result.buildResult.errors.length > 0) {
        parts.push(`${result.buildResult.errors.length} build error(s)`);
      }
    }

    // Include lint errors
    if (result.lintResult && !result.lintResult.success) {
      if (result.lintResult.errors.length > 0) {
        parts.push(`${result.lintResult.errors.length} lint error(s)`);
      }
    }

    // Include test errors (standard)
    if (result.testResult && !result.testResult.success) {
      if (result.testResult.errors.length > 0) {
        parts.push(`${result.testResult.errors.length} test failure(s)`);
      }
    }

    // Include targeted test errors
    if (result.targetedTestResult && !result.targetedTestResult.passed) {
      const failures = result.targetedTestResult.fullResult?.failedTests
        || result.targetedTestResult.targetedResult?.failedTests
        || 0;
      if (failures > 0) {
        parts.push(`${failures} test failure(s)`);
      }
    }

    return `Found ${result.totalErrors} error(s): ${parts.join(', ')}`;
  }

  /**
   * Build detailed error list for AI context
   */
  private buildErrorDetails(result: PreVerificationResult): string {
    if (result.isClean) {
      return 'No errors to fix.';
    }

    const sections: string[] = [];

    // Static analysis errors (TypeScript)
    if (result.staticAnalysis && result.staticAnalysis.errors.length > 0) {
      sections.push('## TypeScript Errors (from tsc --noEmit)');

      // Group by file
      const byFile = new Map<string, typeof result.staticAnalysis.errors>();
      for (const error of result.staticAnalysis.errors) {
        const file = error.file || '(unknown)';
        if (!byFile.has(file)) {
          byFile.set(file, []);
        }
        byFile.get(file)!.push(error);
      }

      for (const [file, errors] of byFile) {
        sections.push(`\n### ${file}`);
        for (const error of errors) {
          sections.push(`- Line ${error.line}: ${error.code} - ${error.message}`);
        }
      }
    }

    // ESLint errors (JS-only projects)
    if (result.eslintResult && result.eslintResult.available && result.eslintResult.errors.length > 0) {
      sections.push('\n## ESLint Errors (JS-only project)');

      // Group by file
      const byFile = new Map<string, typeof result.eslintResult.errors>();
      for (const error of result.eslintResult.errors) {
        const file = error.filePath || '(unknown)';
        if (!byFile.has(file)) {
          byFile.set(file, []);
        }
        byFile.get(file)!.push(error);
      }

      for (const [file, errors] of byFile) {
        sections.push(`\n### ${file}`);
        for (const error of errors.slice(0, 10)) {
          const rule = error.ruleId ? ` (${error.ruleId})` : '';
          const severity = error.severity === 2 ? 'error' : 'warning';
          sections.push(`- Line ${error.line}:${error.column} [${severity}]${rule}: ${error.message}`);
        }
        if (errors.length > 10) {
          sections.push(`- ... and ${errors.length - 10} more errors in this file`);
        }
      }
    }

    // Phase 3 FIX: Use buildResult from BuildRunner
    if (result.buildResult && result.buildResult.errors.length > 0) {
      sections.push('\n## Build Errors (from npm run build)');

      // Group by error type
      const typeErrors = result.buildResult.errors.filter(e => e.type === 'type');
      const moduleErrors = result.buildResult.errors.filter(e => e.type === 'module');
      const otherErrors = result.buildResult.errors.filter(
        e => e.type !== 'type' && e.type !== 'module'
      );

      if (typeErrors.length > 0) {
        sections.push('\n### Type Errors');
        for (const error of typeErrors.slice(0, 10)) {
          const loc = error.file && error.line ? `${error.file}:${error.line}` : '';
          sections.push(`- ${loc} ${error.code || ''}: ${error.message}`);
        }
        if (typeErrors.length > 10) {
          sections.push(`- ... and ${typeErrors.length - 10} more type errors`);
        }
      }

      if (moduleErrors.length > 0) {
        sections.push('\n### Module Errors');
        for (const error of moduleErrors.slice(0, 10)) {
          sections.push(`- ${error.message}`);
        }
        if (moduleErrors.length > 10) {
          sections.push(`- ... and ${moduleErrors.length - 10} more module errors`);
        }
      }

      if (otherErrors.length > 0) {
        sections.push('\n### Other Errors');
        for (const error of otherErrors.slice(0, 10)) {
          sections.push(`- ${error.message}`);
        }
        if (otherErrors.length > 10) {
          sections.push(`- ... and ${otherErrors.length - 10} more errors`);
        }
      }
    }

    // Include lint errors
    if (result.lintResult && result.lintResult.errors.length > 0) {
      sections.push('\n## Lint Errors (from npm run lint)');
      for (const error of result.lintResult.errors.slice(0, 10)) {
        const loc = error.file && error.line ? `${error.file}:${error.line}` : '';
        sections.push(`- ${loc} ${error.message}`);
      }
      if (result.lintResult.errors.length > 10) {
        sections.push(`- ... and ${result.lintResult.errors.length - 10} more lint errors`);
      }
    }

    // Include test errors
    if (result.testResult && result.testResult.errors.length > 0) {
      sections.push('\n## Test Failures (from npm test)');
      for (const error of result.testResult.errors.slice(0, 10)) {
        const loc = error.file && error.line ? `${error.file}:${error.line}` : '';
        sections.push(`- ${loc} ${error.message}`);
      }
      if (result.testResult.errors.length > 10) {
        sections.push(`- ... and ${result.testResult.errors.length - 10} more test failures`);
      }
    }

    return sections.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a pre-verifier instance
 */
export function createPreVerifier(
  webcontainer: WebContainer,
  config?: Partial<PreVerifierConfig>
): PreVerifier {
  return new PreVerifier(webcontainer, config);
}

/**
 * Run pre-verification check
 * Convenience function for one-off verification
 */
export async function runPreVerification(
  webcontainer: WebContainer,
  config?: Partial<PreVerifierConfig>
): Promise<PreVerificationResult> {
  const verifier = new PreVerifier(webcontainer, config);
  return verifier.verify();
}

/**
 * Generate response for clean project
 * Use this when pre-verification finds no errors
 */
export function generateCleanProjectResponse(): string {
  return `I've analyzed the project and found no errors.

**Verification Results:**
- TypeScript compilation: ✓ Passed (tsc --noEmit)
- Build check: ✓ Passed
- Lint check: ✓ Passed (if configured)
- Test suite: ✓ Passed (if configured)

The project is in a clean state. No changes are needed.

If you're experiencing issues, please describe the specific problem you're seeing (error messages, unexpected behavior, etc.) so I can investigate further.`;
}

/**
 * Generate response for project with errors
 * Use this when pre-verification finds errors
 */
export function generateErrorReportResponse(result: PreVerificationResult): string {
  return `I've analyzed the project and found **${result.totalErrors} error(s)** that need to be fixed.

${result.errorDetails}

Would you like me to fix these errors? I'll make targeted changes only to the files with actual errors.`;
}
