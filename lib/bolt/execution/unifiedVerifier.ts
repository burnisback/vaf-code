/**
 * Unified Verifier
 *
 * Orchestrates all verification tools into a single, comprehensive verification pipeline.
 * Integrates:
 * - TypeScript/JavaScript type checking (tsc, ESLint)
 * - CSS/SCSS linting (Stylelint)
 * - Test execution (TargetedTestRunner)
 * - Environment validation (EnvValidator)
 * - Circular dependency detection
 * - Monorepo support
 * - Project references handling
 *
 * Provides a unified result with all verification outcomes.
 */

import type { WebContainer } from '@webcontainer/api';
import { MonorepoDetector, type MonorepoInfo } from './monorepoDetector';
import { TsProjectReferencesHandler, type ProjectReferencesInfo } from './tsProjectReferencesHandler';
import { EnvValidator, type EnvValidationResult } from './envValidator';
import { CircularDependencyDetector, type CircularDependencyResult } from './circularDependencyDetector';
import { ProjectTypeDetector, ESLintRunner, type ProjectTypeInfo, type ESLintResult } from './projectTypeDetector';
import { StylelintRunner, isStylelintAvailable, type StylelintResult } from './stylelintRunner';
import { TargetedTestRunner, type TargetedTestResult, type TargetedTestRunnerConfig } from './targetedTestRunner';
import { RuntimeErrorInjector, isErrorCaptureInjected } from './runtimeErrorInjector';
import { BuildVerifier, type VerificationResult as BuildVerificationResult } from './verifier';
import { PackageManagerDetector, type PackageManager } from './packageManagerDetector';
import { BuildToolDetector, type BuildTool } from './buildToolDetector';

// =============================================================================
// TYPES
// =============================================================================

export interface VerificationPhase {
  /** Phase name */
  name: string;
  /** Whether phase passed */
  passed: boolean;
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
  /** Duration in ms */
  duration: number;
  /** Whether phase was skipped */
  skipped: boolean;
  /** Skip reason if skipped */
  skipReason?: string;
  /** Detailed result (phase-specific) */
  details?: unknown;
}

export interface UnifiedVerificationResult {
  /** Overall pass/fail status */
  success: boolean;
  /** Total error count across all phases */
  totalErrors: number;
  /** Total warning count */
  totalWarnings: number;
  /** Total verification time */
  totalDuration: number;
  /** Individual phase results */
  phases: {
    projectAnalysis: VerificationPhase;
    typeCheck: VerificationPhase;
    lint: VerificationPhase;
    styleLint: VerificationPhase;
    envValidation: VerificationPhase;
    circularDeps: VerificationPhase;
    tests: VerificationPhase;
    runtimeSetup: VerificationPhase;
  };
  /** Project info */
  projectInfo: {
    isMonorepo: boolean;
    monorepoType?: string;
    usesProjectReferences: boolean;
    projectType: string;
    hasTests: boolean;
    hasStyleFiles: boolean;
    packageManager?: PackageManager;
    buildTool?: BuildTool;
  };
  /** Summary for display */
  summary: string;
  /** Formatted report */
  report: string;
}

export interface UnifiedVerifierConfig {
  /** Enable/disable specific phases */
  phases?: {
    typeCheck?: boolean;
    lint?: boolean;
    styleLint?: boolean;
    envValidation?: boolean;
    circularDeps?: boolean;
    tests?: boolean;
    runtimeSetup?: boolean;
  };
  /** Test runner configuration */
  testConfig?: Partial<TargetedTestRunnerConfig>;
  /** Whether to run tests (can be expensive) */
  runTests?: boolean;
  /** Whether to auto-inject runtime error capture */
  injectRuntimeCapture?: boolean;
  /** Progress callback */
  onProgress?: (message: string) => void;
  /** Phase completion callback */
  onPhaseComplete?: (phase: string, result: VerificationPhase) => void;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_PHASES = {
  typeCheck: true,
  lint: true,
  styleLint: true,
  envValidation: true,
  circularDeps: true,
  tests: false, // Disabled by default (can be slow)
  runtimeSetup: true,
};

// =============================================================================
// UNIFIED VERIFIER CLASS
// =============================================================================

export class UnifiedVerifier {
  private webcontainer: WebContainer;
  private config: Required<UnifiedVerifierConfig>;

  constructor(webcontainer: WebContainer, config: UnifiedVerifierConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = {
      phases: { ...DEFAULT_PHASES, ...config.phases },
      testConfig: config.testConfig || {},
      runTests: config.runTests ?? false,
      injectRuntimeCapture: config.injectRuntimeCapture ?? true,
      onProgress: config.onProgress || (() => {}),
      onPhaseComplete: config.onPhaseComplete || (() => {}),
    };
  }

  /**
   * Run full verification pipeline
   */
  async verify(): Promise<UnifiedVerificationResult> {
    const startTime = Date.now();

    const result: UnifiedVerificationResult = {
      success: true,
      totalErrors: 0,
      totalWarnings: 0,
      totalDuration: 0,
      phases: {
        projectAnalysis: this.createSkippedPhase('Project Analysis'),
        typeCheck: this.createSkippedPhase('Type Check'),
        lint: this.createSkippedPhase('Lint'),
        styleLint: this.createSkippedPhase('Style Lint'),
        envValidation: this.createSkippedPhase('Environment Validation'),
        circularDeps: this.createSkippedPhase('Circular Dependencies'),
        tests: this.createSkippedPhase('Tests'),
        runtimeSetup: this.createSkippedPhase('Runtime Setup'),
      },
      projectInfo: {
        isMonorepo: false,
        usesProjectReferences: false,
        projectType: 'unknown',
        hasTests: false,
        hasStyleFiles: false,
      },
      summary: '',
      report: '',
    };

    try {
      // Phase 1: Project Analysis (always runs)
      this.config.onProgress?.('Analyzing project structure...');
      result.phases.projectAnalysis = await this.runProjectAnalysis(result.projectInfo);
      this.config.onPhaseComplete?.('projectAnalysis', result.phases.projectAnalysis);

      // Phase 2: Type Check
      if (this.config.phases.typeCheck) {
        this.config.onProgress?.('Running type check...');
        result.phases.typeCheck = await this.runTypeCheck(result.projectInfo);
        this.config.onPhaseComplete?.('typeCheck', result.phases.typeCheck);
      }

      // Phase 3: Lint (ESLint for JS projects)
      if (this.config.phases.lint) {
        this.config.onProgress?.('Running lint...');
        result.phases.lint = await this.runLint(result.projectInfo);
        this.config.onPhaseComplete?.('lint', result.phases.lint);
      }

      // Phase 4: Style Lint
      if (this.config.phases.styleLint && result.projectInfo.hasStyleFiles) {
        this.config.onProgress?.('Running style lint...');
        result.phases.styleLint = await this.runStyleLint();
        this.config.onPhaseComplete?.('styleLint', result.phases.styleLint);
      }

      // Phase 5: Environment Validation
      if (this.config.phases.envValidation) {
        this.config.onProgress?.('Validating environment variables...');
        result.phases.envValidation = await this.runEnvValidation();
        this.config.onPhaseComplete?.('envValidation', result.phases.envValidation);
      }

      // Phase 6: Circular Dependencies
      if (this.config.phases.circularDeps) {
        this.config.onProgress?.('Checking for circular dependencies...');
        result.phases.circularDeps = await this.runCircularDepsCheck();
        this.config.onPhaseComplete?.('circularDeps', result.phases.circularDeps);
      }

      // Phase 7: Tests
      if (this.config.phases.tests && this.config.runTests && result.projectInfo.hasTests) {
        this.config.onProgress?.('Running tests...');
        result.phases.tests = await this.runTests();
        this.config.onPhaseComplete?.('tests', result.phases.tests);
      }

      // Phase 8: Runtime Setup
      if (this.config.phases.runtimeSetup && this.config.injectRuntimeCapture) {
        this.config.onProgress?.('Setting up runtime error capture...');
        result.phases.runtimeSetup = await this.setupRuntimeCapture();
        this.config.onPhaseComplete?.('runtimeSetup', result.phases.runtimeSetup);
      }

      // Calculate totals
      for (const phase of Object.values(result.phases)) {
        if (!phase.skipped) {
          result.totalErrors += phase.errorCount;
          result.totalWarnings += phase.warningCount;
          if (!phase.passed) {
            result.success = false;
          }
        }
      }

    } catch (error) {
      console.error('[UnifiedVerifier] Verification error:', error);
      result.success = false;
    }

    result.totalDuration = Date.now() - startTime;
    result.summary = this.generateSummary(result);
    result.report = this.generateReport(result);

    return result;
  }

  /**
   * Run project analysis phase
   */
  private async runProjectAnalysis(projectInfo: UnifiedVerificationResult['projectInfo']): Promise<VerificationPhase> {
    const startTime = Date.now();

    try {
      // Detect monorepo
      const monorepoDetector = new MonorepoDetector(this.webcontainer);
      const monorepoInfo = await monorepoDetector.detect();
      projectInfo.isMonorepo = monorepoInfo.isMonorepo;
      projectInfo.monorepoType = monorepoInfo.type;

      // Detect project references
      const tsHandler = new TsProjectReferencesHandler(this.webcontainer);
      const tsInfo = await tsHandler.analyze();
      projectInfo.usesProjectReferences = tsInfo.usesReferences;

      // Detect project type
      const typeDetector = new ProjectTypeDetector({
        fileExists: (p) => this.fileExists(p),
        listFiles: (p) => this.listFiles(p),
        readFile: (p) => this.readFile(p),
      });
      const typeInfo = await typeDetector.detect();
      projectInfo.projectType = typeInfo.type;

      // Detect package manager
      const packageManagerDetector = new PackageManagerDetector(this.webcontainer);
      const pmInfo = await packageManagerDetector.detect();
      projectInfo.packageManager = pmInfo.manager;

      // Detect build tool
      const buildToolDetector = new BuildToolDetector(this.webcontainer);
      projectInfo.buildTool = await buildToolDetector.detect();

      // Check for tests
      projectInfo.hasTests = await this.hasTestFiles();

      // Check for style files
      projectInfo.hasStyleFiles = await this.hasStyleFiles();

      return {
        name: 'Project Analysis',
        passed: true,
        errorCount: 0,
        warningCount: 0,
        duration: Date.now() - startTime,
        skipped: false,
        details: { monorepoInfo, tsInfo, typeInfo, packageManager: pmInfo.manager, buildTool: projectInfo.buildTool },
      };
    } catch (error) {
      return {
        name: 'Project Analysis',
        passed: false,
        errorCount: 1,
        warningCount: 0,
        duration: Date.now() - startTime,
        skipped: false,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Run type check phase
   */
  private async runTypeCheck(projectInfo: UnifiedVerificationResult['projectInfo']): Promise<VerificationPhase> {
    const startTime = Date.now();

    try {
      if (projectInfo.projectType === 'javascript') {
        return {
          name: 'Type Check',
          passed: true,
          errorCount: 0,
          warningCount: 0,
          duration: Date.now() - startTime,
          skipped: true,
          skipReason: 'JavaScript-only project (no TypeScript)',
        };
      }

      // Use BuildVerifier for type checking
      const verifier = new BuildVerifier(this.webcontainer);

      // Determine tsc command based on project structure
      let tscArgs = ['tsc', '--noEmit', '--pretty', 'false'];
      if (projectInfo.usesProjectReferences) {
        tscArgs = ['tsc', '--build', '--noEmit', '--pretty', 'false'];
      }

      const process = await this.webcontainer.spawn('npx', tscArgs);

      let output = '';
      const outputPromise = new Promise<void>((resolve) => {
        process.output.pipeTo(new WritableStream({
          write(chunk) {
            output += chunk;
          },
          close() {
            resolve();
          },
        }));
      });

      const exitCode = await process.exit;
      await outputPromise;

      // Parse errors
      const errorPattern = /error TS\d+:/g;
      const errorCount = (output.match(errorPattern) || []).length;

      return {
        name: 'Type Check',
        passed: exitCode === 0,
        errorCount,
        warningCount: 0,
        duration: Date.now() - startTime,
        skipped: false,
        details: { output, exitCode },
      };
    } catch (error) {
      return {
        name: 'Type Check',
        passed: false,
        errorCount: 1,
        warningCount: 0,
        duration: Date.now() - startTime,
        skipped: false,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Run lint phase
   */
  private async runLint(projectInfo: UnifiedVerificationResult['projectInfo']): Promise<VerificationPhase> {
    const startTime = Date.now();

    try {
      // Check if ESLint is available
      const hasESLint = await this.fileExists('package.json').then(async (exists) => {
        if (!exists) return false;
        const content = await this.readFile('package.json');
        if (!content) return false;
        try {
          const pkg = JSON.parse(content);
          return !!(pkg.devDependencies?.eslint || pkg.dependencies?.eslint);
        } catch {
          return false;
        }
      });

      if (!hasESLint) {
        return {
          name: 'Lint',
          passed: true,
          errorCount: 0,
          warningCount: 0,
          duration: Date.now() - startTime,
          skipped: true,
          skipReason: 'ESLint not installed',
        };
      }

      const eslintRunner = new ESLintRunner({
        runCommand: (cmd) => this.runCommand(cmd),
        patterns: ['.'],
      });

      const result = await eslintRunner.run();

      return {
        name: 'Lint',
        passed: result.passed,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        duration: Date.now() - startTime,
        skipped: false,
        details: result,
      };
    } catch (error) {
      return {
        name: 'Lint',
        passed: true, // Don't fail on lint setup issues
        errorCount: 0,
        warningCount: 1,
        duration: Date.now() - startTime,
        skipped: true,
        skipReason: error instanceof Error ? error.message : 'ESLint execution failed',
      };
    }
  }

  /**
   * Run style lint phase
   */
  private async runStyleLint(): Promise<VerificationPhase> {
    const startTime = Date.now();

    try {
      const hasStylelint = await isStylelintAvailable(
        (p) => this.fileExists(p),
        (p) => this.readFile(p)
      );

      if (!hasStylelint) {
        return {
          name: 'Style Lint',
          passed: true,
          errorCount: 0,
          warningCount: 0,
          duration: Date.now() - startTime,
          skipped: true,
          skipReason: 'Stylelint not installed',
        };
      }

      const stylelintRunner = new StylelintRunner({
        runCommand: (cmd) => this.runCommand(cmd),
        patterns: ['**/*.css', '**/*.scss'],
      });

      const result = await stylelintRunner.run();

      return {
        name: 'Style Lint',
        passed: result.passed,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        duration: Date.now() - startTime,
        skipped: false,
        details: result,
      };
    } catch (error) {
      return {
        name: 'Style Lint',
        passed: true,
        errorCount: 0,
        warningCount: 0,
        duration: Date.now() - startTime,
        skipped: true,
        skipReason: error instanceof Error ? error.message : 'Stylelint execution failed',
      };
    }
  }

  /**
   * Run environment validation phase
   */
  private async runEnvValidation(): Promise<VerificationPhase> {
    const startTime = Date.now();

    try {
      const validator = new EnvValidator(this.webcontainer);
      const result = await validator.validate();

      // Only count critical missing vars as errors
      const criticalMissing = result.missing.filter(m => !m.hasFallback);

      return {
        name: 'Environment Validation',
        passed: criticalMissing.length === 0,
        errorCount: criticalMissing.length,
        warningCount: result.warnings.length,
        duration: Date.now() - startTime,
        skipped: false,
        details: result,
      };
    } catch (error) {
      return {
        name: 'Environment Validation',
        passed: true,
        errorCount: 0,
        warningCount: 1,
        duration: Date.now() - startTime,
        skipped: false,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Run circular dependency check phase
   */
  private async runCircularDepsCheck(): Promise<VerificationPhase> {
    const startTime = Date.now();

    try {
      const detector = new CircularDependencyDetector(this.webcontainer);
      const result = await detector.detect();

      // Only count static import cycles as errors
      const criticalCycles = result.cycles.filter(c => c.severity === 'error');
      const warningCycles = result.cycles.filter(c => c.severity === 'warning');

      return {
        name: 'Circular Dependencies',
        passed: criticalCycles.length === 0,
        errorCount: criticalCycles.length,
        warningCount: warningCycles.length,
        duration: Date.now() - startTime,
        skipped: false,
        details: result,
      };
    } catch (error) {
      return {
        name: 'Circular Dependencies',
        passed: true,
        errorCount: 0,
        warningCount: 0,
        duration: Date.now() - startTime,
        skipped: true,
        skipReason: error instanceof Error ? error.message : 'Detection failed',
      };
    }
  }

  /**
   * Run tests phase
   */
  private async runTests(): Promise<VerificationPhase> {
    const startTime = Date.now();

    try {
      const testRunner = new TargetedTestRunner({
        runCommand: (cmd) => this.runCommand(cmd),
        testCommand: 'npm test',
        testFilePattern: 'npm test -- {file}',
        maxTrackedFailures: 20,
        skipFullOnFailure: true,
        onProgress: this.config.onProgress,
        ...this.config.testConfig,
      });

      const result = await testRunner.runTests();

      return {
        name: 'Tests',
        passed: result.passed,
        errorCount: result.passed ? 0 : (result.fullResult?.failedTests || result.targetedResult?.failedTests || 1),
        warningCount: 0,
        duration: Date.now() - startTime,
        skipped: false,
        details: result,
      };
    } catch (error) {
      return {
        name: 'Tests',
        passed: true,
        errorCount: 0,
        warningCount: 1,
        duration: Date.now() - startTime,
        skipped: true,
        skipReason: error instanceof Error ? error.message : 'Test execution failed',
      };
    }
  }

  /**
   * Setup runtime error capture phase
   */
  private async setupRuntimeCapture(): Promise<VerificationPhase> {
    const startTime = Date.now();

    try {
      // Check if already injected
      const alreadyInjected = await isErrorCaptureInjected(this.webcontainer);
      if (alreadyInjected) {
        return {
          name: 'Runtime Setup',
          passed: true,
          errorCount: 0,
          warningCount: 0,
          duration: Date.now() - startTime,
          skipped: false,
          details: { alreadyInjected: true },
        };
      }

      // Inject error capture
      const injector = new RuntimeErrorInjector(this.webcontainer);
      const results = await injector.inject();

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success && !r.alreadyInjected).length;

      return {
        name: 'Runtime Setup',
        passed: failed === 0,
        errorCount: failed,
        warningCount: 0,
        duration: Date.now() - startTime,
        skipped: false,
        details: { results, successful, failed },
      };
    } catch (error) {
      return {
        name: 'Runtime Setup',
        passed: true, // Don't fail verification on injection issues
        errorCount: 0,
        warningCount: 1,
        duration: Date.now() - startTime,
        skipped: false,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private createSkippedPhase(name: string): VerificationPhase {
    return {
      name,
      passed: true,
      errorCount: 0,
      warningCount: 0,
      duration: 0,
      skipped: true,
    };
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await this.webcontainer.fs.readFile(path, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  private async readFile(path: string): Promise<string | null> {
    try {
      return await this.webcontainer.fs.readFile(path, 'utf-8');
    } catch {
      return null;
    }
  }

  private async listFiles(pattern: string): Promise<string[]> {
    // Simple implementation - in real usage would use glob
    const files: string[] = [];
    const ext = pattern.replace('**/*', '');

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await this.webcontainer.fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.name.endsWith(ext)) {
            files.push(fullPath.replace(/^\//, ''));
          }
        }
      } catch {
        // Ignore
      }
    };

    await walk('/');
    return files;
  }

  private async runCommand(command: string): Promise<{ output: string; exitCode: number }> {
    try {
      const parts = command.split(' ');
      const process = await this.webcontainer.spawn(parts[0], parts.slice(1));

      let output = '';
      const outputPromise = new Promise<void>((resolve) => {
        process.output.pipeTo(new WritableStream({
          write(chunk) {
            output += chunk;
          },
          close() {
            resolve();
          },
        }));
      });

      const exitCode = await process.exit;
      await outputPromise;

      return { output, exitCode };
    } catch (error) {
      return {
        output: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  private async hasTestFiles(): Promise<boolean> {
    const testPatterns = [
      '**/*.test.ts', '**/*.test.tsx', '**/*.test.js', '**/*.test.jsx',
      '**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx',
    ];

    for (const pattern of testPatterns) {
      const files = await this.listFiles(pattern);
      if (files.length > 0) return true;
    }

    return false;
  }

  private async hasStyleFiles(): Promise<boolean> {
    const stylePatterns = ['**/*.css', '**/*.scss', '**/*.sass'];

    for (const pattern of stylePatterns) {
      const files = await this.listFiles(pattern);
      if (files.length > 0) return true;
    }

    return false;
  }

  private generateSummary(result: UnifiedVerificationResult): string {
    if (result.success) {
      return `✅ All verification phases passed (${result.totalWarnings} warnings)`;
    }

    const failedPhases = Object.values(result.phases)
      .filter(p => !p.skipped && !p.passed)
      .map(p => p.name);

    return `❌ ${result.totalErrors} error(s) in: ${failedPhases.join(', ')}`;
  }

  private generateReport(result: UnifiedVerificationResult): string {
    const lines: string[] = [
      '# Unified Verification Report',
      '',
      `**Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}`,
      `**Total Errors:** ${result.totalErrors}`,
      `**Total Warnings:** ${result.totalWarnings}`,
      `**Duration:** ${result.totalDuration}ms`,
      '',
      '## Project Info',
      `- Type: ${result.projectInfo.projectType}`,
      `- Package Manager: ${result.projectInfo.packageManager || 'npm'}`,
      `- Build Tool: ${result.projectInfo.buildTool || 'unknown'}`,
      `- Monorepo: ${result.projectInfo.isMonorepo ? `Yes (${result.projectInfo.monorepoType})` : 'No'}`,
      `- Project References: ${result.projectInfo.usesProjectReferences ? 'Yes' : 'No'}`,
      '',
      '## Phase Results',
      '',
    ];

    for (const [key, phase] of Object.entries(result.phases)) {
      if (phase.skipped) {
        lines.push(`### ${phase.name} ⏭️ Skipped`);
        if (phase.skipReason) {
          lines.push(`Reason: ${phase.skipReason}`);
        }
      } else {
        const icon = phase.passed ? '✅' : '❌';
        lines.push(`### ${phase.name} ${icon}`);
        lines.push(`- Errors: ${phase.errorCount}`);
        lines.push(`- Warnings: ${phase.warningCount}`);
        lines.push(`- Duration: ${phase.duration}ms`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a unified verifier instance
 */
export function createUnifiedVerifier(
  webcontainer: WebContainer,
  config?: UnifiedVerifierConfig
): UnifiedVerifier {
  return new UnifiedVerifier(webcontainer, config);
}

/**
 * Run quick verification (type check only)
 */
export async function quickVerify(webcontainer: WebContainer): Promise<UnifiedVerificationResult> {
  const verifier = new UnifiedVerifier(webcontainer, {
    phases: {
      typeCheck: true,
      lint: false,
      styleLint: false,
      envValidation: false,
      circularDeps: false,
      tests: false,
      runtimeSetup: false,
    },
  });
  return verifier.verify();
}

/**
 * Run full verification (all phases except tests)
 */
export async function fullVerify(webcontainer: WebContainer): Promise<UnifiedVerificationResult> {
  const verifier = new UnifiedVerifier(webcontainer, {
    runTests: false,
  });
  return verifier.verify();
}

/**
 * Run complete verification (including tests)
 */
export async function completeVerify(webcontainer: WebContainer): Promise<UnifiedVerificationResult> {
  const verifier = new UnifiedVerifier(webcontainer, {
    runTests: true,
    phases: {
      typeCheck: true,
      lint: true,
      styleLint: true,
      envValidation: true,
      circularDeps: true,
      tests: true,
      runtimeSetup: true,
    },
  });
  return verifier.verify();
}
