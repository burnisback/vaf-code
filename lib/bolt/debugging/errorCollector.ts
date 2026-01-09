/**
 * Error Collector
 *
 * Collects and parses errors from various sources
 * (build output, TypeScript, runtime, etc.)
 */

import type {
  ErrorInfo,
  ErrorCollection,
  ErrorType,
  ErrorSeverity,
} from './types';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique collection ID
 */
function generateCollectionId(): string {
  return `col_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Determine error type from error message
 */
export function determineErrorType(message: string, code?: string): ErrorType {
  // Module/import errors (check first - these are specific TS errors like TS2307)
  if (
    message.includes('Cannot find module') ||
    message.includes('Module not found') ||
    message.includes('is not a module') ||
    message.includes('has no exported member')
  ) {
    return 'module';
  }

  // TypeScript type errors (check after module errors)
  if (code?.startsWith('TS') || message.includes('Type ') || message.includes('type ')) {
    return 'type';
  }

  // Syntax errors
  if (
    message.includes('Syntax') ||
    message.includes('Unexpected token') ||
    message.includes('Unexpected end') ||
    message.includes('Expected')
  ) {
    return 'syntax';
  }

  // Build errors
  if (
    message.includes('build failed') ||
    message.includes('compilation failed') ||
    message.includes('Bundle failed')
  ) {
    return 'build';
  }

  // Runtime errors
  if (
    message.includes('ReferenceError') ||
    message.includes('TypeError') ||
    message.includes('is not defined') ||
    message.includes('is not a function')
  ) {
    return 'runtime';
  }

  // Lint errors
  if (message.includes('eslint') || message.includes('lint')) {
    return 'lint';
  }

  // Test errors
  if (message.includes('test failed') || message.includes('assertion')) {
    return 'test';
  }

  return 'unknown';
}

/**
 * Parse file location from error string
 */
export function parseFileLocation(text: string): {
  file?: string;
  line?: number;
  column?: number;
} {
  // Match patterns like:
  // - src/file.ts:10:5
  // - src/file.ts(10,5)
  // - at src/file.ts:10
  // - in ./src/file.ts line 10

  const patterns = [
    // src/file.ts:10:5
    /([./\w-]+\.[tj]sx?):(\d+):(\d+)/,
    // src/file.ts(10,5)
    /([./\w-]+\.[tj]sx?)\((\d+),(\d+)\)/,
    // at src/file.ts:10
    /at\s+([./\w-]+\.[tj]sx?):(\d+)/,
    // in ./src/file.ts line 10
    /in\s+([./\w-]+\.[tj]sx?)\s+line\s+(\d+)/,
    // file.ts:10
    /([./\w-]+\.[tj]sx?):(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        column: match[3] ? parseInt(match[3], 10) : undefined,
      };
    }
  }

  return {};
}

/**
 * Parse TypeScript error code
 */
export function parseErrorCode(text: string): string | undefined {
  // Match TS error codes like TS2322, TS7006, etc.
  const match = text.match(/TS(\d{4,5})/);
  return match ? `TS${match[1]}` : undefined;
}

/**
 * Deduplicate errors by message and file
 */
function deduplicateErrors(errors: ErrorInfo[]): ErrorInfo[] {
  const seen = new Set<string>();
  const unique: ErrorInfo[] = [];

  for (const error of errors) {
    const key = `${error.file || ''}:${error.line || ''}:${error.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(error);
    }
  }

  return unique;
}

// =============================================================================
// COLLECTORS
// =============================================================================

/**
 * Collect errors from build output
 */
export function collectBuildErrors(output: string): ErrorInfo[] {
  const errors: ErrorInfo[] = [];
  const lines = output.split('\n');
  const timestamp = Date.now();

  for (const line of lines) {
    // Skip empty lines and info lines
    if (!line.trim() || line.includes('info') || line.includes('INFO')) continue;

    // Check for error indicators
    const isError =
      line.includes('error') ||
      line.includes('ERROR') ||
      line.includes('Error:') ||
      line.includes('failed');

    const isWarning =
      line.includes('warning') ||
      line.includes('WARNING') ||
      line.includes('warn');

    if (!isError && !isWarning) continue;

    const { file, line: lineNum, column } = parseFileLocation(line);
    const code = parseErrorCode(line);
    const type = determineErrorType(line, code);
    const severity: ErrorSeverity = isError ? 'error' : 'warning';

    // Extract message (remove file path prefix)
    let message = line;
    if (file) {
      const filePattern = new RegExp(`.*${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:(]?\\d*[,:]?\\d*[)]?:?\\s*`);
      message = line.replace(filePattern, '').trim();
    }

    errors.push({
      id: generateErrorId(),
      type,
      severity,
      message: message || line,
      file,
      line: lineNum,
      column,
      code,
      raw: line,
      timestamp,
    });
  }

  return deduplicateErrors(errors);
}

/**
 * Collect TypeScript type errors
 */
export function collectTypeErrors(output: string): ErrorInfo[] {
  const errors: ErrorInfo[] = [];
  const timestamp = Date.now();

  // Match TypeScript error format:
  // file.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
  const tsErrorPattern = /([^(]+)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)/g;

  let match;
  while ((match = tsErrorPattern.exec(output)) !== null) {
    const [raw, file, line, column, severity, code, message] = match;

    errors.push({
      id: generateErrorId(),
      type: 'type',
      severity: severity === 'error' ? 'error' : 'warning',
      message,
      file: file.trim(),
      line: parseInt(line, 10),
      column: parseInt(column, 10),
      code,
      raw,
      timestamp,
    });
  }

  // Also try alternative format:
  // src/file.ts:10:5 - error TS2322: Message
  const altPattern = /([^:]+):(\d+):(\d+)\s*-\s*(error|warning)\s+(TS\d+):\s*(.+)/g;

  while ((match = altPattern.exec(output)) !== null) {
    const [raw, file, line, column, severity, code, message] = match;

    // Check if we already have this error
    const existing = errors.find(
      (e) => e.file === file.trim() && e.line === parseInt(line, 10) && e.code === code
    );
    if (!existing) {
      errors.push({
        id: generateErrorId(),
        type: 'type',
        severity: severity === 'error' ? 'error' : 'warning',
        message,
        file: file.trim(),
        line: parseInt(line, 10),
        column: parseInt(column, 10),
        code,
        raw,
        timestamp,
      });
    }
  }

  return errors;
}

/**
 * Collect runtime errors
 */
export function collectRuntimeErrors(errors: string[]): ErrorInfo[] {
  const collected: ErrorInfo[] = [];
  const timestamp = Date.now();

  for (const errorText of errors) {
    const { file, line, column } = parseFileLocation(errorText);
    const type = determineErrorType(errorText);

    // Extract error message (first line usually has the main message)
    const lines = errorText.split('\n');
    const message = lines[0] || errorText;

    collected.push({
      id: generateErrorId(),
      type: type === 'unknown' ? 'runtime' : type,
      severity: 'error',
      message,
      file,
      line,
      column,
      raw: errorText,
      timestamp,
    });
  }

  return deduplicateErrors(collected);
}

/**
 * Collect lint errors
 */
export function collectLintErrors(output: string): ErrorInfo[] {
  const errors: ErrorInfo[] = [];
  const timestamp = Date.now();

  // ESLint format: /path/file.ts:10:5: Error message [rule-name]
  const eslintPattern = /([^:]+):(\d+):(\d+):\s*(error|warning)\s+(.+?)\s+\[?([^\]]+)\]?$/gm;

  let match;
  while ((match = eslintPattern.exec(output)) !== null) {
    const [raw, file, line, column, severity, message, rule] = match;

    errors.push({
      id: generateErrorId(),
      type: 'lint',
      severity: severity === 'error' ? 'error' : 'warning',
      message: message.trim(),
      file: file.trim(),
      line: parseInt(line, 10),
      column: parseInt(column, 10),
      code: rule?.trim(),
      raw,
      timestamp,
    });
  }

  return errors;
}

// =============================================================================
// COLLECTION BUILDER
// =============================================================================

/**
 * Create an error collection from raw errors
 */
export function createErrorCollection(
  source: ErrorCollection['source'],
  rawErrors: string | string[]
): ErrorCollection {
  // Collect based on source
  let errors: ErrorInfo[];

  if (source === 'build') {
    errors = collectBuildErrors(
      Array.isArray(rawErrors) ? rawErrors.join('\n') : rawErrors
    );
  } else if (source === 'typecheck') {
    errors = collectTypeErrors(
      Array.isArray(rawErrors) ? rawErrors.join('\n') : rawErrors
    );
  } else if (source === 'lint') {
    errors = collectLintErrors(
      Array.isArray(rawErrors) ? rawErrors.join('\n') : rawErrors
    );
  } else if (source === 'runtime') {
    errors = collectRuntimeErrors(
      Array.isArray(rawErrors) ? rawErrors : [rawErrors]
    );
  } else {
    // Test or unknown - use generic build error collector
    errors = collectBuildErrors(
      Array.isArray(rawErrors) ? rawErrors.join('\n') : rawErrors
    );
  }

  // Count by type
  const counts: Record<ErrorType, number> = {
    type: 0,
    syntax: 0,
    module: 0,
    runtime: 0,
    build: 0,
    lint: 0,
    test: 0,
    unknown: 0,
  };

  for (const error of errors) {
    counts[error.type]++;
  }

  // Get affected files
  const affectedFiles = [...new Set(
    errors.map((e) => e.file).filter((f): f is string => !!f)
  )];

  return {
    id: generateCollectionId(),
    source,
    errors,
    counts,
    total: errors.length,
    affectedFiles,
    timestamp: Date.now(),
  };
}

/**
 * Merge multiple error collections
 */
export function mergeCollections(collections: ErrorCollection[]): ErrorCollection {
  const allErrors: ErrorInfo[] = [];
  const counts: Record<ErrorType, number> = {
    type: 0,
    syntax: 0,
    module: 0,
    runtime: 0,
    build: 0,
    lint: 0,
    test: 0,
    unknown: 0,
  };

  for (const collection of collections) {
    allErrors.push(...collection.errors);
    for (const type of Object.keys(counts) as ErrorType[]) {
      counts[type] += collection.counts[type];
    }
  }

  const deduplicated = deduplicateErrors(allErrors);
  const affectedFiles = [...new Set(
    deduplicated.map((e) => e.file).filter((f): f is string => !!f)
  )];

  return {
    id: generateCollectionId(),
    source: 'build', // Mixed source
    errors: deduplicated,
    counts,
    total: deduplicated.length,
    affectedFiles,
    timestamp: Date.now(),
  };
}

