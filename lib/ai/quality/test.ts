/**
 * Test Gate
 *
 * Test execution and result parsing.
 */

/**
 * Test status
 */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

/**
 * Individual test result
 */
export interface TestCase {
  name: string;
  suite: string;
  status: TestStatus;
  duration: number;
  error?: string;
  stack?: string;
}

/**
 * Test suite result
 */
export interface TestSuite {
  name: string;
  tests: TestCase[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

/**
 * Overall test result
 */
export interface TestResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  suites: TestSuite[];
  coverage?: CoverageResult;
  duration: number;
}

/**
 * Coverage result
 */
export interface CoverageResult {
  lines: { covered: number; total: number; percentage: number };
  branches: { covered: number; total: number; percentage: number };
  functions: { covered: number; total: number; percentage: number };
  statements: { covered: number; total: number; percentage: number };
}

/**
 * Test configuration
 */
export interface TestConfig {
  minCoverage: number;
  timeout: number;
  bail: boolean;
  include: string[];
  exclude: string[];
}

/**
 * Default test configuration
 */
const DEFAULT_TEST_CONFIG: TestConfig = {
  minCoverage: 70,
  timeout: 30000,
  bail: false,
  include: ['**/*.test.ts', '**/*.spec.ts'],
  exclude: ['node_modules/**', 'dist/**'],
};

/**
 * Run test gate
 * In production, this would execute actual tests via Vitest/Jest
 */
export function runTestGate(
  testFiles: { path: string; content: string }[],
  config: Partial<TestConfig> = {}
): TestResult {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_TEST_CONFIG, ...config };
  const suites: TestSuite[] = [];

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const file of testFiles) {
    // Parse test file and extract test cases
    const suite = parseTestFile(file.path, file.content);
    suites.push(suite);

    totalPassed += suite.passed;
    totalFailed += suite.failed;
    totalSkipped += suite.skipped;
  }

  const totalTests = totalPassed + totalFailed + totalSkipped;

  return {
    passed: totalFailed === 0,
    totalTests,
    passedTests: totalPassed,
    failedTests: totalFailed,
    skippedTests: totalSkipped,
    suites,
    duration: Date.now() - startTime,
  };
}

/**
 * Parse a test file to extract test structure
 */
function parseTestFile(filePath: string, content: string): TestSuite {
  const tests: TestCase[] = [];
  const lines = content.split('\n');

  let currentDescribe = filePath;
  const describeStack: string[] = [];

  for (const line of lines) {
    // Match describe blocks
    const describeMatch = line.match(/describe\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (describeMatch) {
      describeStack.push(describeMatch[1]);
      currentDescribe = describeStack.join(' > ');
    }

    // Match test/it blocks
    const testMatch = line.match(/(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (testMatch) {
      const testName = testMatch[1];

      // Determine test status (simulated)
      const status = simulateTestStatus(testName, content);

      tests.push({
        name: testName,
        suite: currentDescribe,
        status,
        duration: Math.random() * 100, // Simulated duration
        error: status === 'failed' ? 'Assertion failed' : undefined,
      });
    }

    // Match skip
    const skipMatch = line.match(/(?:test|it)\.skip\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (skipMatch) {
      tests.push({
        name: skipMatch[1],
        suite: currentDescribe,
        status: 'skipped',
        duration: 0,
      });
    }

    // Match closing braces (simple heuristic for leaving describe)
    if (line.trim() === '});' && describeStack.length > 0) {
      describeStack.pop();
      currentDescribe = describeStack.length > 0 ? describeStack.join(' > ') : filePath;
    }
  }

  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = tests.filter((t) => t.status === 'failed').length;
  const skipped = tests.filter((t) => t.status === 'skipped').length;

  return {
    name: filePath,
    tests,
    passed,
    failed,
    skipped,
    duration: tests.reduce((sum, t) => sum + t.duration, 0),
  };
}

/**
 * Simulate test status based on content analysis
 */
function simulateTestStatus(testName: string, content: string): TestStatus {
  // Simple heuristics for simulation
  // In production, actual test execution would determine this

  // Tests with "fail" or "error" in name might fail
  if (/fail|error|broken/i.test(testName)) {
    return Math.random() > 0.7 ? 'failed' : 'passed';
  }

  // Tests with "skip" or "todo" might be skipped
  if (/skip|todo|pending/i.test(testName)) {
    return 'skipped';
  }

  // Most tests pass
  return Math.random() > 0.1 ? 'passed' : 'failed';
}

/**
 * Format test results for display
 */
export function formatTestResults(result: TestResult): string {
  const lines: string[] = [];

  lines.push(`Test Results: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push(`  Total: ${result.totalTests}`);
  lines.push(`  Passed: ${result.passedTests}`);
  lines.push(`  Failed: ${result.failedTests}`);
  lines.push(`  Skipped: ${result.skippedTests}`);
  lines.push(`  Duration: ${result.duration}ms`);

  if (result.coverage) {
    lines.push('');
    lines.push('Coverage:');
    lines.push(`  Lines: ${result.coverage.lines.percentage.toFixed(1)}%`);
    lines.push(`  Branches: ${result.coverage.branches.percentage.toFixed(1)}%`);
    lines.push(`  Functions: ${result.coverage.functions.percentage.toFixed(1)}%`);
    lines.push(`  Statements: ${result.coverage.statements.percentage.toFixed(1)}%`);
  }

  if (result.failedTests > 0) {
    lines.push('');
    lines.push('Failed Tests:');

    for (const suite of result.suites) {
      const failedTests = suite.tests.filter((t) => t.status === 'failed');
      if (failedTests.length > 0) {
        lines.push(`  ${suite.name}:`);
        for (const test of failedTests) {
          lines.push(`    ✗ ${test.name}`);
          if (test.error) {
            lines.push(`      Error: ${test.error}`);
          }
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Create a test result from parsed output
 */
export function parseTestOutput(output: string): TestResult {
  // Parse common test runner output formats
  const lines = output.split('\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  for (const line of lines) {
    // Vitest/Jest format: "Tests: X passed, Y failed, Z total"
    const summaryMatch = line.match(
      /Tests?:\s*(\d+)\s*passed.*?(\d+)\s*failed.*?(\d+)\s*total/i
    );
    if (summaryMatch) {
      passedTests = parseInt(summaryMatch[1], 10);
      failedTests = parseInt(summaryMatch[2], 10);
      totalTests = parseInt(summaryMatch[3], 10);
    }

    // Alternative format: "X passing, Y failing"
    const altMatch = line.match(/(\d+)\s*passing.*?(\d+)\s*failing/i);
    if (altMatch) {
      passedTests = parseInt(altMatch[1], 10);
      failedTests = parseInt(altMatch[2], 10);
      totalTests = passedTests + failedTests;
    }
  }

  return {
    passed: failedTests === 0,
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    suites: [],
    duration: 0,
  };
}

/**
 * Check if tests meet coverage requirements
 */
export function checkCoverage(
  coverage: CoverageResult,
  minCoverage: number = 70
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (coverage.lines.percentage < minCoverage) {
    issues.push(
      `Line coverage ${coverage.lines.percentage.toFixed(1)}% is below ${minCoverage}%`
    );
  }

  if (coverage.branches.percentage < minCoverage) {
    issues.push(
      `Branch coverage ${coverage.branches.percentage.toFixed(1)}% is below ${minCoverage}%`
    );
  }

  if (coverage.functions.percentage < minCoverage) {
    issues.push(
      `Function coverage ${coverage.functions.percentage.toFixed(1)}% is below ${minCoverage}%`
    );
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Create mock test result for testing
 */
export function createMockTestResult(
  passed: boolean,
  totalTests: number = 10
): TestResult {
  const passedTests = passed ? totalTests : Math.floor(totalTests * 0.8);
  const failedTests = totalTests - passedTests;

  return {
    passed,
    totalTests,
    passedTests,
    failedTests,
    skippedTests: 0,
    suites: [
      {
        name: 'Mock Suite',
        tests: [],
        passed: passedTests,
        failed: failedTests,
        skipped: 0,
        duration: 1000,
      },
    ],
    duration: 1000,
  };
}
