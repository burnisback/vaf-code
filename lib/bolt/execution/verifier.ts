/**
 * Build Verifier
 *
 * Verifies generated code compiles and works correctly.
 * Captures terminal output and parses for errors.
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export interface VerificationResult {
  /** Overall success status */
  success: boolean;

  /** Build completed without errors */
  buildSuccess: boolean;

  /** Type errors found */
  typeErrors: VerificationError[];

  /** Runtime errors found */
  runtimeErrors: VerificationError[];

  /** Lint errors found */
  lintErrors: VerificationError[];

  /** Module/import errors */
  moduleErrors: VerificationError[];

  /** Verification timestamp */
  timestamp: number;

  /** Raw terminal output captured */
  rawOutput: string;
}

export interface VerificationError {
  /** Error type */
  type: 'type' | 'runtime' | 'lint' | 'module';

  /** Error message */
  message: string;

  /** File path if available */
  file?: string;

  /** Line number if available */
  line?: number;

  /** Column number if available */
  column?: number;

  /** Error code (e.g., TS2304) */
  code?: string;

  /** Severity */
  severity: 'error' | 'warning';
}

export interface VerifierConfig {
  /** Timeout for verification in ms */
  timeout: number;

  /** Whether to run lint check */
  checkLint: boolean;

  /** Whether to check types */
  checkTypes: boolean;

  /** Wait time after execution before verifying */
  waitBefore: number;
}

const DEFAULT_VERIFIER_CONFIG: VerifierConfig = {
  timeout: 30000,
  checkLint: false, // Often not configured in starter templates
  checkTypes: true,
  waitBefore: 2000, // Wait for HMR/rebuild
};

// =============================================================================
// ERROR PATTERNS
// =============================================================================

const ERROR_PATTERNS = {
  // TypeScript errors
  typescript: [
    /error TS(\d+):\s*(.+?)(?:\n|$)/gi,
    /(?:\.tsx?):(\d+):(\d+)\s*-\s*error\s*TS(\d+):\s*(.+)/gi,
    /TS(\d+):\s*(.+?)(?:\n|$)/gi,
  ],

  // Module/import errors
  module: [
    /Module not found:\s*(?:Error:\s*)?(?:Can't resolve\s*)?['"](.+?)['"]/gi,
    /Cannot find module\s*['"](.+?)['"]/gi,
    /Failed to resolve import\s*['"](.+?)['"]/gi,
    /The requested module\s*['"](.+?)['"]\s*does not provide/gi,
    /Could not resolve\s*['"](.+?)['"]/gi,
  ],

  // Runtime errors
  runtime: [
    /SyntaxError:\s*(.+?)(?:\n|$)/gi,
    /ReferenceError:\s*(.+?)(?:\n|$)/gi,
    /TypeError:\s*(.+?)(?:\n|$)/gi,
    /Error:\s*(.+?)(?:\n|$)/gi,
  ],

  // ESLint errors
  lint: [
    /(?:\.tsx?):(\d+):(\d+)\s*(?:error|warning)\s*(.+?)\s+(@?[\w\/-]+)/gi,
  ],

  // Build failures
  build: [
    /Build failed/gi,
    /Compilation failed/gi,
    /Failed to compile/gi,
    /error during build/gi,
  ],

  // File path extraction
  filePath: [
    /(?:\.\/)?([^\s:]+\.(?:tsx?|jsx?|css|scss|json)):(\d+)(?::(\d+))?/g,
  ],
};

// =============================================================================
// VERIFIER CLASS
// =============================================================================

export class BuildVerifier {
  private webcontainer: WebContainer;
  private config: VerifierConfig;
  private outputBuffer: string = '';

  constructor(
    webcontainer: WebContainer,
    config: Partial<VerifierConfig> = {}
  ) {
    this.webcontainer = webcontainer;
    this.config = { ...DEFAULT_VERIFIER_CONFIG, ...config };
  }

  /**
   * Capture terminal output for analysis
   */
  captureOutput(data: string): void {
    this.outputBuffer += data;

    // Keep buffer from growing too large
    if (this.outputBuffer.length > 50000) {
      this.outputBuffer = this.outputBuffer.slice(-25000);
    }
  }

  /**
   * Clear captured output
   */
  clearOutput(): void {
    this.outputBuffer = '';
  }

  /**
   * Get current output buffer
   */
  getOutput(): string {
    return this.outputBuffer;
  }

  /**
   * Verify the current build state
   */
  async verify(): Promise<VerificationResult> {
    // Wait for build to settle
    await new Promise(resolve => setTimeout(resolve, this.config.waitBefore));

    const result: VerificationResult = {
      success: true,
      buildSuccess: true,
      typeErrors: [],
      runtimeErrors: [],
      lintErrors: [],
      moduleErrors: [],
      timestamp: Date.now(),
      rawOutput: this.outputBuffer,
    };

    // Parse the captured output
    const cleanOutput = this.stripAnsiCodes(this.outputBuffer);

    // Check for build failures
    if (this.hasPattern(cleanOutput, ERROR_PATTERNS.build)) {
      result.buildSuccess = false;
      result.success = false;
    }

    // Extract TypeScript errors
    result.typeErrors = this.extractTypeErrors(cleanOutput);
    if (result.typeErrors.length > 0) {
      result.success = false;
    }

    // Extract module errors
    result.moduleErrors = this.extractModuleErrors(cleanOutput);
    if (result.moduleErrors.length > 0) {
      result.success = false;
    }

    // Extract runtime errors
    result.runtimeErrors = this.extractRuntimeErrors(cleanOutput);
    if (result.runtimeErrors.some(e => e.severity === 'error')) {
      result.success = false;
    }

    // Extract lint errors (if enabled)
    if (this.config.checkLint) {
      result.lintErrors = this.extractLintErrors(cleanOutput);
    }

    return result;
  }

  /**
   * Run explicit type check
   */
  async runTypeCheck(): Promise<VerificationError[]> {
    try {
      const process = await this.webcontainer.spawn('npx', ['tsc', '--noEmit']);

      let output = '';
      await process.output.pipeTo(
        new WritableStream({
          write(data) {
            output += data;
          },
        })
      ).catch(() => {});

      await process.exit;

      return this.extractTypeErrors(this.stripAnsiCodes(output));
    } catch {
      return [];
    }
  }

  // =============================================================================
  // EXTRACTION HELPERS
  // =============================================================================

  private stripAnsiCodes(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private hasPattern(text: string, patterns: RegExp[]): boolean {
    return patterns.some(p => {
      p.lastIndex = 0;
      return p.test(text);
    });
  }

  private extractTypeErrors(text: string): VerificationError[] {
    const errors: VerificationError[] = [];
    const seen = new Set<string>();

    for (const pattern of ERROR_PATTERNS.typescript) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        let code: string | undefined;
        let message: string;
        let file: string | undefined;
        let line: number | undefined;
        let column: number | undefined;

        if (match.length === 3) {
          // Pattern 1: error TS1234: message
          code = `TS${match[1]}`;
          message = match[2].trim();
        } else if (match.length === 5) {
          // Pattern 2: file.tsx:1:2 - error TS1234: message
          const fullMatch = match[0];
          const fileMatch = fullMatch.match(/([^\s:]+\.tsx?):/);
          file = fileMatch ? fileMatch[1] : undefined;
          line = parseInt(match[1], 10);
          column = parseInt(match[2], 10);
          code = `TS${match[3]}`;
          message = match[4].trim();
        } else {
          // Simple pattern
          code = `TS${match[1]}`;
          message = match[2]?.trim() || match[0];
        }

        const key = `${code}-${message.slice(0, 50)}-${file || ''}-${line || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          errors.push({
            type: 'type',
            message,
            file,
            line,
            column,
            code,
            severity: 'error',
          });
        }
      }
    }

    return errors;
  }

  private extractModuleErrors(text: string): VerificationError[] {
    const errors: VerificationError[] = [];
    const seen = new Set<string>();

    for (const pattern of ERROR_PATTERNS.module) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const moduleName = match[1];
        const key = `module-${moduleName}`;

        if (!seen.has(key)) {
          seen.add(key);
          errors.push({
            type: 'module',
            message: `Cannot find module '${moduleName}'`,
            severity: 'error',
          });
        }
      }
    }

    return errors;
  }

  private extractRuntimeErrors(text: string): VerificationError[] {
    const errors: VerificationError[] = [];
    const seen = new Set<string>();

    for (const pattern of ERROR_PATTERNS.runtime) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const message = match[1].trim();

        // Skip common non-errors
        if (
          message.includes('DevTools') ||
          message.includes('HMR') ||
          message.includes('Hot Module') ||
          message.includes('websocket') ||
          message.includes('vite') && message.includes('hmr')
        ) {
          continue;
        }

        const key = `runtime-${message.slice(0, 50)}`;
        if (!seen.has(key)) {
          seen.add(key);
          errors.push({
            type: 'runtime',
            message,
            severity: 'error',
          });
        }
      }
    }

    return errors;
  }

  private extractLintErrors(text: string): VerificationError[] {
    const errors: VerificationError[] = [];
    // Lint error extraction - basic implementation
    for (const pattern of ERROR_PATTERNS.lint) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        errors.push({
          type: 'lint',
          message: match[3],
          line: parseInt(match[1], 10),
          column: parseInt(match[2], 10),
          code: match[4],
          severity: 'warning',
        });
      }
    }
    return errors;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a verifier instance
 */
export function createVerifier(
  webcontainer: WebContainer,
  config?: Partial<VerifierConfig>
): BuildVerifier {
  return new BuildVerifier(webcontainer, config);
}

/**
 * Get a summary of verification errors
 */
export function getErrorSummary(result: VerificationResult): string {
  const parts: string[] = [];

  if (result.typeErrors.length > 0) {
    parts.push(`${result.typeErrors.length} type error(s)`);
  }
  if (result.moduleErrors.length > 0) {
    parts.push(`${result.moduleErrors.length} module error(s)`);
  }
  if (result.runtimeErrors.length > 0) {
    parts.push(`${result.runtimeErrors.length} runtime error(s)`);
  }
  if (result.lintErrors.length > 0) {
    parts.push(`${result.lintErrors.length} lint warning(s)`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No errors';
}

/**
 * Format errors for AI context
 */
export function formatErrorsForAI(result: VerificationResult): string {
  const allErrors = [
    ...result.typeErrors,
    ...result.moduleErrors,
    ...result.runtimeErrors,
  ];

  if (allErrors.length === 0) {
    return 'No errors detected.';
  }

  return allErrors
    .map(e => {
      let errorStr = `- ${e.type.toUpperCase()}: ${e.message}`;
      if (e.file) errorStr += ` in ${e.file}`;
      if (e.line) errorStr += `:${e.line}`;
      if (e.code) errorStr += ` (${e.code})`;
      return errorStr;
    })
    .join('\n');
}

/**
 * Get total error count
 */
export function getTotalErrorCount(result: VerificationResult): number {
  return (
    result.typeErrors.length +
    result.moduleErrors.length +
    result.runtimeErrors.length
  );
}

/**
 * Create an empty/successful verification result
 */
export function createEmptyResult(): VerificationResult {
  return {
    success: true,
    buildSuccess: true,
    typeErrors: [],
    runtimeErrors: [],
    lintErrors: [],
    moduleErrors: [],
    timestamp: Date.now(),
    rawOutput: '',
  };
}
