/**
 * Lint Gate
 *
 * ESLint integration for code quality enforcement.
 */

/**
 * Lint severity levels
 */
export type LintSeverity = 'error' | 'warning' | 'info';

/**
 * Lint issue
 */
export interface LintIssue {
  file: string;
  line: number;
  column: number;
  severity: LintSeverity;
  rule: string;
  message: string;
}

/**
 * Lint result
 */
export interface LintResult {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  issues: LintIssue[];
  duration: number;
}

/**
 * Lint configuration
 */
export interface LintConfig {
  maxErrors: number;
  maxWarnings: number;
  ignorePatterns: string[];
  rules?: Record<string, 'error' | 'warn' | 'off'>;
}

/**
 * Default lint configuration
 */
const DEFAULT_LINT_CONFIG: LintConfig = {
  maxErrors: 0,
  maxWarnings: 10,
  ignorePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.next/**',
    'coverage/**',
  ],
};

/**
 * Common lint rules to check
 */
const LINT_RULES = [
  // TypeScript
  { pattern: /\bany\b(?!\s*\])/, rule: '@typescript-eslint/no-explicit-any', message: 'Avoid using `any` type' },
  { pattern: /\/\/\s*@ts-ignore/, rule: '@typescript-eslint/ban-ts-comment', message: 'Avoid @ts-ignore comments' },
  { pattern: /\/\/\s*@ts-nocheck/, rule: '@typescript-eslint/ban-ts-comment', message: 'Avoid @ts-nocheck comments' },

  // React
  { pattern: /dangerouslySetInnerHTML/, rule: 'react/no-danger', message: 'Avoid dangerouslySetInnerHTML' },
  { pattern: /\bkey=\{(?:index|i)\}/, rule: 'react/no-array-index-key', message: 'Avoid using array index as key' },

  // Security
  { pattern: /eval\s*\(/, rule: 'no-eval', message: 'eval() is dangerous' },
  { pattern: /new\s+Function\s*\(/, rule: 'no-new-func', message: 'Function constructor is dangerous' },

  // Best practices
  { pattern: /console\.(log|debug|info)\s*\(/, rule: 'no-console', message: 'Remove console statements' },
  { pattern: /debugger/, rule: 'no-debugger', message: 'Remove debugger statements' },
  { pattern: /TODO:|FIXME:|HACK:|XXX:/, rule: 'no-warning-comments', message: 'Address TODO/FIXME comments' },
];

/**
 * Run lint gate on code content
 */
export function runLintGate(
  files: { path: string; content: string }[],
  config: Partial<LintConfig> = {}
): LintResult {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_LINT_CONFIG, ...config };
  const issues: LintIssue[] = [];

  for (const file of files) {
    // Skip ignored patterns
    if (mergedConfig.ignorePatterns.some((pattern) =>
      file.path.includes(pattern.replace('/**', ''))
    )) {
      continue;
    }

    // Run lint checks
    const fileIssues = lintContent(file.path, file.content);
    issues.push(...fileIssues);
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  const passed =
    errorCount <= mergedConfig.maxErrors &&
    warningCount <= mergedConfig.maxWarnings;

  return {
    passed,
    errorCount,
    warningCount,
    issues,
    duration: Date.now() - startTime,
  };
}

/**
 * Lint a single file's content
 */
function lintContent(filePath: string, content: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;

    for (const rule of LINT_RULES) {
      const match = line.match(rule.pattern);
      if (match) {
        issues.push({
          file: filePath,
          line: lineNumber,
          column: match.index ?? 0,
          severity: getSeverity(rule.rule),
          rule: rule.rule,
          message: rule.message,
        });
      }
    }

    // Check line length
    if (line.length > 120) {
      issues.push({
        file: filePath,
        line: lineNumber,
        column: 121,
        severity: 'warning',
        rule: 'max-len',
        message: `Line exceeds 120 characters (${line.length})`,
      });
    }

    // Check for trailing whitespace
    if (/\s+$/.test(line)) {
      issues.push({
        file: filePath,
        line: lineNumber,
        column: line.trimEnd().length + 1,
        severity: 'warning',
        rule: 'no-trailing-spaces',
        message: 'Trailing whitespace',
      });
    }
  }

  // Check for missing newline at end of file
  if (content.length > 0 && !content.endsWith('\n')) {
    issues.push({
      file: filePath,
      line: lines.length,
      column: lines[lines.length - 1].length,
      severity: 'warning',
      rule: 'eol-last',
      message: 'File should end with a newline',
    });
  }

  return issues;
}

/**
 * Get severity for a rule
 */
function getSeverity(rule: string): LintSeverity {
  const errorRules = [
    'no-eval',
    'no-new-func',
    '@typescript-eslint/no-explicit-any',
    'react/no-danger',
  ];

  return errorRules.includes(rule) ? 'error' : 'warning';
}

/**
 * Format lint results for display
 */
export function formatLintResults(result: LintResult): string {
  const lines: string[] = [];

  lines.push(`Lint Results: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push(`  Errors: ${result.errorCount}`);
  lines.push(`  Warnings: ${result.warningCount}`);
  lines.push(`  Duration: ${result.duration}ms`);

  if (result.issues.length > 0) {
    lines.push('');
    lines.push('Issues:');

    // Group by file
    const byFile = new Map<string, LintIssue[]>();
    for (const issue of result.issues) {
      const existing = byFile.get(issue.file) ?? [];
      existing.push(issue);
      byFile.set(issue.file, existing);
    }

    for (const [file, issues] of byFile) {
      lines.push(`  ${file}:`);
      for (const issue of issues.slice(0, 10)) {
        const icon = issue.severity === 'error' ? '✗' : '⚠';
        lines.push(`    ${icon} ${issue.line}:${issue.column} ${issue.message} (${issue.rule})`);
      }
      if (issues.length > 10) {
        lines.push(`    ... and ${issues.length - 10} more issues`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Quick lint check for a single file
 */
export function quickLint(content: string, filePath: string = 'file.ts'): {
  passed: boolean;
  issues: LintIssue[];
} {
  const issues = lintContent(filePath, content);
  const errorCount = issues.filter((i) => i.severity === 'error').length;

  return {
    passed: errorCount === 0,
    issues,
  };
}
