/**
 * Quality Gate Runner
 *
 * Runs all quality gates and aggregates results.
 */

import {
  runLintGate,
  formatLintResults,
  type LintResult,
  type LintConfig,
} from './lint';
import {
  runTypeCheckGate,
  formatTypeCheckResults,
  type TypeCheckResult,
  type TypeCheckConfig,
} from './typecheck';
import {
  runTestGate,
  formatTestResults,
  type TestResult,
  type TestConfig,
} from './test';

/**
 * Quality gate types
 */
export type QualityGateType = 'lint' | 'typecheck' | 'test' | 'security' | 'a11y';

/**
 * Individual gate result
 */
export interface GateResult {
  gate: QualityGateType;
  passed: boolean;
  details: string;
  duration: number;
  blocking: boolean;
}

/**
 * Overall quality gate result
 */
export interface QualityGateResult {
  passed: boolean;
  gates: GateResult[];
  totalDuration: number;
  passedGates: number;
  failedGates: number;
  blockedBy: QualityGateType[];
}

/**
 * Quality gate configuration
 */
export interface QualityGateConfig {
  lint: {
    enabled: boolean;
    blocking: boolean;
    config?: Partial<LintConfig>;
  };
  typecheck: {
    enabled: boolean;
    blocking: boolean;
    config?: Partial<TypeCheckConfig>;
  };
  test: {
    enabled: boolean;
    blocking: boolean;
    config?: Partial<TestConfig>;
  };
  security: {
    enabled: boolean;
    blocking: boolean;
  };
  a11y: {
    enabled: boolean;
    blocking: boolean;
  };
}

/**
 * Default quality gate configuration
 */
const DEFAULT_QUALITY_CONFIG: QualityGateConfig = {
  lint: { enabled: true, blocking: true },
  typecheck: { enabled: true, blocking: true },
  test: { enabled: true, blocking: true },
  security: { enabled: true, blocking: true },
  a11y: { enabled: true, blocking: false },
};

/**
 * Quality Gate Runner class
 */
export class QualityGateRunner {
  private config: QualityGateConfig;
  private results: Map<QualityGateType, GateResult> = new Map();

  constructor(config: Partial<QualityGateConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_QUALITY_CONFIG, config);
  }

  /**
   * Run all enabled quality gates
   */
  async runAll(
    files: { path: string; content: string }[],
    testFiles: { path: string; content: string }[] = []
  ): Promise<QualityGateResult> {
    const startTime = Date.now();
    const gates: GateResult[] = [];
    const blockedBy: QualityGateType[] = [];

    // Run lint gate
    if (this.config.lint.enabled) {
      const result = await this.runLint(files);
      gates.push(result);
      this.results.set('lint', result);
      if (!result.passed && result.blocking) {
        blockedBy.push('lint');
      }
    }

    // Run typecheck gate
    if (this.config.typecheck.enabled) {
      const result = await this.runTypeCheck(files);
      gates.push(result);
      this.results.set('typecheck', result);
      if (!result.passed && result.blocking) {
        blockedBy.push('typecheck');
      }
    }

    // Run test gate
    if (this.config.test.enabled && testFiles.length > 0) {
      const result = await this.runTests(testFiles);
      gates.push(result);
      this.results.set('test', result);
      if (!result.passed && result.blocking) {
        blockedBy.push('test');
      }
    }

    // Run security gate
    if (this.config.security.enabled) {
      const result = await this.runSecurity(files);
      gates.push(result);
      this.results.set('security', result);
      if (!result.passed && result.blocking) {
        blockedBy.push('security');
      }
    }

    // Run a11y gate (for UI files)
    if (this.config.a11y.enabled) {
      const uiFiles = files.filter(
        (f) => f.path.endsWith('.tsx') || f.path.endsWith('.jsx')
      );
      if (uiFiles.length > 0) {
        const result = await this.runA11y(uiFiles);
        gates.push(result);
        this.results.set('a11y', result);
        if (!result.passed && result.blocking) {
          blockedBy.push('a11y');
        }
      }
    }

    const passedGates = gates.filter((g) => g.passed).length;
    const failedGates = gates.filter((g) => !g.passed).length;

    return {
      passed: blockedBy.length === 0,
      gates,
      totalDuration: Date.now() - startTime,
      passedGates,
      failedGates,
      blockedBy,
    };
  }

  /**
   * Run lint gate
   */
  private async runLint(
    files: { path: string; content: string }[]
  ): Promise<GateResult> {
    const startTime = Date.now();
    const result = runLintGate(files, this.config.lint.config);

    return {
      gate: 'lint',
      passed: result.passed,
      details: formatLintResults(result),
      duration: Date.now() - startTime,
      blocking: this.config.lint.blocking,
    };
  }

  /**
   * Run typecheck gate
   */
  private async runTypeCheck(
    files: { path: string; content: string }[]
  ): Promise<GateResult> {
    const startTime = Date.now();
    const result = runTypeCheckGate(files, this.config.typecheck.config);

    return {
      gate: 'typecheck',
      passed: result.passed,
      details: formatTypeCheckResults(result),
      duration: Date.now() - startTime,
      blocking: this.config.typecheck.blocking,
    };
  }

  /**
   * Run test gate
   */
  private async runTests(
    testFiles: { path: string; content: string }[]
  ): Promise<GateResult> {
    const startTime = Date.now();
    const result = runTestGate(testFiles, this.config.test.config);

    return {
      gate: 'test',
      passed: result.passed,
      details: formatTestResults(result),
      duration: Date.now() - startTime,
      blocking: this.config.test.blocking,
    };
  }

  /**
   * Run security gate
   */
  private async runSecurity(
    files: { path: string; content: string }[]
  ): Promise<GateResult> {
    const startTime = Date.now();
    const issues: string[] = [];

    // Security patterns to check
    const securityPatterns = [
      { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/, message: 'Hardcoded API key detected' },
      { pattern: /password\s*[:=]\s*['"][^'"]+['"]/, message: 'Hardcoded password detected' },
      { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/, message: 'Hardcoded secret detected' },
      { pattern: /eval\s*\(/, message: 'eval() usage detected' },
      { pattern: /dangerouslySetInnerHTML/, message: 'dangerouslySetInnerHTML usage' },
      { pattern: /innerHTML\s*=/, message: 'innerHTML assignment detected' },
    ];

    for (const file of files) {
      for (const check of securityPatterns) {
        if (check.pattern.test(file.content)) {
          issues.push(`${file.path}: ${check.message}`);
        }
      }
    }

    const passed = issues.length === 0;

    return {
      gate: 'security',
      passed,
      details: passed
        ? 'Security scan: ✓ PASSED'
        : `Security scan: ✗ FAILED\n  Issues:\n${issues.map((i) => `    - ${i}`).join('\n')}`,
      duration: Date.now() - startTime,
      blocking: this.config.security.blocking,
    };
  }

  /**
   * Run accessibility gate
   */
  private async runA11y(
    files: { path: string; content: string }[]
  ): Promise<GateResult> {
    const startTime = Date.now();
    const issues: string[] = [];

    // A11y patterns to check
    const a11yPatterns = [
      { pattern: /<img(?![^>]*alt=)/, message: 'Image without alt attribute' },
      { pattern: /onClick\s*=(?![^>]*(?:role|button|link))/, message: 'Click handler without role' },
      { pattern: /<a(?![^>]*href)/, message: 'Anchor without href' },
      { pattern: /tabIndex\s*=\s*['"]?-1['"]?/, message: 'Negative tabindex found' },
    ];

    for (const file of files) {
      for (const check of a11yPatterns) {
        if (check.pattern.test(file.content)) {
          issues.push(`${file.path}: ${check.message}`);
        }
      }
    }

    const passed = issues.length === 0;

    return {
      gate: 'a11y',
      passed,
      details: passed
        ? 'Accessibility scan: ✓ PASSED'
        : `Accessibility scan: ✗ FAILED\n  Issues:\n${issues.map((i) => `    - ${i}`).join('\n')}`,
      duration: Date.now() - startTime,
      blocking: this.config.a11y.blocking,
    };
  }

  /**
   * Get result for a specific gate
   */
  getGateResult(gate: QualityGateType): GateResult | undefined {
    return this.results.get(gate);
  }

  /**
   * Format overall results
   */
  static formatResults(result: QualityGateResult): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════');
    lines.push(`Quality Gates: ${result.passed ? '✓ ALL PASSED' : '✗ FAILED'}`);
    lines.push('═══════════════════════════════════════');
    lines.push(`  Passed: ${result.passedGates}/${result.gates.length}`);
    lines.push(`  Failed: ${result.failedGates}/${result.gates.length}`);
    lines.push(`  Duration: ${result.totalDuration}ms`);

    if (result.blockedBy.length > 0) {
      lines.push(`  Blocked by: ${result.blockedBy.join(', ')}`);
    }

    lines.push('');

    for (const gate of result.gates) {
      const icon = gate.passed ? '✓' : '✗';
      const blocking = gate.blocking ? '[BLOCKING]' : '[NON-BLOCKING]';
      lines.push(`${icon} ${gate.gate.toUpperCase()} ${blocking} (${gate.duration}ms)`);
    }

    return lines.join('\n');
  }

  /**
   * Merge configuration
   */
  private mergeConfig(
    defaults: QualityGateConfig,
    overrides: Partial<QualityGateConfig>
  ): QualityGateConfig {
    return {
      lint: { ...defaults.lint, ...overrides.lint },
      typecheck: { ...defaults.typecheck, ...overrides.typecheck },
      test: { ...defaults.test, ...overrides.test },
      security: { ...defaults.security, ...overrides.security },
      a11y: { ...defaults.a11y, ...overrides.a11y },
    };
  }
}

// Singleton instance
export const qualityGateRunner = new QualityGateRunner();

/**
 * Quick quality check
 */
export async function runQuickQualityCheck(
  files: { path: string; content: string }[]
): Promise<{ passed: boolean; summary: string }> {
  const runner = new QualityGateRunner({
    test: { enabled: false, blocking: false },
    a11y: { enabled: false, blocking: false },
  });

  const result = await runner.runAll(files);

  return {
    passed: result.passed,
    summary: QualityGateRunner.formatResults(result),
  };
}
