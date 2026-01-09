/**
 * Project Type Detector
 *
 * Detects project type (TypeScript vs JavaScript) and provides
 * appropriate linting/checking strategy.
 *
 * For TypeScript projects: Use tsc --noEmit
 * For JavaScript projects: Fall back to ESLint
 */

// =============================================================================
// TYPES
// =============================================================================

export type ProjectType = 'typescript' | 'javascript' | 'mixed' | 'unknown';

export interface ProjectTypeInfo {
  /** Detected project type */
  type: ProjectType;
  /** Whether TypeScript is available */
  hasTypeScript: boolean;
  /** Whether ESLint is available */
  hasESLint: boolean;
  /** Whether there's a tsconfig.json */
  hasTsConfig: boolean;
  /** Whether there are .ts/.tsx files */
  hasTypeScriptFiles: boolean;
  /** Whether there are .js/.jsx files */
  hasJavaScriptFiles: boolean;
  /** Recommended verification command */
  verifyCommand: string;
  /** Additional lint command (if applicable) */
  lintCommand?: string;
  /** Confidence level (0-1) */
  confidence: number;
}

export interface ProjectDetectorConfig {
  /** Function to check if a file exists */
  fileExists: (path: string) => Promise<boolean>;
  /** Function to list files matching a pattern */
  listFiles: (pattern: string) => Promise<string[]>;
  /** Function to read file content */
  readFile: (path: string) => Promise<string | null>;
}

// =============================================================================
// ESLint RUNNER
// =============================================================================

export interface ESLintError {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  ruleId: string;
}

export interface ESLintResult {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  errors: ESLintError[];
  output: string;
}

export interface ESLintRunnerConfig {
  /** Function to run ESLint command */
  runCommand: (command: string) => Promise<{ output: string; exitCode: number }>;
  /** ESLint config file path (optional) */
  configFile?: string;
  /** Files/patterns to lint */
  patterns: string[];
  /** Additional ESLint arguments */
  extraArgs?: string[];
}

// =============================================================================
// PROJECT TYPE DETECTOR CLASS
// =============================================================================

export class ProjectTypeDetector {
  private config: ProjectDetectorConfig;

  constructor(config: ProjectDetectorConfig) {
    this.config = config;
  }

  /**
   * Detect the project type
   */
  async detect(): Promise<ProjectTypeInfo> {
    const [
      hasTsConfig,
      hasPackageJson,
      tsFiles,
      jsFiles,
    ] = await Promise.all([
      this.config.fileExists('tsconfig.json'),
      this.config.fileExists('package.json'),
      this.config.listFiles('**/*.{ts,tsx}'),
      this.config.listFiles('**/*.{js,jsx}'),
    ]);

    // Check package.json for TypeScript and ESLint
    let hasTypeScript = false;
    let hasESLint = false;

    if (hasPackageJson) {
      const packageContent = await this.config.readFile('package.json');
      if (packageContent) {
        try {
          const pkg = JSON.parse(packageContent);
          const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
          };
          hasTypeScript = 'typescript' in allDeps;
          hasESLint = 'eslint' in allDeps;
        } catch {
          // Invalid JSON, continue with defaults
        }
      }
    }

    const hasTypeScriptFiles = tsFiles.length > 0;
    const hasJavaScriptFiles = jsFiles.length > 0;

    // Determine project type
    let type: ProjectType;
    let confidence: number;

    if (hasTsConfig && hasTypeScript && hasTypeScriptFiles) {
      type = hasJavaScriptFiles ? 'mixed' : 'typescript';
      confidence = 0.95;
    } else if (hasTypeScriptFiles && !hasTsConfig) {
      type = 'mixed';
      confidence = 0.7;
    } else if (hasJavaScriptFiles && !hasTypeScriptFiles) {
      type = 'javascript';
      confidence = 0.9;
    } else {
      type = 'unknown';
      confidence = 0.3;
    }

    // Determine verification commands
    let verifyCommand: string;
    let lintCommand: string | undefined;

    if (type === 'typescript' || type === 'mixed') {
      verifyCommand = 'npx tsc --noEmit';
      if (hasESLint) {
        lintCommand = 'npx eslint . --ext .ts,.tsx,.js,.jsx';
      }
    } else if (type === 'javascript') {
      if (hasESLint) {
        verifyCommand = 'npx eslint . --ext .js,.jsx';
      } else {
        // Suggest installing ESLint
        verifyCommand = 'echo "No type checker available. Consider adding ESLint."';
      }
    } else {
      verifyCommand = 'echo "Unable to determine project type"';
    }

    return {
      type,
      hasTypeScript,
      hasESLint,
      hasTsConfig,
      hasTypeScriptFiles,
      hasJavaScriptFiles,
      verifyCommand,
      lintCommand,
      confidence,
    };
  }

  /**
   * Get the appropriate error checker based on project type
   */
  async getRecommendedChecker(): Promise<'tsc' | 'eslint' | 'none'> {
    const info = await this.detect();

    if (info.type === 'typescript' || info.type === 'mixed') {
      return 'tsc';
    }

    if (info.type === 'javascript' && info.hasESLint) {
      return 'eslint';
    }

    return 'none';
  }
}

// =============================================================================
// ESLINT RUNNER CLASS
// =============================================================================

export class ESLintRunner {
  private config: ESLintRunnerConfig;

  constructor(config: ESLintRunnerConfig) {
    this.config = config;
  }

  /**
   * Run ESLint on the configured patterns
   */
  async run(): Promise<ESLintResult> {
    const args = [
      'npx eslint',
      ...this.config.patterns,
      '--format', 'json',
    ];

    if (this.config.configFile) {
      args.push('--config', this.config.configFile);
    }

    if (this.config.extraArgs) {
      args.push(...this.config.extraArgs);
    }

    const command = args.join(' ');
    const { output, exitCode } = await this.config.runCommand(command);

    // Parse ESLint JSON output
    const errors = this.parseOutput(output);
    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length;

    return {
      passed: exitCode === 0,
      errorCount,
      warningCount,
      errors,
      output,
    };
  }

  /**
   * Run ESLint on specific files
   */
  async runOnFiles(files: string[]): Promise<ESLintResult> {
    if (files.length === 0) {
      return {
        passed: true,
        errorCount: 0,
        warningCount: 0,
        errors: [],
        output: 'No files to lint',
      };
    }

    const args = [
      'npx eslint',
      ...files,
      '--format', 'json',
    ];

    if (this.config.configFile) {
      args.push('--config', this.config.configFile);
    }

    const command = args.join(' ');
    const { output, exitCode } = await this.config.runCommand(command);

    const errors = this.parseOutput(output);
    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length;

    return {
      passed: exitCode === 0,
      errorCount,
      warningCount,
      errors,
      output,
    };
  }

  /**
   * Parse ESLint JSON output
   */
  private parseOutput(output: string): ESLintError[] {
    const errors: ESLintError[] = [];

    try {
      // Try to parse as JSON (from --format json)
      const results = JSON.parse(output);

      for (const result of results) {
        for (const message of result.messages || []) {
          errors.push({
            file: result.filePath,
            line: message.line || 1,
            column: message.column || 1,
            severity: message.severity === 2 ? 'error' : 'warning',
            message: message.message,
            ruleId: message.ruleId || 'unknown',
          });
        }
      }
    } catch {
      // Not JSON, try to parse text output
      // Format: /path/to/file.js:10:5: Error message (rule-id)
      const linePattern = /^(.+):(\d+):(\d+):\s*(error|warning)\s+(.+?)\s+(\S+)$/gm;
      let match;

      while ((match = linePattern.exec(output)) !== null) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          severity: match[4] as 'error' | 'warning',
          message: match[5],
          ruleId: match[6],
        });
      }
    }

    return errors;
  }

  /**
   * Format errors for display
   */
  formatErrors(errors: ESLintError[]): string {
    if (errors.length === 0) {
      return 'No ESLint errors.';
    }

    const lines = ['## ESLint Errors', ''];
    const grouped = new Map<string, ESLintError[]>();

    // Group by file
    for (const error of errors) {
      const existing = grouped.get(error.file) || [];
      existing.push(error);
      grouped.set(error.file, existing);
    }

    for (const [file, fileErrors] of grouped) {
      lines.push(`### ${file}`);
      for (const error of fileErrors) {
        const severity = error.severity === 'error' ? '❌' : '⚠️';
        lines.push(`- ${severity} Line ${error.line}: ${error.message} (${error.ruleId})`);
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
 * Create a project type detector
 */
export function createProjectTypeDetector(
  config: ProjectDetectorConfig
): ProjectTypeDetector {
  return new ProjectTypeDetector(config);
}

/**
 * Create an ESLint runner
 */
export function createESLintRunner(
  config: ESLintRunnerConfig
): ESLintRunner {
  return new ESLintRunner(config);
}
