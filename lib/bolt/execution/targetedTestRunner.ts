/**
 * Targeted Test Runner
 *
 * Optimizes test execution by running previously-failed tests first.
 * Provides quick feedback on whether fixes work before running full suite.
 *
 * Strategy:
 * 1. Track which tests failed in previous runs
 * 2. When re-running tests, execute failed tests first
 * 3. If failed tests now pass, run full suite for regression check
 * 4. If failed tests still fail, skip full suite and report immediately
 *
 * Enhanced with WebContainer direct integration and better Jest/Vitest parsing.
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export interface FailedTest {
  /** Test file path */
  testFile: string;
  /** Specific test name/description if available */
  testName?: string;
  /** Error message from failure */
  error: string;
  /** When the failure was recorded */
  timestamp: number;
  /** Number of consecutive failures */
  failureCount: number;
}

export interface TestRunResult {
  /** Whether all tests passed */
  passed: boolean;
  /** Total tests run */
  totalTests: number;
  /** Number of passed tests */
  passedTests: number;
  /** Number of failed tests */
  failedTests: number;
  /** Details of failed tests */
  failures: FailedTest[];
  /** Execution time in ms */
  duration: number;
  /** Raw output from test runner */
  output: string;
}

export interface TargetedTestResult {
  /** Strategy used: 'targeted' | 'full' | 'skip' */
  strategy: 'targeted' | 'full' | 'skip';
  /** Result of targeted test run (if applicable) */
  targetedResult?: TestRunResult;
  /** Result of full test run (if applicable) */
  fullResult?: TestRunResult;
  /** Overall pass status */
  passed: boolean;
  /** Summary message */
  summary: string;
  /** Total execution time */
  totalDuration: number;
}

export interface TargetedTestRunnerConfig {
  /** Function to execute test command (legacy) */
  runCommand?: (command: string) => Promise<{ output: string; exitCode: number }>;
  /** WebContainer instance (preferred) */
  webcontainer?: WebContainer;
  /** Base test command (e.g., 'npm test', 'vitest') */
  testCommand?: string;
  /** How to specify specific test file (e.g., 'vitest {file}', 'jest {file}') */
  testFilePattern?: string;
  /** Maximum failures to track */
  maxTrackedFailures?: number;
  /** Skip full suite if targeted tests still fail */
  skipFullOnFailure?: boolean;
  /** Test framework: 'jest' | 'vitest' | 'auto' */
  framework?: 'jest' | 'vitest' | 'auto';
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: Partial<TargetedTestRunnerConfig> = {
  testCommand: 'npm test',
  testFilePattern: 'npm test -- {file}',
  maxTrackedFailures: 20,
  skipFullOnFailure: true,
};

// =============================================================================
// TARGETED TEST RUNNER CLASS
// =============================================================================

export class TargetedTestRunner {
  private failedTests: Map<string, FailedTest> = new Map();
  private config: Required<Omit<TargetedTestRunnerConfig, 'runCommand' | 'webcontainer'>> & Pick<TargetedTestRunnerConfig, 'runCommand' | 'webcontainer'>;
  private webcontainer: WebContainer | null;
  private lastFullRunPassed = true;
  private detectedFramework: 'jest' | 'vitest' | null = null;

  constructor(config: TargetedTestRunnerConfig) {
    this.webcontainer = config.webcontainer || null;
    this.config = {
      testCommand: config.testCommand || 'npm test',
      testFilePattern: config.testFilePattern || 'npm test -- {file}',
      maxTrackedFailures: config.maxTrackedFailures ?? 20,
      skipFullOnFailure: config.skipFullOnFailure ?? true,
      framework: config.framework || 'auto',
      onProgress: config.onProgress || (() => {}),
      runCommand: config.runCommand,
      webcontainer: config.webcontainer,
    };
  }

  /**
   * Detect test framework from package.json
   */
  async detectFramework(): Promise<'jest' | 'vitest' | null> {
    if (this.detectedFramework) return this.detectedFramework;
    if (this.config.framework !== 'auto') {
      this.detectedFramework = this.config.framework as 'jest' | 'vitest';
      return this.detectedFramework;
    }

    if (!this.webcontainer) return null;

    try {
      const packageJson = await this.webcontainer.fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps.vitest) {
        this.detectedFramework = 'vitest';
      } else if (allDeps.jest) {
        this.detectedFramework = 'jest';
      }

      // Check scripts for test command
      const testScript = pkg.scripts?.test || '';
      if (testScript.includes('vitest')) {
        this.detectedFramework = 'vitest';
      } else if (testScript.includes('jest')) {
        this.detectedFramework = 'jest';
      }

      return this.detectedFramework;
    } catch {
      return null;
    }
  }

  /**
   * Get command for running a specific test file
   */
  getSpecificTestCommand(testFile: string): string[] {
    const framework = this.detectedFramework;

    if (framework === 'vitest') {
      return ['npx', 'vitest', 'run', testFile, '--reporter=verbose'];
    } else if (framework === 'jest') {
      return ['npx', 'jest', testFile, '--verbose', '--no-coverage'];
    }

    // Fallback: use npm test with -- to pass args
    return ['npm', 'test', '--', testFile];
  }

  /**
   * Run command via WebContainer
   */
  private async runViaWebContainer(args: string[]): Promise<{ output: string; exitCode: number }> {
    if (!this.webcontainer) {
      throw new Error('WebContainer not available');
    }

    const [cmd, ...cmdArgs] = args;
    const process = await this.webcontainer.spawn(cmd, cmdArgs);

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

    return { output: rawOutput, exitCode };
  }

  /**
   * Run a command (auto-selects WebContainer or legacy)
   */
  private async runCommand(command: string | string[]): Promise<{ output: string; exitCode: number }> {
    if (this.webcontainer) {
      const args = Array.isArray(command) ? command : command.split(' ');
      return this.runViaWebContainer(args);
    }

    if (this.config.runCommand) {
      const cmdStr = Array.isArray(command) ? command.join(' ') : command;
      return this.config.runCommand(cmdStr);
    }

    throw new Error('No command runner available');
  }

  /**
   * Record a failed test
   */
  recordFailure(testFile: string, error: string, testName?: string): void {
    const key = testName ? `${testFile}::${testName}` : testFile;
    const existing = this.failedTests.get(key);

    this.failedTests.set(key, {
      testFile,
      testName,
      error,
      timestamp: Date.now(),
      failureCount: existing ? existing.failureCount + 1 : 1,
    });

    // Enforce max tracked failures
    this.trimFailures();
  }

  /**
   * Clear a failure (test now passes)
   */
  clearFailure(testFile: string, testName?: string): void {
    const key = testName ? `${testFile}::${testName}` : testFile;
    this.failedTests.delete(key);
  }

  /**
   * Clear all tracked failures
   */
  clearAllFailures(): void {
    this.failedTests.clear();
  }

  /**
   * Get list of failed test files
   */
  getFailedTestFiles(): string[] {
    const files = new Set<string>();
    for (const failure of this.failedTests.values()) {
      files.add(failure.testFile);
    }
    return Array.from(files);
  }

  /**
   * Get all failure details
   */
  getFailures(): FailedTest[] {
    return Array.from(this.failedTests.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Check if there are known failures
   */
  hasKnownFailures(): boolean {
    return this.failedTests.size > 0;
  }

  /**
   * Run tests with targeted strategy
   */
  async runTests(): Promise<TargetedTestResult> {
    const startTime = Date.now();

    // Detect framework first
    await this.detectFramework();

    const failedFiles = this.getFailedTestFiles();

    // If no known failures, run full suite
    if (failedFiles.length === 0) {
      this.config.onProgress?.('Running full test suite...');
      const fullResult = await this.runFullSuite();
      this.updateFailuresFromResult(fullResult);

      return {
        strategy: 'full',
        fullResult,
        passed: fullResult.passed,
        summary: fullResult.passed
          ? `All ${fullResult.totalTests} tests passed`
          : `${fullResult.failedTests} of ${fullResult.totalTests} tests failed`,
        totalDuration: Date.now() - startTime,
      };
    }

    // Run targeted tests first
    this.config.onProgress?.(`Running ${failedFiles.length} previously-failed test file(s) first...`);
    const targetedResult = await this.runTargetedTests(failedFiles);

    // If targeted tests still fail, optionally skip full suite
    if (!targetedResult.passed && this.config.skipFullOnFailure) {
      this.updateFailuresFromResult(targetedResult);

      return {
        strategy: 'targeted',
        targetedResult,
        passed: false,
        summary: `Targeted tests still failing: ${targetedResult.failedTests} failure(s). Fix these before running full suite.`,
        totalDuration: Date.now() - startTime,
      };
    }

    // Targeted tests passed (or we're running full anyway)
    // Clear the fixed failures
    if (targetedResult.passed) {
      for (const file of failedFiles) {
        this.failedTests.delete(file);
      }
      this.config.onProgress?.('Previously-failed tests now pass! Running full suite...');
    }

    // Run full suite
    const fullResult = await this.runFullSuite();
    this.updateFailuresFromResult(fullResult);

    return {
      strategy: targetedResult.passed ? 'targeted' : 'full',
      targetedResult,
      fullResult,
      passed: fullResult.passed,
      summary: fullResult.passed
        ? `All tests pass! (${failedFiles.length} previously-failed now fixed)`
        : `${fullResult.failedTests} test(s) failed in full suite`,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Run only specific test files
   */
  async runTargetedTests(testFiles: string[]): Promise<TestRunResult> {
    const startTime = Date.now();
    let totalOutput = '';
    let totalPassed = 0;
    let totalFailed = 0;
    const failures: FailedTest[] = [];

    for (const file of testFiles) {
      // Use framework-specific command if WebContainer available
      const command = this.webcontainer
        ? this.getSpecificTestCommand(file)
        : this.config.testFilePattern.replace('{file}', file);

      this.config.onProgress?.(`  Testing: ${file}`);

      const { output, exitCode } = await this.runCommand(command);
      totalOutput += `\n--- ${file} ---\n${output}`;

      if (exitCode === 0) {
        totalPassed++;
      } else {
        totalFailed++;
        failures.push({
          testFile: file,
          error: this.extractErrorFromOutput(output),
          timestamp: Date.now(),
          failureCount: 1,
        });
      }
    }

    return {
      passed: totalFailed === 0,
      totalTests: testFiles.length,
      passedTests: totalPassed,
      failedTests: totalFailed,
      failures,
      duration: Date.now() - startTime,
      output: totalOutput,
    };
  }

  /**
   * Run a single specific test file
   */
  async runSpecificTest(testFile: string): Promise<TestRunResult> {
    const startTime = Date.now();
    const command = this.webcontainer
      ? this.getSpecificTestCommand(testFile)
      : this.config.testFilePattern.replace('{file}', testFile);

    this.config.onProgress?.(`Testing: ${testFile}`);

    const { output, exitCode } = await this.runCommand(command);
    const stats = this.parseTestOutput(output);

    const failures: FailedTest[] = exitCode !== 0 ? [{
      testFile,
      error: this.extractErrorFromOutput(output),
      timestamp: Date.now(),
      failureCount: 1,
    }] : [];

    return {
      passed: exitCode === 0,
      totalTests: stats.total || 1,
      passedTests: stats.passed || (exitCode === 0 ? 1 : 0),
      failedTests: stats.failed || (exitCode !== 0 ? 1 : 0),
      failures,
      duration: Date.now() - startTime,
      output,
    };
  }

  /**
   * Run the full test suite
   */
  async runFullSuite(): Promise<TestRunResult> {
    const startTime = Date.now();

    // Use framework-specific command if possible
    let command: string | string[];
    if (this.webcontainer && this.detectedFramework) {
      if (this.detectedFramework === 'vitest') {
        command = ['npx', 'vitest', 'run', '--reporter=verbose'];
      } else if (this.detectedFramework === 'jest') {
        command = ['npx', 'jest', '--verbose', '--no-coverage'];
      } else {
        command = this.config.testCommand;
      }
    } else {
      command = this.config.testCommand;
    }

    const { output, exitCode } = await this.runCommand(command);

    // Parse test output (basic parsing - can be enhanced for specific test runners)
    const stats = this.parseTestOutput(output);

    this.lastFullRunPassed = exitCode === 0;

    return {
      passed: exitCode === 0,
      totalTests: stats.total,
      passedTests: stats.passed,
      failedTests: stats.failed,
      failures: stats.failures,
      duration: Date.now() - startTime,
      output,
    };
  }

  /**
   * Parse test output to extract statistics
   * This is a basic implementation - can be enhanced for specific test runners
   */
  private parseTestOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    failures: FailedTest[];
  } {
    const failures: FailedTest[] = [];

    // Try to parse common test runner output formats

    // Vitest format: "Tests  2 passed | 1 failed (3)"
    const vitestMatch = output.match(/Tests\s+(\d+)\s+passed\s*\|\s*(\d+)\s+failed\s*\((\d+)\)/i);
    if (vitestMatch) {
      return {
        passed: parseInt(vitestMatch[1]),
        failed: parseInt(vitestMatch[2]),
        total: parseInt(vitestMatch[3]),
        failures,
      };
    }

    // Jest format: "Tests: 1 failed, 2 passed, 3 total"
    const jestMatch = output.match(/Tests:\s*(\d+)\s+failed,\s*(\d+)\s+passed,\s*(\d+)\s+total/i);
    if (jestMatch) {
      return {
        failed: parseInt(jestMatch[1]),
        passed: parseInt(jestMatch[2]),
        total: parseInt(jestMatch[3]),
        failures,
      };
    }

    // Fallback: count "PASS" and "FAIL" occurrences
    const passCount = (output.match(/✓|PASS|passed/gi) || []).length;
    const failCount = (output.match(/✗|✕|FAIL|failed/gi) || []).length;

    return {
      total: passCount + failCount,
      passed: passCount,
      failed: failCount,
      failures,
    };
  }

  /**
   * Extract error message from test output
   */
  private extractErrorFromOutput(output: string): string {
    // Look for common error patterns
    const errorPatterns = [
      /Error:\s*(.+?)(?:\n|$)/,
      /AssertionError:\s*(.+?)(?:\n|$)/,
      /expect\(.+?\)\.(.+?)(?:\n|$)/,
    ];

    for (const pattern of errorPatterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1].trim().slice(0, 200);
      }
    }

    // Fallback: first non-empty line that looks like an error
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('Error') || line.includes('fail') || line.includes('FAIL')) {
        return line.trim().slice(0, 200);
      }
    }

    return 'Test failed (see output for details)';
  }

  /**
   * Update failure tracking from test result
   */
  private updateFailuresFromResult(result: TestRunResult): void {
    // Clear failures for tests that passed
    if (result.passed) {
      // All tests passed, clear everything
      this.failedTests.clear();
    } else {
      // Update/add failures from result
      for (const failure of result.failures) {
        this.recordFailure(failure.testFile, failure.error, failure.testName);
      }
    }
  }

  /**
   * Trim old failures to stay under limit
   */
  private trimFailures(): void {
    if (this.failedTests.size <= this.config.maxTrackedFailures) {
      return;
    }

    // Sort by timestamp, oldest first
    const sorted = Array.from(this.failedTests.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest
    while (sorted.length > this.config.maxTrackedFailures) {
      const [key] = sorted.shift()!;
      this.failedTests.delete(key);
    }
  }

  /**
   * Format failure summary for display
   */
  formatFailures(): string {
    const failures = this.getFailures();
    if (failures.length === 0) {
      return 'No known test failures.';
    }

    const lines = ['## Known Test Failures', ''];
    for (const failure of failures.slice(0, 10)) {
      const name = failure.testName ? `${failure.testFile}::${failure.testName}` : failure.testFile;
      lines.push(`- **${name}** (failed ${failure.failureCount}x)`);
      lines.push(`  - ${failure.error}`);
    }

    if (failures.length > 10) {
      lines.push(`- ... and ${failures.length - 10} more`);
    }

    return lines.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a targeted test runner instance
 */
export function createTargetedTestRunner(
  config: TargetedTestRunnerConfig
): TargetedTestRunner {
  return new TargetedTestRunner(config);
}

/**
 * Create a targeted test runner with WebContainer
 */
export function createTargetedTestRunnerWithWebContainer(
  webcontainer: WebContainer,
  onProgress?: (message: string) => void
): TargetedTestRunner {
  return new TargetedTestRunner({
    webcontainer,
    onProgress,
  });
}

/**
 * Quick run tests via WebContainer
 */
export async function runTests(webcontainer: WebContainer): Promise<TargetedTestResult> {
  const runner = new TargetedTestRunner({ webcontainer });
  return runner.runTests();
}

/**
 * Run a specific test file via WebContainer
 */
export async function runSpecificTest(
  webcontainer: WebContainer,
  testFile: string
): Promise<TestRunResult> {
  const runner = new TargetedTestRunner({ webcontainer });
  await runner.detectFramework();
  return runner.runSpecificTest(testFile);
}
