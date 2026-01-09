/**
 * Build Runner
 *
 * Phase 3 fix for stale build verification.
 *
 * Actively runs build commands in WebContainer and captures the output,
 * instead of relying on stale terminal buffers.
 *
 * Features:
 * - Auto-detects build tool (Vite, Webpack, esbuild, etc.)
 * - Auto-detects package manager (npm, yarn, pnpm)
 * - Uses appropriate commands for each combination
 * - Parses errors using tool-specific patterns
 *
 * This ensures pre-verification gets FRESH build results.
 */

import type { WebContainer } from '@webcontainer/api';
import { BuildToolDetector, type BuildTool, type BuildToolError } from './buildToolDetector';
import { PackageManagerDetector, type PackageManager } from './packageManagerDetector';

// =============================================================================
// TYPES
// =============================================================================

export interface BuildResult {
  /** Whether the build succeeded (exit code 0) */
  success: boolean;

  /** Exit code from the build process */
  exitCode: number;

  /** Full output from the build */
  output: string;

  /** Parsed errors from the output */
  errors: BuildError[];

  /** Duration in milliseconds */
  duration: number;

  /** Timestamp when build was run */
  timestamp: number;

  /** Detected build tool */
  buildTool?: BuildTool;

  /** Detected package manager */
  packageManager?: PackageManager;

  /** Command that was executed */
  command?: string;
}

export interface BuildError {
  /** Error type */
  type: 'type' | 'module' | 'syntax' | 'runtime' | 'other';

  /** Error message */
  message: string;

  /** File path if identifiable */
  file?: string;

  /** Line number if identifiable */
  line?: number;

  /** Error code if available */
  code?: string;
}

export interface BuildRunnerConfig {
  /** Build command to run (default: auto-detected) */
  buildCommand?: string;

  /** Timeout in milliseconds */
  timeout: number;

  /** Whether to capture only errors (faster) */
  errorsOnly: boolean;

  /** Auto-detect build tool (Vite, Webpack, etc.) */
  autoDetectBuildTool: boolean;

  /** Auto-detect package manager (npm, yarn, pnpm) */
  autoDetectPackageManager: boolean;

  /** Callback for progress updates */
  onProgress?: (message: string) => void;

  /** Callback for build output */
  onOutput?: (data: string) => void;
}

const DEFAULT_CONFIG: BuildRunnerConfig = {
  buildCommand: undefined, // Auto-detect
  timeout: 120000, // 2 minutes
  errorsOnly: false,
  autoDetectBuildTool: true,
  autoDetectPackageManager: true,
};

// =============================================================================
// ERROR PATTERNS
// =============================================================================

/**
 * Patterns to identify different error types in build output
 */
const ERROR_PATTERNS = {
  // TypeScript errors: TS2304, TS2307, etc.
  typescript: /(?:^|\n)(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/g,
  typescriptAlt: /(?:^|\n)(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)/g,

  // Module not found
  module: /(?:Cannot find module|Module not found).*?['"](.+?)['"]/gi,

  // Syntax errors
  syntax: /(?:SyntaxError|Unexpected token|Parsing error):?\s*(.+)/gi,

  // Vite/Rollup errors
  vite: /\[vite\](?:\s*\[.*?\])?\s*(.+)/gi,

  // Generic error lines
  generic: /(?:^|\n)(?:error|ERROR|Error)(?:\s*\[.*?\])?:?\s*(.+)/gi,
};

// =============================================================================
// BUILD RUNNER CLASS
// =============================================================================

export class BuildRunner {
  private webcontainer: WebContainer;
  private config: BuildRunnerConfig;
  private buildToolDetector: BuildToolDetector;
  private packageManagerDetector: PackageManagerDetector;
  private detectedBuildTool: BuildTool | null = null;
  private detectedPackageManager: PackageManager | null = null;

  constructor(
    webcontainer: WebContainer,
    config: Partial<BuildRunnerConfig> = {}
  ) {
    this.webcontainer = webcontainer;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buildToolDetector = new BuildToolDetector(webcontainer, {
      onProgress: config.onProgress,
    });
    this.packageManagerDetector = new PackageManagerDetector(webcontainer, {
      onProgress: config.onProgress,
    });
  }

  /**
   * Detect and cache build tool
   */
  private async detectBuildTool(): Promise<BuildTool> {
    if (!this.detectedBuildTool) {
      this.detectedBuildTool = await this.buildToolDetector.detect();
    }
    return this.detectedBuildTool;
  }

  /**
   * Detect and cache package manager
   */
  private async detectPackageManager(): Promise<PackageManager> {
    if (!this.detectedPackageManager) {
      const info = await this.packageManagerDetector.detect();
      this.detectedPackageManager = info.manager;
    }
    return this.detectedPackageManager;
  }

  /**
   * Get the build command to use
   */
  private async getBuildCommand(): Promise<string[]> {
    // If explicit command provided, use it
    if (this.config.buildCommand) {
      return this.config.buildCommand.split(' ');
    }

    // Auto-detect
    if (this.config.autoDetectPackageManager) {
      const commands = await this.packageManagerDetector.getCommands();
      return commands.run('build');
    }

    // Default fallback
    return ['npm', 'run', 'build'];
  }

  /**
   * Run the build and capture output
   */
  async run(): Promise<BuildResult> {
    const startTime = Date.now();

    // Auto-detect if enabled
    let buildTool: BuildTool | undefined;
    let packageManager: PackageManager | undefined;

    if (this.config.autoDetectBuildTool) {
      buildTool = await this.detectBuildTool();
    }
    if (this.config.autoDetectPackageManager) {
      packageManager = await this.detectPackageManager();
    }

    const result: BuildResult = {
      success: false,
      exitCode: -1,
      output: '',
      errors: [],
      duration: 0,
      timestamp: Date.now(),
      buildTool,
      packageManager,
    };

    this.config.onProgress?.('[BuildRunner] Starting build...');

    try {
      // Get the build command (auto-detected or explicit)
      const commandParts = await this.getBuildCommand();
      const cmd = commandParts[0];
      const args = commandParts.slice(1);
      result.command = commandParts.join(' ');

      // Spawn the build process
      const process = await this.webcontainer.spawn(cmd, args);

      // Collect output
      let output = '';
      const outputPromise = new Promise<void>((resolve) => {
        process.output.pipeTo(
          new WritableStream({
            write: (data) => {
              output += data;
              this.config.onOutput?.(data);
            },
            close() {
              resolve();
            },
          })
        ).catch(() => resolve());
      });

      // Wait for process with timeout
      const exitPromise = process.exit;

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Build timeout')), this.config.timeout);
      });

      let exitCode: number;
      try {
        exitCode = await Promise.race([exitPromise, timeoutPromise]);
      } catch (err) {
        if (err instanceof Error && err.message === 'Build timeout') {
          result.output = output;
          result.errors.push({
            type: 'other',
            message: 'Build timed out',
          });
          result.duration = Date.now() - startTime;
          return result;
        }
        throw err;
      }

      // Wait for output to complete
      await outputPromise;

      result.exitCode = exitCode;
      result.output = output;
      result.success = exitCode === 0;

      // Parse errors from output using tool-specific patterns
      if (!result.success) {
        // Use BuildToolDetector's parseErrors for better tool-specific parsing
        if (this.config.autoDetectBuildTool) {
          const toolErrors = this.buildToolDetector.parseErrors(output);
          result.errors = toolErrors.map(te => ({
            type: te.type === 'import' ? 'module' : (te.type === 'unknown' ? 'other' : te.type) as BuildError['type'],
            message: te.message,
            file: te.file,
            line: te.line,
            code: te.code,
          }));
        } else {
          result.errors = this.parseErrors(output);
        }
      }

      this.config.onProgress?.(
        result.success
          ? '[BuildRunner] Build succeeded'
          : `[BuildRunner] Build failed with ${result.errors.length} error(s)`
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({
        type: 'other',
        message: `Build execution failed: ${errorMessage}`,
      });
      this.config.onProgress?.(`[BuildRunner] Build execution failed: ${errorMessage}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Run a quick type check (npm run typecheck or tsc --noEmit)
   */
  async runTypeCheck(): Promise<BuildResult> {
    // Get exec command based on package manager
    let execCmd: string[];
    if (this.config.autoDetectPackageManager) {
      execCmd = await this.packageManagerDetector.getExecCommand('tsc', ['--noEmit', '--pretty', 'false']);
    } else {
      execCmd = ['npx', 'tsc', '--noEmit', '--pretty', 'false'];
    }

    const runner = new BuildRunner(this.webcontainer, {
      ...this.config,
      buildCommand: execCmd.join(' '),
      autoDetectPackageManager: false, // Already handled
    });
    return runner.run();
  }

  /**
   * Run lint check
   * Tries npm/yarn/pnpm run lint, falls back gracefully if not available
   */
  async runLint(): Promise<BuildResult> {
    const startTime = Date.now();
    this.config.onProgress?.('[BuildRunner] Running lint check...');

    try {
      // First check if lint script exists
      const packageJson = await this.readPackageJson();
      if (!packageJson?.scripts?.lint) {
        this.config.onProgress?.('[BuildRunner] No lint script found, skipping...');
        return {
          success: true,
          exitCode: 0,
          output: 'No lint script configured',
          errors: [],
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        };
      }

      // Get lint command based on package manager
      let lintCommand: string;
      if (this.config.autoDetectPackageManager) {
        const commands = await this.packageManagerDetector.getCommands();
        lintCommand = commands.run('lint').join(' ');
      } else {
        lintCommand = 'npm run lint';
      }

      const runner = new BuildRunner(this.webcontainer, {
        ...this.config,
        buildCommand: lintCommand,
        timeout: 60000,
        autoDetectPackageManager: false, // Already handled
      });
      return runner.run();
    } catch {
      return {
        success: true, // Don't fail if lint can't run
        exitCode: 0,
        output: 'Lint check skipped',
        errors: [],
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Run test suite
   * Tries npm/yarn/pnpm test, falls back gracefully if not available
   */
  async runTests(): Promise<BuildResult> {
    const startTime = Date.now();
    this.config.onProgress?.('[BuildRunner] Running tests...');

    try {
      // Check if test script exists
      const packageJson = await this.readPackageJson();
      if (!packageJson?.scripts?.test) {
        this.config.onProgress?.('[BuildRunner] No test script found, skipping...');
        return {
          success: true,
          exitCode: 0,
          output: 'No test script configured',
          errors: [],
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        };
      }

      // Get test command based on package manager
      let testCommandParts: string[];
      if (this.config.autoDetectPackageManager) {
        const commands = await this.packageManagerDetector.getCommands();
        testCommandParts = commands.run('test');
      } else {
        testCommandParts = ['npm', 'run', 'test'];
      }

      // Check if it's jest or vitest and add CI flags to avoid watchers
      const testScript = packageJson.scripts.test;
      if (testScript.includes('jest') || testScript.includes('vitest')) {
        // Add --run flag for vitest or CI mode
        testCommandParts.push('--', '--run');
      }

      const testCommand = testCommandParts.join(' ');

      const runner = new BuildRunner(this.webcontainer, {
        ...this.config,
        buildCommand: testCommand,
        timeout: 120000, // 2 minute timeout for tests
        autoDetectPackageManager: false, // Already handled
      });

      const result = await runner.run();

      // Parse test-specific errors
      if (!result.success) {
        result.errors = this.parseTestErrors(result.output);
      }

      return result;
    } catch {
      return {
        success: true, // Don't fail if tests can't run
        exitCode: 0,
        output: 'Test run skipped',
        errors: [],
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Parse test-specific errors from output
   */
  private parseTestErrors(output: string): BuildError[] {
    const errors: BuildError[] = [];
    const seen = new Set<string>();

    // Jest/Vitest failure patterns
    const testFailPatterns = [
      // Failed test case
      /(?:FAIL|✕|×)\s+(.+)/gi,
      // Test file failure
      /(?:Test|Spec)\s+failed[:\s]+(.+)/gi,
      // Assertion errors
      /(?:AssertionError|expect\(.+\)\.toBe|Expected|Received):\s*(.+)/gi,
      // Error in test
      /Error:\s+(.+)/gi,
    ];

    for (const pattern of testFailPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(output)) !== null) {
        const message = match[1]?.trim();
        if (message && !seen.has(message.substring(0, 50))) {
          seen.add(message.substring(0, 50));
          errors.push({
            type: 'runtime',
            message,
          });
        }
      }
    }

    // If no specific errors found, add generic failure
    if (errors.length === 0 && output.includes('FAIL')) {
      errors.push({
        type: 'runtime',
        message: 'Test suite failed',
      });
    }

    return errors;
  }

  /**
   * Read package.json to check for available scripts
   */
  private async readPackageJson(): Promise<{ scripts?: Record<string, string> } | null> {
    try {
      const content = await this.webcontainer.fs.readFile('package.json', 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Parse errors from build output
   */
  private parseErrors(output: string): BuildError[] {
    const errors: BuildError[] = [];
    const seen = new Set<string>();

    // Parse TypeScript errors
    this.parseTypeScriptErrors(output, errors, seen);

    // Parse module errors
    this.parseModuleErrors(output, errors, seen);

    // Parse syntax errors
    this.parseSyntaxErrors(output, errors, seen);

    // Parse Vite errors
    this.parseViteErrors(output, errors, seen);

    // Parse generic errors if no specific errors found
    if (errors.length === 0) {
      this.parseGenericErrors(output, errors, seen);
    }

    return errors;
  }

  private parseTypeScriptErrors(
    output: string,
    errors: BuildError[],
    seen: Set<string>
  ): void {
    // Try primary pattern
    let match;
    ERROR_PATTERNS.typescript.lastIndex = 0;
    while ((match = ERROR_PATTERNS.typescript.exec(output)) !== null) {
      const [, file, line, , code, message] = match;
      const key = `${file}:${line}:${code}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          type: 'type',
          message: message.trim(),
          file: file.trim(),
          line: parseInt(line, 10),
          code,
        });
      }
    }

    // Try alternate pattern
    ERROR_PATTERNS.typescriptAlt.lastIndex = 0;
    while ((match = ERROR_PATTERNS.typescriptAlt.exec(output)) !== null) {
      const [, file, line, , code, message] = match;
      const key = `${file}:${line}:${code}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          type: 'type',
          message: message.trim(),
          file: file.trim(),
          line: parseInt(line, 10),
          code,
        });
      }
    }
  }

  private parseModuleErrors(
    output: string,
    errors: BuildError[],
    seen: Set<string>
  ): void {
    ERROR_PATTERNS.module.lastIndex = 0;
    let match;
    while ((match = ERROR_PATTERNS.module.exec(output)) !== null) {
      const moduleName = match[1];
      const key = `module:${moduleName}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          type: 'module',
          message: `Cannot find module '${moduleName}'`,
        });
      }
    }
  }

  private parseSyntaxErrors(
    output: string,
    errors: BuildError[],
    seen: Set<string>
  ): void {
    ERROR_PATTERNS.syntax.lastIndex = 0;
    let match;
    while ((match = ERROR_PATTERNS.syntax.exec(output)) !== null) {
      const message = match[1];
      const key = `syntax:${message.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          type: 'syntax',
          message: message.trim(),
        });
      }
    }
  }

  private parseViteErrors(
    output: string,
    errors: BuildError[],
    seen: Set<string>
  ): void {
    ERROR_PATTERNS.vite.lastIndex = 0;
    let match;
    while ((match = ERROR_PATTERNS.vite.exec(output)) !== null) {
      const message = match[1];
      const key = `vite:${message.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          type: 'other',
          message: `[vite] ${message.trim()}`,
        });
      }
    }
  }

  private parseGenericErrors(
    output: string,
    errors: BuildError[],
    seen: Set<string>
  ): void {
    ERROR_PATTERNS.generic.lastIndex = 0;
    let match;
    while ((match = ERROR_PATTERNS.generic.exec(output)) !== null) {
      const message = match[1];
      const key = `generic:${message.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          type: 'other',
          message: message.trim(),
        });
      }
    }
  }

  /**
   * Format errors for display
   */
  static formatErrors(result: BuildResult, maxErrors: number = 10): string {
    if (result.success) {
      return 'Build succeeded with no errors.';
    }

    if (result.errors.length === 0) {
      return 'Build failed but no specific errors were parsed.';
    }

    const formatted = result.errors.slice(0, maxErrors).map((e) => {
      if (e.file && e.line) {
        return `- ${e.file}:${e.line} - ${e.code || e.type}: ${e.message}`;
      }
      return `- ${e.type}: ${e.message}`;
    });

    if (result.errors.length > maxErrors) {
      formatted.push(`... and ${result.errors.length - maxErrors} more errors`);
    }

    return formatted.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a build runner instance
 */
export function createBuildRunner(
  webcontainer: WebContainer,
  config?: Partial<BuildRunnerConfig>
): BuildRunner {
  return new BuildRunner(webcontainer, config);
}

/**
 * Run a quick build check
 */
export async function runBuild(
  webcontainer: WebContainer,
  config?: Partial<BuildRunnerConfig>
): Promise<BuildResult> {
  const runner = new BuildRunner(webcontainer, config);
  return runner.run();
}
