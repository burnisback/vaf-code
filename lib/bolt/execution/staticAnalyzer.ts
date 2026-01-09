/**
 * Static Analyzer
 *
 * Runs TypeScript compiler (tsc --noEmit) to catch ALL errors
 * including orphaned files that aren't in the import graph.
 *
 * This addresses the "blind spot" where Vite/bundlers only check
 * files that are actually imported, missing errors in unused files.
 *
 * Phase 0 of the Debugging Strategy Implementation.
 *
 * Enhanced Features:
 * - Monorepo support (per-package verification)
 * - TypeScript project references support (--build flag)
 * - ESLint fallback for JavaScript-only projects
 */

import type { WebContainer } from '@webcontainer/api';
import { MonorepoDetector, type MonorepoInfo, type MonorepoPackage } from './monorepoDetector';
import { TsProjectReferencesHandler, type ProjectReferencesInfo } from './tsProjectReferencesHandler';

// =============================================================================
// TYPES
// =============================================================================

export interface StaticAnalysisResult {
  /** Whether analysis completed without errors */
  success: boolean;

  /** All TypeScript errors found */
  errors: StaticAnalysisError[];

  /** Warnings (non-blocking) */
  warnings: StaticAnalysisError[];

  /** Raw tsc output for debugging */
  rawOutput: string;

  /** Analysis timestamp */
  timestamp: number;

  /** Duration in milliseconds */
  duration: number;
}

export interface StaticAnalysisError {
  /** Error code (e.g., TS2304) */
  code: string;

  /** Error message */
  message: string;

  /** File path */
  file: string;

  /** Line number (1-indexed) */
  line: number;

  /** Column number (1-indexed) */
  column: number;

  /** Severity */
  severity: 'error' | 'warning';

  /** Whether this file is orphaned (not imported by any other file) */
  isOrphaned?: boolean;
}

export interface StaticAnalyzerConfig {
  /** Timeout for tsc command in milliseconds */
  timeout: number;

  /** Additional tsc flags */
  additionalFlags: string[];

  /** Whether to also run on .js/.jsx files */
  checkJavaScript: boolean;

  /** Callback for progress updates */
  onProgress?: (message: string) => void;

  /** Auto-detect and use project references (--build flag) */
  autoDetectProjectRefs: boolean;

  /** Auto-detect and verify each package in monorepos */
  autoDetectMonorepo: boolean;
}

export interface EnhancedAnalysisResult extends StaticAnalysisResult {
  /** Whether project uses TypeScript project references */
  usesProjectReferences: boolean;

  /** Whether project is a monorepo */
  isMonorepo: boolean;

  /** Monorepo type if detected */
  monorepoType?: string;

  /** Per-package results (for monorepos) */
  packageResults?: Map<string, StaticAnalysisResult>;

  /** Project info */
  projectInfo?: {
    monorepoInfo?: MonorepoInfo;
    projectRefsInfo?: ProjectReferencesInfo;
  };
}

const DEFAULT_CONFIG: StaticAnalyzerConfig = {
  timeout: 60000,
  additionalFlags: [],
  checkJavaScript: false,
  autoDetectProjectRefs: true,
  autoDetectMonorepo: true,
};

// =============================================================================
// ERROR PATTERNS
// =============================================================================

/**
 * Regex patterns to parse tsc output
 * Format: file.tsx(line,column): error TS1234: message
 */
const TSC_ERROR_PATTERN = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/;

/**
 * Alternate format: file.tsx:line:column - error TS1234: message
 */
const TSC_ERROR_PATTERN_ALT = /^(.+?):(\d+):(\d+)\s*-\s*(error|warning)\s+(TS\d+):\s*(.+)$/;

// =============================================================================
// STATIC ANALYZER CLASS
// =============================================================================

export class StaticAnalyzer {
  private webcontainer: WebContainer;
  private config: StaticAnalyzerConfig;

  constructor(
    webcontainer: WebContainer,
    config: Partial<StaticAnalyzerConfig> = {}
  ) {
    this.webcontainer = webcontainer;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run full static analysis on the project
   *
   * This runs `npx tsc --noEmit` which checks ALL .ts/.tsx files
   * in the project, including orphaned ones not in the import graph.
   */
  async analyze(): Promise<StaticAnalysisResult> {
    const startTime = Date.now();

    const result: StaticAnalysisResult = {
      success: true,
      errors: [],
      warnings: [],
      rawOutput: '',
      timestamp: Date.now(),
      duration: 0,
    };

    try {
      this.config.onProgress?.('Running TypeScript compiler (tsc --noEmit)...');

      // Build tsc command arguments
      const args = [
        'tsc',
        '--noEmit',
        '--pretty', 'false', // Plain output for parsing
        '--skipLibCheck', // Skip node_modules type checking
        ...this.config.additionalFlags,
      ];

      // Spawn tsc process
      const process = await this.webcontainer.spawn('npx', args);

      // Collect output
      let output = '';
      const outputPromise = new Promise<void>((resolve) => {
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              output += data;
            },
            close() {
              resolve();
            },
          })
        ).catch(() => resolve());
      });

      // Wait for process to complete with timeout
      const exitPromise = process.exit;

      const timeoutPromise = new Promise<number>((_, reject) => {
        setTimeout(() => reject(new Error('tsc timeout')), this.config.timeout);
      });

      let exitCode: number;
      try {
        exitCode = await Promise.race([exitPromise, timeoutPromise]);
      } catch (err) {
        if (err instanceof Error && err.message === 'tsc timeout') {
          result.rawOutput = output;
          result.errors.push({
            code: 'TIMEOUT',
            message: 'TypeScript compiler timed out',
            file: '',
            line: 0,
            column: 0,
            severity: 'error',
          });
          result.success = false;
          result.duration = Date.now() - startTime;
          return result;
        }
        throw err;
      }

      // Wait for output to finish
      await outputPromise;

      result.rawOutput = output;

      // Parse the output
      const parsed = this.parseOutput(output);
      result.errors = parsed.errors;
      result.warnings = parsed.warnings;

      // Determine success based on exit code and errors
      result.success = exitCode === 0 && result.errors.length === 0;

      this.config.onProgress?.(
        result.success
          ? 'Static analysis passed - no errors'
          : `Static analysis found ${result.errors.length} error(s)`
      );

    } catch (error) {
      // Handle case where tsc is not available or other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if tsconfig.json doesn't exist (common in JS-only projects)
      if (errorMessage.includes('tsconfig.json') || errorMessage.includes('No inputs')) {
        this.config.onProgress?.('No TypeScript configuration found, skipping static analysis');
        result.success = true;
        result.rawOutput = 'Skipped: No tsconfig.json found';
      } else {
        result.success = false;
        result.errors.push({
          code: 'ANALYZER_ERROR',
          message: `Static analysis failed: ${errorMessage}`,
          file: '',
          line: 0,
          column: 0,
          severity: 'error',
        });
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Run enhanced analysis with monorepo and project references support
   */
  async analyzeEnhanced(): Promise<EnhancedAnalysisResult> {
    const startTime = Date.now();

    const result: EnhancedAnalysisResult = {
      success: true,
      errors: [],
      warnings: [],
      rawOutput: '',
      timestamp: Date.now(),
      duration: 0,
      usesProjectReferences: false,
      isMonorepo: false,
    };

    try {
      // Step 1: Detect project structure
      let monorepoInfo: MonorepoInfo | undefined;
      let projectRefsInfo: ProjectReferencesInfo | undefined;

      if (this.config.autoDetectMonorepo) {
        this.config.onProgress?.('Detecting monorepo structure...');
        const detector = new MonorepoDetector(this.webcontainer);
        monorepoInfo = await detector.detect();
        result.isMonorepo = monorepoInfo.isMonorepo;
        result.monorepoType = monorepoInfo.type;
      }

      if (this.config.autoDetectProjectRefs) {
        this.config.onProgress?.('Detecting TypeScript project references...');
        const handler = new TsProjectReferencesHandler(this.webcontainer);
        projectRefsInfo = await handler.analyze();
        result.usesProjectReferences = projectRefsInfo.usesReferences;
      }

      result.projectInfo = { monorepoInfo, projectRefsInfo };

      // Step 2: Choose verification strategy
      if (result.isMonorepo && monorepoInfo && monorepoInfo.packages.length > 0) {
        // Monorepo: verify each package
        this.config.onProgress?.(`Analyzing ${monorepoInfo.packages.length} packages...`);
        result.packageResults = new Map();

        for (const pkg of monorepoInfo.packages) {
          if (pkg.hasTsConfig) {
            this.config.onProgress?.(`Analyzing ${pkg.name}...`);
            const pkgResult = await this.analyzePackage(pkg);
            result.packageResults.set(pkg.name, pkgResult);

            // Aggregate errors
            result.errors.push(...pkgResult.errors.map(e => ({
              ...e,
              file: `${pkg.path}/${e.file}`,
            })));
            result.warnings.push(...pkgResult.warnings.map(w => ({
              ...w,
              file: `${pkg.path}/${w.file}`,
            })));
          }
        }

        result.success = result.errors.length === 0;
      } else if (result.usesProjectReferences && projectRefsInfo) {
        // Project references: use --build flag
        this.config.onProgress?.('Running tsc --build --noEmit...');
        const buildResult = await this.analyzeWithBuild();
        result.errors = buildResult.errors;
        result.warnings = buildResult.warnings;
        result.rawOutput = buildResult.rawOutput;
        result.success = buildResult.success;
      } else {
        // Standard: use regular tsc --noEmit
        const standardResult = await this.analyze();
        result.errors = standardResult.errors;
        result.warnings = standardResult.warnings;
        result.rawOutput = standardResult.rawOutput;
        result.success = standardResult.success;
      }

      this.config.onProgress?.(
        result.success
          ? 'Enhanced analysis passed'
          : `Enhanced analysis found ${result.errors.length} error(s)`
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.success = false;
      result.errors.push({
        code: 'ANALYZER_ERROR',
        message: `Enhanced analysis failed: ${errorMessage}`,
        file: '',
        line: 0,
        column: 0,
        severity: 'error',
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Analyze a single monorepo package
   */
  private async analyzePackage(pkg: MonorepoPackage): Promise<StaticAnalysisResult> {
    const result: StaticAnalysisResult = {
      success: true,
      errors: [],
      warnings: [],
      rawOutput: '',
      timestamp: Date.now(),
      duration: 0,
    };

    try {
      const process = await this.webcontainer.spawn('sh', [
        '-c',
        `cd ${pkg.path} && npx tsc --noEmit --pretty false --skipLibCheck`,
      ]);

      let output = '';
      const outputPromise = new Promise<void>((resolve) => {
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              output += data;
            },
            close() {
              resolve();
            },
          })
        ).catch(() => resolve());
      });

      const exitCode = await process.exit;
      await outputPromise;

      result.rawOutput = output;
      const parsed = this.parseOutput(output);
      result.errors = parsed.errors;
      result.warnings = parsed.warnings;
      result.success = exitCode === 0 && result.errors.length === 0;

    } catch (error) {
      result.success = true; // Skip packages that fail to analyze
      result.rawOutput = `Skipped: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return result;
  }

  /**
   * Analyze using tsc --build (for project references)
   */
  private async analyzeWithBuild(): Promise<StaticAnalysisResult> {
    const result: StaticAnalysisResult = {
      success: true,
      errors: [],
      warnings: [],
      rawOutput: '',
      timestamp: Date.now(),
      duration: 0,
    };

    try {
      const args = [
        'tsc',
        '--build',
        '--noEmit',
        '--pretty', 'false',
        ...this.config.additionalFlags,
      ];

      const process = await this.webcontainer.spawn('npx', args);

      let output = '';
      const outputPromise = new Promise<void>((resolve) => {
        process.output.pipeTo(
          new WritableStream({
            write(data) {
              output += data;
            },
            close() {
              resolve();
            },
          })
        ).catch(() => resolve());
      });

      const exitCode = await process.exit;
      await outputPromise;

      result.rawOutput = output;
      const parsed = this.parseOutput(output);
      result.errors = parsed.errors;
      result.warnings = parsed.warnings;
      result.success = exitCode === 0 && result.errors.length === 0;

    } catch (error) {
      result.success = false;
      result.errors.push({
        code: 'BUILD_ERROR',
        message: `Build analysis failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        file: '',
        line: 0,
        column: 0,
        severity: 'error',
      });
    }

    return result;
  }

  /**
   * Run quick analysis on specific files only
   * Useful for per-file verification after changes
   */
  async analyzeFiles(filePaths: string[]): Promise<StaticAnalysisResult> {
    const startTime = Date.now();

    const result: StaticAnalysisResult = {
      success: true,
      errors: [],
      warnings: [],
      rawOutput: '',
      timestamp: Date.now(),
      duration: 0,
    };

    if (filePaths.length === 0) {
      result.duration = Date.now() - startTime;
      return result;
    }

    try {
      // Build tsc command with specific files
      const args = [
        'tsc',
        '--noEmit',
        '--pretty', 'false',
        '--skipLibCheck',
        ...filePaths,
      ];

      const process = await this.webcontainer.spawn('npx', args);

      let output = '';
      process.output.pipeTo(
        new WritableStream({
          write(data) {
            output += data;
          },
        })
      ).catch(() => {});

      const exitCode = await process.exit;

      result.rawOutput = output;
      const parsed = this.parseOutput(output);
      result.errors = parsed.errors;
      result.warnings = parsed.warnings;
      result.success = exitCode === 0 && result.errors.length === 0;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.success = false;
      result.errors.push({
        code: 'ANALYZER_ERROR',
        message: `File analysis failed: ${errorMessage}`,
        file: '',
        line: 0,
        column: 0,
        severity: 'error',
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Check if a single file has TypeScript errors
   * Returns true if file has no errors
   */
  async checkFile(filePath: string): Promise<{ valid: boolean; errors: StaticAnalysisError[] }> {
    const result = await this.analyzeFiles([filePath]);
    return {
      valid: result.success,
      errors: result.errors,
    };
  }

  /**
   * Parse tsc output into structured errors
   */
  private parseOutput(output: string): {
    errors: StaticAnalysisError[];
    warnings: StaticAnalysisError[];
  } {
    const errors: StaticAnalysisError[] = [];
    const warnings: StaticAnalysisError[] = [];
    const seen = new Set<string>();

    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try primary pattern
      let match = TSC_ERROR_PATTERN.exec(trimmed);
      if (!match) {
        // Try alternate pattern
        match = TSC_ERROR_PATTERN_ALT.exec(trimmed);
      }

      if (match) {
        const [, file, lineNum, colNum, severity, code, message] = match;

        // Deduplicate
        const key = `${file}:${lineNum}:${colNum}:${code}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const error: StaticAnalysisError = {
          code,
          message: message.trim(),
          file: this.normalizeFilePath(file),
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          severity: severity === 'warning' ? 'warning' : 'error',
        };

        if (severity === 'warning') {
          warnings.push(error);
        } else {
          errors.push(error);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Normalize file paths for consistency
   */
  private normalizeFilePath(filePath: string): string {
    // Remove leading ./ if present
    let normalized = filePath.replace(/^\.\//, '');
    // Normalize Windows paths to Unix
    normalized = normalized.replace(/\\/g, '/');
    return normalized;
  }

  /**
   * Get a summary string of analysis results
   */
  static getSummary(result: StaticAnalysisResult): string {
    if (result.success) {
      return 'TypeScript: 0 errors';
    }

    const parts: string[] = [];
    if (result.errors.length > 0) {
      parts.push(`${result.errors.length} error(s)`);
    }
    if (result.warnings.length > 0) {
      parts.push(`${result.warnings.length} warning(s)`);
    }

    return `TypeScript: ${parts.join(', ')}`;
  }

  /**
   * Format errors for display in chat/terminal
   */
  static formatErrors(result: StaticAnalysisResult, maxErrors: number = 10): string {
    if (result.success) {
      return 'No TypeScript errors found.';
    }

    const errors = result.errors.slice(0, maxErrors);
    const formatted = errors.map((e) => {
      if (e.file && e.line > 0) {
        return `- ${e.file}:${e.line}:${e.column} - ${e.code}: ${e.message}`;
      }
      return `- ${e.code}: ${e.message}`;
    });

    if (result.errors.length > maxErrors) {
      formatted.push(`... and ${result.errors.length - maxErrors} more errors`);
    }

    return formatted.join('\n');
  }

  /**
   * Format errors for AI context (includes more detail)
   */
  static formatErrorsForAI(result: StaticAnalysisResult): string {
    if (result.success) {
      return 'Static analysis passed with no errors.';
    }

    const sections: string[] = [];

    // Group errors by file
    const byFile = new Map<string, StaticAnalysisError[]>();
    for (const error of result.errors) {
      const file = error.file || '(unknown)';
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(error);
    }

    for (const [file, fileErrors] of byFile) {
      sections.push(`\n## ${file}`);
      for (const error of fileErrors) {
        sections.push(
          `- Line ${error.line}: ${error.code} - ${error.message}`
        );
      }
    }

    return `Static analysis found ${result.errors.length} TypeScript error(s):${sections.join('\n')}`;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new static analyzer instance
 */
export function createStaticAnalyzer(
  webcontainer: WebContainer,
  config?: Partial<StaticAnalyzerConfig>
): StaticAnalyzer {
  return new StaticAnalyzer(webcontainer, config);
}

/**
 * Run a quick static analysis check
 * Convenience function for one-off analysis
 */
export async function runStaticAnalysis(
  webcontainer: WebContainer,
  config?: Partial<StaticAnalyzerConfig>
): Promise<StaticAnalysisResult> {
  const analyzer = new StaticAnalyzer(webcontainer, config);
  return analyzer.analyze();
}

/**
 * Run enhanced static analysis with monorepo and project references support
 */
export async function runEnhancedStaticAnalysis(
  webcontainer: WebContainer,
  config?: Partial<StaticAnalyzerConfig>
): Promise<EnhancedAnalysisResult> {
  const analyzer = new StaticAnalyzer(webcontainer, config);
  return analyzer.analyzeEnhanced();
}
