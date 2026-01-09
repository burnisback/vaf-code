/**
 * Stylelint Runner
 *
 * Provides CSS/SCSS error checking using Stylelint.
 * Supports:
 * - CSS files
 * - SCSS/Sass files
 * - CSS-in-JS (styled-components, etc.)
 * - CSS Modules
 *
 * Enhanced with WebContainer direct integration.
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export interface StylelintError {
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Severity: error or warning */
  severity: 'error' | 'warning';
  /** Error message */
  message: string;
  /** Stylelint rule that triggered the error */
  rule: string;
}

export interface StylelintResult {
  /** Whether linting passed (no errors) */
  passed: boolean;
  /** Whether Stylelint is available */
  available: boolean;
  /** Total error count */
  errorCount: number;
  /** Total warning count */
  warningCount: number;
  /** Detailed errors */
  errors: StylelintError[];
  /** Raw output from stylelint */
  output: string;
  /** Files that were checked */
  filesChecked: number;
}

export interface StylelintRunnerConfig {
  /** Function to run stylelint command (legacy support) */
  runCommand?: (command: string) => Promise<{ output: string; exitCode: number }>;
  /** WebContainer instance (preferred) */
  webcontainer?: WebContainer;
  /** Stylelint config file path (optional) */
  configFile?: string;
  /** File patterns to lint */
  patterns?: string[];
  /** Additional stylelint arguments */
  extraArgs?: string[];
  /** Whether to fix auto-fixable issues */
  autoFix?: boolean;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

export interface StylelintFileCheckResult {
  /** File that was checked */
  file: string;
  /** Whether the file passed */
  passed: boolean;
  /** Errors in this file */
  errors: StylelintError[];
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_PATTERNS = ['**/*.css', '**/*.scss', '**/*.sass'];

// =============================================================================
// STYLELINT RUNNER CLASS
// =============================================================================

export class StylelintRunner {
  private config: StylelintRunnerConfig;
  private webcontainer: WebContainer | null;

  constructor(config: StylelintRunnerConfig) {
    this.config = {
      patterns: DEFAULT_PATTERNS,
      ...config,
    };
    this.webcontainer = config.webcontainer || null;
  }

  /**
   * Check if project has style files
   */
  async hasStyleFiles(): Promise<boolean> {
    if (!this.webcontainer) return true; // Assume yes in legacy mode

    const checkDir = async (dir: string): Promise<boolean> => {
      try {
        const entries = await this.webcontainer!.fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
            continue;
          }

          const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;

          if (entry.isDirectory()) {
            if (await checkDir(fullPath)) return true;
          } else {
            if (entry.name.endsWith('.css') || entry.name.endsWith('.scss') ||
                entry.name.endsWith('.sass') || entry.name.endsWith('.less')) {
              return true;
            }
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
   * Check if Stylelint is available via WebContainer
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.webcontainer) return true; // Assume yes in legacy mode

    try {
      const packageJson = await this.webcontainer.fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);
      return !!(pkg.devDependencies?.stylelint || pkg.dependencies?.stylelint || pkg.stylelint);
    } catch {
      return false;
    }
  }

  /**
   * Run stylelint on configured patterns
   */
  async run(): Promise<StylelintResult> {
    // Check availability first
    const available = await this.checkAvailability();
    if (!available) {
      return {
        passed: true,
        available: false,
        errorCount: 0,
        warningCount: 0,
        errors: [],
        output: 'Stylelint not installed',
        filesChecked: 0,
      };
    }

    // Check if there are style files
    const hasStyles = await this.hasStyleFiles();
    if (!hasStyles) {
      return {
        passed: true,
        available: true,
        errorCount: 0,
        warningCount: 0,
        errors: [],
        output: 'No style files found',
        filesChecked: 0,
      };
    }

    this.config.onProgress?.('[Stylelint] Running style analysis...');

    const args = this.buildArgs(this.config.patterns || DEFAULT_PATTERNS);

    // Use WebContainer if available
    if (this.webcontainer) {
      return this.runViaWebContainer(args);
    }

    // Legacy mode
    const command = args.join(' ');
    const { output, exitCode } = await this.config.runCommand!(command);
    const result = this.parseResult(output, exitCode);
    result.available = true;
    return result;
  }

  /**
   * Run via WebContainer
   */
  private async runViaWebContainer(args: string[]): Promise<StylelintResult> {
    try {
      // Remove 'npx' and 'stylelint' from args as we spawn them separately
      const cleanArgs = args.filter(a => a !== 'npx' && a !== 'stylelint');

      const process = await this.webcontainer!.spawn('npx', ['stylelint', ...cleanArgs]);

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

      this.config.onProgress?.(`[Stylelint] Completed with exit code: ${exitCode}`);

      const result = this.parseResult(rawOutput, exitCode);
      result.available = true;
      return result;
    } catch (error) {
      return {
        passed: false,
        available: true,
        errorCount: 0,
        warningCount: 0,
        errors: [],
        output: error instanceof Error ? error.message : String(error),
        filesChecked: 0,
      };
    }
  }

  /**
   * Run stylelint on specific files
   */
  async runOnFiles(files: string[]): Promise<StylelintResult> {
    if (files.length === 0) {
      return {
        passed: true,
        available: true,
        errorCount: 0,
        warningCount: 0,
        errors: [],
        output: 'No files to lint',
        filesChecked: 0,
      };
    }

    // Filter to only CSS/SCSS files
    const styleFiles = files.filter(f =>
      f.endsWith('.css') ||
      f.endsWith('.scss') ||
      f.endsWith('.sass') ||
      f.endsWith('.less')
    );

    if (styleFiles.length === 0) {
      return {
        passed: true,
        available: true,
        errorCount: 0,
        warningCount: 0,
        errors: [],
        output: 'No style files to lint',
        filesChecked: 0,
      };
    }

    const args = this.buildArgs(styleFiles);

    // Use WebContainer if available
    if (this.webcontainer) {
      const result = await this.runViaWebContainer(args);
      result.filesChecked = styleFiles.length;
      return result;
    }

    // Legacy mode
    const command = args.join(' ');
    const { output, exitCode } = await this.config.runCommand!(command);

    const result = this.parseResult(output, exitCode);
    result.filesChecked = styleFiles.length;
    result.available = true;

    return result;
  }

  /**
   * Check a single file
   */
  async checkFile(file: string): Promise<StylelintFileCheckResult> {
    const result = await this.runOnFiles([file]);

    return {
      file,
      passed: result.passed,
      errors: result.errors.filter(e => e.file === file || e.file.endsWith(file)),
    };
  }

  /**
   * Fix auto-fixable issues in files
   */
  async fix(files?: string[]): Promise<StylelintResult> {
    const patterns = files || this.config.patterns;
    const args = this.buildArgs(patterns, true);
    const command = args.join(' ');
    const { output, exitCode } = await this.config.runCommand(command);

    return this.parseResult(output, exitCode);
  }

  /**
   * Build stylelint command arguments
   */
  private buildArgs(patterns: string[], autoFix = false): string[] {
    const args = ['npx', 'stylelint', ...patterns, '--formatter', 'json'];

    if (this.config.configFile) {
      args.push('--config', this.config.configFile);
    }

    if (autoFix || this.config.autoFix) {
      args.push('--fix');
    }

    if (this.config.extraArgs) {
      args.push(...this.config.extraArgs);
    }

    return args;
  }

  /**
   * Parse stylelint output
   */
  private parseResult(output: string, exitCode: number): StylelintResult {
    const errors: StylelintError[] = [];
    let filesChecked = 0;

    try {
      // Parse JSON output
      const results = JSON.parse(output);

      for (const result of results) {
        filesChecked++;

        for (const warning of result.warnings || []) {
          errors.push({
            file: result.source,
            line: warning.line || 1,
            column: warning.column || 1,
            severity: warning.severity as 'error' | 'warning',
            message: warning.text,
            rule: warning.rule || 'unknown',
          });
        }
      }
    } catch {
      // Try to parse text output
      // Format: path/to/file.css
      //         10:5  ✖  Error message  rule-name
      const filePattern = /^(.+\.(css|scss|sass|less))$/gm;
      const errorPattern = /^\s*(\d+):(\d+)\s+(✖|⚠)\s+(.+?)\s{2,}(\S+)$/gm;

      let currentFile = '';
      let match;

      // Find file names
      while ((match = filePattern.exec(output)) !== null) {
        currentFile = match[1];
      }

      // Find errors
      while ((match = errorPattern.exec(output)) !== null) {
        errors.push({
          file: currentFile || 'unknown',
          line: parseInt(match[1]),
          column: parseInt(match[2]),
          severity: match[3] === '✖' ? 'error' : 'warning',
          message: match[4],
          rule: match[5],
        });
      }
    }

    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length;

    return {
      passed: exitCode === 0 && errorCount === 0,
      errorCount,
      warningCount,
      errors,
      output,
      filesChecked,
    };
  }

  /**
   * Format errors for display
   */
  formatErrors(errors: StylelintError[]): string {
    if (errors.length === 0) {
      return 'No Stylelint errors.';
    }

    const lines = ['## Stylelint Errors', ''];
    const grouped = new Map<string, StylelintError[]>();

    // Group by file
    for (const error of errors) {
      const existing = grouped.get(error.file) || [];
      existing.push(error);
      grouped.set(error.file, existing);
    }

    for (const [file, fileErrors] of grouped) {
      lines.push(`### ${file}`);
      for (const error of fileErrors) {
        const icon = error.severity === 'error' ? '❌' : '⚠️';
        lines.push(`- ${icon} Line ${error.line}:${error.column} - ${error.message} (${error.rule})`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get summary for display
   */
  getSummary(result: StylelintResult): string {
    if (result.passed) {
      return `✓ ${result.filesChecked} style file(s) passed`;
    }

    const parts = [];
    if (result.errorCount > 0) {
      parts.push(`${result.errorCount} error(s)`);
    }
    if (result.warningCount > 0) {
      parts.push(`${result.warningCount} warning(s)`);
    }

    return `✗ ${parts.join(', ')} in ${result.filesChecked} file(s)`;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a Stylelint runner instance
 */
export function createStylelintRunner(
  config: StylelintRunnerConfig
): StylelintRunner {
  return new StylelintRunner(config);
}

/**
 * Create a Stylelint runner with WebContainer
 */
export function createStylelintRunnerWithWebContainer(
  webcontainer: WebContainer,
  onProgress?: (message: string) => void
): StylelintRunner {
  return new StylelintRunner({
    webcontainer,
    onProgress,
  });
}

/**
 * Quick Stylelint run via WebContainer
 */
export async function runStylelint(webcontainer: WebContainer): Promise<StylelintResult> {
  const runner = new StylelintRunner({ webcontainer });
  return runner.run();
}

/**
 * Check if Stylelint should be used (has styles and is available)
 */
export async function shouldUseStylelint(webcontainer: WebContainer): Promise<boolean> {
  const runner = new StylelintRunner({ webcontainer });
  const hasStyles = await runner.hasStyleFiles();
  const available = await runner.checkAvailability();
  return hasStyles && available;
}

// =============================================================================
// HELPER: Check if Stylelint is available (legacy)
// =============================================================================

/**
 * Check if Stylelint is installed in the project (legacy API)
 */
export async function isStylelintAvailable(
  fileExists: (path: string) => Promise<boolean>,
  readFile: (path: string) => Promise<string | null>
): Promise<boolean> {
  // Check package.json for stylelint
  const hasPackageJson = await fileExists('package.json');
  if (!hasPackageJson) {
    return false;
  }

  const packageContent = await readFile('package.json');
  if (!packageContent) {
    return false;
  }

  try {
    const pkg = JSON.parse(packageContent);
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    return 'stylelint' in allDeps;
  } catch {
    return false;
  }
}
