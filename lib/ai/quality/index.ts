/**
 * Quality Module Index
 *
 * Central export for all quality gate components.
 */

// Lint gate
export {
  runLintGate,
  formatLintResults,
  quickLint,
  type LintSeverity,
  type LintIssue,
  type LintResult,
  type LintConfig,
} from './lint';

// TypeCheck gate
export {
  runTypeCheckGate,
  formatTypeCheckResults,
  quickTypeCheck,
  type TypeCheckError,
  type TypeCheckResult,
  type TypeCheckConfig,
} from './typecheck';

// Test gate
export {
  runTestGate,
  formatTestResults,
  parseTestOutput,
  checkCoverage,
  createMockTestResult,
  type TestStatus,
  type TestCase,
  type TestSuite,
  type TestResult,
  type CoverageResult,
  type TestConfig,
} from './test';

// Quality gate runner
export {
  QualityGateRunner,
  qualityGateRunner,
  runQuickQualityCheck,
  type QualityGateType,
  type GateResult,
  type QualityGateResult,
  type QualityGateConfig,
} from './runner';
