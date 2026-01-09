/**
 * ESLint Runner
 *
 * Provides static analysis for JavaScript-only projects (no TypeScript).
 * Acts as a fallback when tsc --noEmit cannot be used.
 *
 * Features:
 * - Detects JS-only projects (no tsconfig.json)
 * - Runs ESLint with JSON output for parsing
 * - Parses errors into structured format
 * - Supports various ESLint configurations
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export interface ESLintError {
  /** File path */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Error message */
  message: string;
  /** ESLint rule ID */
  ruleId: string | null;
  /** Severity: 1 = warning, 2 = error */
  severity: 1 | 2;
  /** Whether this error is fixable */
  fixable: boolean;
}

export interface ESLintFileResult {
  /** File path */
  filePath: string;
  /** Errors in this file */
  messages: ESLintError[];
  /** Number of errors */
  errorCount: number;
  /** Number of warnings */
  warningCount: number;
  /** Number of fixable errors */
  fixableErrorCount: number;
  /** Number of fixable warnings */
  fixableWarningCount: number;
}

export interface ESLintResult {
  /** Whether ESLint ran successfully */
  success: boolean;
  /** Whether ESLint is available in the project */
  available: boolean;
  /** Total number of errors */
  errorCount: number;
  /** Total number of warnings */
  warningCount: number;
  /** Results per file */
  results: ESLintFileResult[];
  /** All errors flattened */
  errors: ESLintError[];
  /** Raw output (for debugging) */
  rawOutput: string;
  /** Error message if ESLint failed */
  error?: string;
}

export interface ESLintRunnerConfig {
  /** File extensions to lint */
  extensions?: string[];
  /** Directories to lint */
  directories?: string[];
  /** Whether to fix automatically */
  fix?: boolean;
  /** Whether to use cache */
  cache?: boolean;
  /** Max warnings before failing */
  maxWarnings?: number;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

// =============================================================================
// ESLINT RUNNER CLASS
// =============================================================================

export class ESLintRunner {
  private webcontainer: WebContainer;
  private config: Required<ESLintRunnerConfig>;

  constructor(webcontainer: WebContainer, config: ESLintRunnerConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = {
      extensions: config.extensions || ['.js', '.jsx', '.mjs', '.cjs'],
      directories: config.directories || ['src', '.'],
      fix: config.fix ?? false,
      cache: config.cache ?? true,
      maxWarnings: config.maxWarnings ?? -1,
      onProgress: config.onProgress || (() => {}),
    };
  }

  /**
   * Detect if this is a JavaScript-only project (no TypeScript)
   */
  async isJSOnlyProject(): Promise<boolean> {
    try {
      // Check for tsconfig.json
      await this.webcontainer.fs.readFile('tsconfig.json', 'utf-8');
      return false; // Has TypeScript
    } catch {
      // No tsconfig.json - check for TypeScript files
      const hasTypeScript = await this.hasTypeScriptFiles();
      return !hasTypeScript;
    }
  }

  /**
   * Check if ESLint is available in the project
   */
  async isESLintAvailable(): Promise<boolean> {
    try {
      // Check for ESLint config files
      const configFiles = [
        '.eslintrc',
        '.eslintrc.js',
        '.eslintrc.cjs',
        '.eslintrc.json',
        '.eslintrc.yaml',
        '.eslintrc.yml',
        'eslint.config.js',
        'eslint.config.mjs',
        'eslint.config.cjs',
      ];

      for (const file of configFiles) {
        try {
          await this.webcontainer.fs.readFile(file, 'utf-8');
          return true;
        } catch {
          // File doesn't exist
        }
      }

      // Check package.json for eslintConfig
      try {
        const packageJson = await this.webcontainer.fs.readFile('package.json', 'utf-8');
        const pkg = JSON.parse(packageJson);
        if (pkg.eslintConfig) return true;
        // Check if eslint is in dependencies
        if (pkg.devDependencies?.eslint || pkg.dependencies?.eslint) return true;
      } catch {
        // No package.json or can't parse
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Run ESLint and return structured results
   */
  async run(): Promise<ESLintResult> {
    this.config.onProgress?.('[ESLint] Starting ESLint analysis...');

    // Check if ESLint is available
    if (!(await this.isESLintAvailable())) {
      return {
        success: true,
        available: false,
        errorCount: 0,
        warningCount: 0,
        results: [],
        errors: [],
        rawOutput: '',
        error: 'ESLint is not configured in this project',
      };
    }

    try {
      // Build ESLint command
      const args = this.buildArgs();
      const command = `npx eslint ${args.join(' ')} 2>&1`;

      this.config.onProgress?.(`[ESLint] Running: ${command}`);

      // Run ESLint
      const process = await this.webcontainer.spawn('npx', ['eslint', ...args]);

      let output = '';
      const outputPromise = new Promise<string>((resolve) => {
        process.output.pipeTo(
          new WritableStream({
            write(chunk) {
              output += chunk;
            },
            close() {
              resolve(output);
            },
          })
        );
      });

      const [exitCode, rawOutput] = await Promise.all([
        process.exit,
        outputPromise,
      ]);

      this.config.onProgress?.(`[ESLint] Completed with exit code: ${exitCode}`);

      // Parse the JSON output
      return this.parseOutput(rawOutput, exitCode);
    } catch (error) {
      return {
        success: false,
        available: true,
        errorCount: 0,
        warningCount: 0,
        results: [],
        errors: [],
        rawOutput: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Run ESLint on specific files
   */
  async runOnFiles(files: string[]): Promise<ESLintResult> {
    if (files.length === 0) {
      return {
        success: true,
        available: true,
        errorCount: 0,
        warningCount: 0,
        results: [],
        errors: [],
        rawOutput: '',
      };
    }

    this.config.onProgress?.(`[ESLint] Running on ${files.length} file(s)...`);

    try {
      const args = ['--format', 'json', ...files];

      const process = await this.webcontainer.spawn('npx', ['eslint', ...args]);

      let output = '';
      const outputPromise = new Promise<string>((resolve) => {
        process.output.pipeTo(
          new WritableStream({
            write(chunk) {
              output += chunk;
            },
            close() {
              resolve(output);
            },
          })
        );
      });

      const [exitCode, rawOutput] = await Promise.all([
        process.exit,
        outputPromise,
      ]);

      return this.parseOutput(rawOutput, exitCode);
    } catch (error) {
      return {
        success: false,
        available: true,
        errorCount: 0,
        warningCount: 0,
        results: [],
        errors: [],
        rawOutput: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build ESLint command arguments
   */
  private buildArgs(): string[] {
    const args: string[] = [];

    // Output format (JSON for parsing)
    args.push('--format', 'json');

    // Extensions
    if (this.config.extensions.length > 0) {
      args.push('--ext', this.config.extensions.join(','));
    }

    // Fix mode
    if (this.config.fix) {
      args.push('--fix');
    }

    // Cache
    if (this.config.cache) {
      args.push('--cache');
    }

    // Max warnings
    if (this.config.maxWarnings >= 0) {
      args.push('--max-warnings', String(this.config.maxWarnings));
    }

    // Directories to lint
    args.push(...this.config.directories);

    return args;
  }

  /**
   * Parse ESLint JSON output
   */
  private parseOutput(rawOutput: string, exitCode: number): ESLintResult {
    try {
      // Try to find JSON in output (ESLint outputs JSON directly)
      const jsonMatch = rawOutput.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // No JSON found - might be a config error or no files
        if (rawOutput.includes('No files matching')) {
          return {
            success: true,
            available: true,
            errorCount: 0,
            warningCount: 0,
            results: [],
            errors: [],
            rawOutput,
          };
        }

        return {
          success: exitCode === 0,
          available: true,
          errorCount: 0,
          warningCount: 0,
          results: [],
          errors: [],
          rawOutput,
          error: rawOutput.trim() || 'No ESLint output',
        };
      }

      const results: ESLintFileResult[] = JSON.parse(jsonMatch[0]);

      // Flatten all errors
      const errors: ESLintError[] = [];
      let totalErrors = 0;
      let totalWarnings = 0;

      for (const file of results) {
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;

        for (const msg of file.messages as any[]) {
          errors.push({
            filePath: file.filePath,
            line: msg.line || 1,
            column: msg.column || 1,
            message: msg.message,
            ruleId: msg.ruleId || null,
            severity: msg.severity as 1 | 2,
            fixable: !!msg.fix,
          });
        }
      }

      this.config.onProgress?.(
        `[ESLint] Found ${totalErrors} error(s), ${totalWarnings} warning(s)`
      );

      return {
        success: totalErrors === 0,
        available: true,
        errorCount: totalErrors,
        warningCount: totalWarnings,
        results: results.map((r) => ({
          filePath: r.filePath,
          messages: (r.messages as any[]).map((m) => ({
            filePath: r.filePath,
            line: m.line || 1,
            column: m.column || 1,
            message: m.message,
            ruleId: m.ruleId || null,
            severity: m.severity as 1 | 2,
            fixable: !!m.fix,
          })),
          errorCount: r.errorCount,
          warningCount: r.warningCount,
          fixableErrorCount: (r as any).fixableErrorCount || 0,
          fixableWarningCount: (r as any).fixableWarningCount || 0,
        })),
        errors,
        rawOutput,
      };
    } catch (parseError) {
      return {
        success: false,
        available: true,
        errorCount: 0,
        warningCount: 0,
        results: [],
        errors: [],
        rawOutput,
        error: `Failed to parse ESLint output: ${parseError}`,
      };
    }
  }

  /**
   * Check if project has TypeScript files
   */
  private async hasTypeScriptFiles(): Promise<boolean> {
    const checkDir = async (dir: string): Promise<boolean> => {
      try {
        const entries = await this.webcontainer.fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

          const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;

          if (entry.isDirectory()) {
            if (await checkDir(fullPath)) return true;
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            return true;
          }
        }
      } catch {
        // Can't read directory
      }
      return false;
    };

    return checkDir('/');
  }

  /**
   * Format errors for display
   */
  formatErrors(result: ESLintResult): string {
    if (!result.available) {
      return 'ESLint is not configured in this project.';
    }

    if (result.errors.length === 0) {
      return 'No ESLint errors found.';
    }

    const lines: string[] = ['## ESLint Errors', ''];

    // Group by file
    const byFile = new Map<string, ESLintError[]>();
    for (const error of result.errors) {
      const existing = byFile.get(error.filePath) || [];
      existing.push(error);
      byFile.set(error.filePath, existing);
    }

    for (const [file, errors] of byFile) {
      lines.push(`### ${file}`);
      for (const error of errors) {
        const severity = error.severity === 2 ? 'error' : 'warning';
        const rule = error.ruleId ? ` (${error.ruleId})` : '';
        lines.push(`- Line ${error.line}:${error.column} [${severity}]${rule}: ${error.message}`);
      }
      lines.push('');
    }

    lines.push(`**Total: ${result.errorCount} error(s), ${result.warningCount} warning(s)**`);

    return lines.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an ESLint runner
 */
export function createESLintRunner(
  webcontainer: WebContainer,
  config?: ESLintRunnerConfig
): ESLintRunner {
  return new ESLintRunner(webcontainer, config);
}

/**
 * Quick check if ESLint should be used (JS-only project)
 */
export async function shouldUseESLint(webcontainer: WebContainer): Promise<boolean> {
  const runner = new ESLintRunner(webcontainer);
  const isJSOnly = await runner.isJSOnlyProject();
  const isAvailable = await runner.isESLintAvailable();
  return isJSOnly && isAvailable;
}

/**
 * Quick ESLint run
 */
export async function runESLint(webcontainer: WebContainer): Promise<ESLintResult> {
  const runner = new ESLintRunner(webcontainer);
  return runner.run();
}
