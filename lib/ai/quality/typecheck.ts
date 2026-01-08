/**
 * TypeScript Gate
 *
 * TypeScript compilation and type checking.
 */

/**
 * Type error
 */
export interface TypeCheckError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

/**
 * Type check result
 */
export interface TypeCheckResult {
  passed: boolean;
  errorCount: number;
  errors: TypeCheckError[];
  duration: number;
}

/**
 * TypeScript configuration
 */
export interface TypeCheckConfig {
  strict: boolean;
  noImplicitAny: boolean;
  noImplicitReturns: boolean;
  noUnusedLocals: boolean;
  noUnusedParameters: boolean;
}

/**
 * Default TypeScript configuration
 */
const DEFAULT_CONFIG: TypeCheckConfig = {
  strict: true,
  noImplicitAny: true,
  noImplicitReturns: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
};

/**
 * Common TypeScript error patterns to detect
 */
const TS_ERROR_PATTERNS = [
  // Type errors
  {
    pattern: /:\s*any\s*[;,)=]/,
    code: 'TS7006',
    message: 'Parameter implicitly has an \'any\' type',
  },
  {
    pattern: /\bas\s+any\b/,
    code: 'TS2345',
    message: 'Unsafe type assertion to any',
  },
  {
    pattern: /\/\/\s*@ts-expect-error/,
    code: 'TS2578',
    message: '@ts-expect-error directive found',
  },

  // Import errors
  {
    pattern: /import\s+.*\s+from\s+['"][^'"]+['"]\s*;\s*\/\/\s*unresolved/i,
    code: 'TS2307',
    message: 'Cannot find module',
  },

  // Missing return type
  {
    pattern: /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*{/,
    code: 'TS7030',
    message: 'Function lacks return type annotation',
    checkExport: true,
  },
];

/**
 * Simulated type check for code content
 * In production, this would invoke the actual TypeScript compiler
 */
export function runTypeCheckGate(
  files: { path: string; content: string }[],
  config: Partial<TypeCheckConfig> = {}
): TypeCheckResult {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const errors: TypeCheckError[] = [];

  for (const file of files) {
    // Skip non-TypeScript files
    if (!file.path.endsWith('.ts') && !file.path.endsWith('.tsx')) {
      continue;
    }

    // Run type checks
    const fileErrors = checkTypes(file.path, file.content, mergedConfig);
    errors.push(...fileErrors);
  }

  return {
    passed: errors.length === 0,
    errorCount: errors.length,
    errors,
    duration: Date.now() - startTime,
  };
}

/**
 * Check types in a single file
 */
function checkTypes(
  filePath: string,
  content: string,
  config: TypeCheckConfig
): TypeCheckError[] {
  const errors: TypeCheckError[] = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;

    // Check for any type usage (if strict)
    if (config.noImplicitAny) {
      // Explicit any
      const anyMatch = line.match(/:\s*any\b/);
      if (anyMatch) {
        errors.push({
          file: filePath,
          line: lineNumber,
          column: anyMatch.index ?? 0,
          code: 'TS7006',
          message: 'Explicit \'any\' type usage',
        });
      }
    }

    // Check for unused variables (simple heuristic)
    if (config.noUnusedLocals) {
      const constMatch = line.match(/(?:const|let)\s+(\w+)\s*=/);
      if (constMatch) {
        const varName = constMatch[1];
        // Check if variable is used elsewhere in the file (simple check)
        const restOfFile = lines.slice(lineIndex + 1).join('\n');
        const usagePattern = new RegExp(`\\b${varName}\\b`);
        if (!usagePattern.test(restOfFile) && !varName.startsWith('_')) {
          // Don't flag if prefixed with underscore
          errors.push({
            file: filePath,
            line: lineNumber,
            column: constMatch.index ?? 0,
            code: 'TS6133',
            message: `'${varName}' is declared but its value is never read`,
          });
        }
      }
    }

    // Check for missing return type on exports (if strict)
    if (config.strict) {
      const exportFuncMatch = line.match(
        /export\s+(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{/
      );
      if (exportFuncMatch) {
        // Check if return type is specified
        const hasReturnType = line.includes('): ');
        if (!hasReturnType) {
          errors.push({
            file: filePath,
            line: lineNumber,
            column: 0,
            code: 'TS7030',
            message: `Exported function '${exportFuncMatch[1]}' lacks return type annotation`,
          });
        }
      }
    }

    // Check for null assertion operator usage
    const nullAssertMatch = line.match(/\w+!/);
    if (nullAssertMatch && !line.includes('!==') && !line.includes('!=')) {
      errors.push({
        file: filePath,
        line: lineNumber,
        column: nullAssertMatch.index ?? 0,
        code: 'TS2532',
        message: 'Non-null assertion operator (!) used',
      });
    }
  }

  // Check for proper imports
  const importErrors = checkImports(filePath, content);
  errors.push(...importErrors);

  return errors;
}

/**
 * Check import statements
 */
function checkImports(filePath: string, content: string): TypeCheckError[] {
  const errors: TypeCheckError[] = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;

    // Check for relative imports going too deep
    const deepImportMatch = line.match(/from\s+['"](\.\.\/(\.\.\/){3,})/);
    if (deepImportMatch) {
      errors.push({
        file: filePath,
        line: lineNumber,
        column: deepImportMatch.index ?? 0,
        code: 'TS-DEEP-IMPORT',
        message: 'Import path goes more than 3 directories up, consider using path aliases',
      });
    }

    // Check for importing from index files explicitly
    const indexImportMatch = line.match(/from\s+['"][^'"]+\/index['"]/);
    if (indexImportMatch) {
      errors.push({
        file: filePath,
        line: lineNumber,
        column: indexImportMatch.index ?? 0,
        code: 'TS-INDEX-IMPORT',
        message: 'Explicit /index import is unnecessary',
      });
    }
  }

  return errors;
}

/**
 * Format type check results for display
 */
export function formatTypeCheckResults(result: TypeCheckResult): string {
  const lines: string[] = [];

  lines.push(`TypeCheck Results: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push(`  Errors: ${result.errorCount}`);
  lines.push(`  Duration: ${result.duration}ms`);

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');

    // Group by file
    const byFile = new Map<string, TypeCheckError[]>();
    for (const error of result.errors) {
      const existing = byFile.get(error.file) ?? [];
      existing.push(error);
      byFile.set(error.file, existing);
    }

    for (const [file, errors] of byFile) {
      lines.push(`  ${file}:`);
      for (const error of errors.slice(0, 10)) {
        lines.push(`    ✗ ${error.line}:${error.column} ${error.message} (${error.code})`);
      }
      if (errors.length > 10) {
        lines.push(`    ... and ${errors.length - 10} more errors`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Quick type check for a single file
 */
export function quickTypeCheck(content: string, filePath: string = 'file.ts'): {
  passed: boolean;
  errors: TypeCheckError[];
} {
  const errors = checkTypes(filePath, content, DEFAULT_CONFIG);

  return {
    passed: errors.length === 0,
    errors,
  };
}
