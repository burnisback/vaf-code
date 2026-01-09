/**
 * Root Cause Identifier
 *
 * Identifies the root cause of errors using analysis
 * and code context.
 */

import type {
  ErrorInfo,
  ErrorAnalysis,
  RootCause,
  RootCauseEvidence,
  RootCauseCandidate,
} from './types';

// =============================================================================
// EVIDENCE GATHERING
// =============================================================================

/**
 * Gather evidence for a root cause candidate
 */
function gatherEvidence(
  candidate: RootCauseCandidate,
  fileContents: Map<string, string>,
  analysis: ErrorAnalysis
): RootCauseEvidence[] {
  const evidence: RootCauseEvidence[] = [];
  const error = candidate.error;

  // Evidence from error message
  evidence.push({
    type: 'error_message',
    description: `Error message: "${error.message}"`,
    data: error.message,
  });

  // Evidence from code context
  if (error.file && error.line) {
    const content = fileContents.get(error.file);
    if (content) {
      const lines = content.split('\n');
      const lineIndex = error.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const codeLine = lines[lineIndex];
        evidence.push({
          type: 'code_pattern',
          description: `Code at line ${error.line}: ${codeLine.trim()}`,
          data: codeLine,
        });

        // Check for common patterns
        const patterns = analyzeCodePatterns(codeLine, error);
        for (const pattern of patterns) {
          evidence.push(pattern);
        }
      }
    }
  }

  // Evidence from cascade count
  if (candidate.cascadeCount > 0) {
    evidence.push({
      type: 'error_message',
      description: `This error causes ${candidate.cascadeCount} other error(s)`,
    });
  }

  // Evidence from error type
  if (error.type === 'module') {
    evidence.push({
      type: 'import_analysis',
      description: 'Module/import error - check import paths and module exports',
    });
  }

  if (error.type === 'type') {
    evidence.push({
      type: 'type_mismatch',
      description: 'TypeScript type error - check type definitions and usage',
    });
  }

  return evidence;
}

/**
 * Analyze code patterns for additional evidence
 */
function analyzeCodePatterns(
  codeLine: string,
  error: ErrorInfo
): RootCauseEvidence[] {
  const evidence: RootCauseEvidence[] = [];
  const trimmed = codeLine.trim();

  // Import statement analysis
  if (trimmed.startsWith('import ')) {
    evidence.push({
      type: 'import_analysis',
      description: 'Error is in an import statement',
      data: trimmed,
    });

    // Check for relative import issues
    if (trimmed.includes('./') || trimmed.includes('../')) {
      evidence.push({
        type: 'import_analysis',
        description: 'Uses relative import path - verify path is correct',
      });
    }

    // Check for alias imports
    if (trimmed.includes('@/')) {
      evidence.push({
        type: 'import_analysis',
        description: 'Uses path alias (@/) - verify tsconfig paths',
      });
    }
  }

  // Type annotation analysis
  if (trimmed.includes(': ') && error.type === 'type') {
    evidence.push({
      type: 'type_mismatch',
      description: 'Contains type annotation - verify type compatibility',
    });
  }

  // Assignment analysis
  if (trimmed.includes(' = ') && error.type === 'type') {
    evidence.push({
      type: 'type_mismatch',
      description: 'Contains assignment - verify assigned value matches expected type',
    });
  }

  return evidence;
}

/**
 * Determine suggested fix type based on error
 */
function determineSuggestedFixType(
  error: ErrorInfo,
  evidence: RootCauseEvidence[]
): RootCause['suggestedFixType'] {
  // Module errors usually need import fixes
  if (error.type === 'module') {
    return 'import';
  }

  // Check evidence for clues
  const hasImportEvidence = evidence.some((e) => e.type === 'import_analysis');
  if (hasImportEvidence) {
    return 'import';
  }

  // Type errors usually need modification
  if (error.type === 'type') {
    return 'modify';
  }

  // Syntax errors might need add or remove
  if (error.type === 'syntax') {
    if (error.message.includes('Expected')) {
      return 'add';
    }
    if (error.message.includes('Unexpected')) {
      return 'remove';
    }
  }

  return 'modify';
}

/**
 * Get code context around the error line
 */
export function getCodeContext(
  file: string,
  line: number,
  fileContents: Map<string, string>,
  contextLines: number = 3
): string | undefined {
  const content = fileContents.get(file);
  if (!content) return undefined;

  const lines = content.split('\n');
  const startLine = Math.max(0, line - 1 - contextLines);
  const endLine = Math.min(lines.length, line + contextLines);

  const contextSnippet = lines
    .slice(startLine, endLine)
    .map((l, i) => {
      const lineNum = startLine + i + 1;
      const marker = lineNum === line ? '>' : ' ';
      return `${marker}${lineNum.toString().padStart(4)}: ${l}`;
    })
    .join('\n');

  return contextSnippet;
}

// =============================================================================
// ROOT CAUSE IDENTIFICATION
// =============================================================================

/**
 * Identify the root cause from analysis
 */
export function identifyRootCause(
  analysis: ErrorAnalysis,
  fileContents: Map<string, string>
): RootCause | null {
  // Get the best root cause candidate
  if (analysis.rootCauseCandidates.length === 0) {
    return null;
  }

  const candidate = analysis.rootCauseCandidates[0];
  const error = candidate.error;

  // Gather evidence
  const evidence = gatherEvidence(candidate, fileContents, analysis);

  // Get code context
  const codeContext = error.file && error.line
    ? getCodeContext(error.file, error.line, fileContents)
    : undefined;

  // Determine suggested fix type
  const suggestedFixType = determineSuggestedFixType(error, evidence);

  // Build description
  const description = buildRootCauseDescription(error, evidence);

  // Count affected errors
  const cascade = analysis.cascades.find((c) => c.source.id === error.id);
  const affectedErrorCount = 1 + (cascade?.cascaded.length || 0);

  return {
    primaryError: error,
    file: error.file || 'unknown',
    line: error.line || 0,
    description,
    codeContext,
    evidence,
    affectedErrorCount,
    suggestedFixType,
    confidence: candidate.confidence,
  };
}

/**
 * Build a human-readable description of the root cause
 */
function buildRootCauseDescription(
  error: ErrorInfo,
  evidence: RootCauseEvidence[]
): string {
  const parts: string[] = [];

  // Start with error type
  switch (error.type) {
    case 'module':
      parts.push('Module import/export issue');
      break;
    case 'type':
      parts.push('TypeScript type mismatch');
      break;
    case 'syntax':
      parts.push('Syntax error');
      break;
    case 'runtime':
      parts.push('Runtime error');
      break;
    default:
      parts.push('Code error');
  }

  // Add file location
  if (error.file) {
    parts.push(`in ${error.file}`);
    if (error.line) {
      parts.push(`at line ${error.line}`);
    }
  }

  // Add specific details from error message
  if (error.message) {
    // Extract key info from message
    if (error.message.includes('Cannot find module')) {
      const moduleMatch = error.message.match(/['"]([^'"]+)['"]/);
      if (moduleMatch) {
        parts.push(`- cannot find module '${moduleMatch[1]}'`);
      }
    } else if (error.message.includes('Property')) {
      const propMatch = error.message.match(/Property '([^']+)'/);
      if (propMatch) {
        parts.push(`- property '${propMatch[1]}' issue`);
      }
    } else if (error.message.includes('Type ')) {
      parts.push(`- ${error.message.toLowerCase()}`);
    }
  }

  return parts.join(' ');
}

/**
 * Validate a root cause identification
 */
export function validateRootCause(
  rootCause: RootCause,
  fileContents: Map<string, string>
): { valid: boolean; reason?: string } {
  // Check if file exists
  if (rootCause.file && !fileContents.has(rootCause.file)) {
    return {
      valid: false,
      reason: `File ${rootCause.file} not found in project`,
    };
  }

  // Check if line is valid
  if (rootCause.file && rootCause.line) {
    const content = fileContents.get(rootCause.file);
    if (content) {
      const lines = content.split('\n');
      if (rootCause.line > lines.length) {
        return {
          valid: false,
          reason: `Line ${rootCause.line} exceeds file length (${lines.length} lines)`,
        };
      }
    }
  }

  // Check evidence quality
  if (rootCause.evidence.length < 2) {
    return {
      valid: false,
      reason: 'Insufficient evidence to confirm root cause',
    };
  }

  // Check confidence threshold
  if (rootCause.confidence < 0.3) {
    return {
      valid: false,
      reason: `Low confidence (${rootCause.confidence.toFixed(2)}) in root cause identification`,
    };
  }

  return { valid: true };
}

