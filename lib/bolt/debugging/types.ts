/**
 * Debugging Pipeline Types
 *
 * Type definitions for the debugging system that handles
 * error collection, analysis, root cause identification, and fixes.
 */

import type { ModelTier } from '../ai/modelRouter/types';

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Type of error
 */
export type ErrorType =
  | 'type'        // TypeScript type errors
  | 'syntax'      // Syntax errors
  | 'module'      // Module/import errors
  | 'runtime'     // Runtime errors
  | 'build'       // Build/compile errors
  | 'lint'        // Linting errors
  | 'test'        // Test failures
  | 'unknown';    // Unknown error type

/**
 * Severity level of an error
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Information about a single error
 */
export interface ErrorInfo {
  /** Unique identifier */
  id: string;

  /** Error type */
  type: ErrorType;

  /** Severity level */
  severity: ErrorSeverity;

  /** Error message */
  message: string;

  /** File path where error occurred */
  file?: string;

  /** Line number */
  line?: number;

  /** Column number */
  column?: number;

  /** Error code (e.g., TS2322) */
  code?: string;

  /** Full raw error text */
  raw: string;

  /** Timestamp when error was detected */
  timestamp: number;
}

/**
 * Collection of errors from a source
 */
export interface ErrorCollection {
  /** Unique collection ID */
  id: string;

  /** Source of errors */
  source: 'build' | 'typecheck' | 'runtime' | 'test' | 'lint';

  /** All errors */
  errors: ErrorInfo[];

  /** Error counts by type */
  counts: Record<ErrorType, number>;

  /** Total error count */
  total: number;

  /** Files affected */
  affectedFiles: string[];

  /** Collection timestamp */
  timestamp: number;
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

/**
 * Error group (errors in the same file or related)
 */
export interface ErrorGroup {
  /** File path */
  file: string;

  /** Errors in this file */
  errors: ErrorInfo[];

  /** Primary error type in this group */
  primaryType: ErrorType;

  /** Impact score (higher = more severe) */
  impactScore: number;
}

/**
 * Analysis of error patterns
 */
export interface ErrorAnalysis {
  /** Grouped errors by file */
  groups: ErrorGroup[];

  /** Cascading error chains (one error causing others) */
  cascades: ErrorCascade[];

  /** Priority ordering of errors to fix */
  priorityOrder: string[];

  /** Root cause candidates */
  rootCauseCandidates: RootCauseCandidate[];

  /** Summary statistics */
  stats: {
    totalErrors: number;
    uniqueFiles: number;
    primaryType: ErrorType;
    estimatedRootCauses: number;
  };
}

/**
 * A cascade of errors where one causes others
 */
export interface ErrorCascade {
  /** The originating error */
  source: ErrorInfo;

  /** Errors caused by the source */
  cascaded: ErrorInfo[];

  /** Confidence that this is a cascade (0-1) */
  confidence: number;
}

/**
 * A candidate for root cause
 */
export interface RootCauseCandidate {
  /** The error that might be the root cause */
  error: ErrorInfo;

  /** Confidence score (0-1) */
  confidence: number;

  /** Reasoning for this being a root cause */
  reasoning: string;

  /** Number of other errors this might cause */
  cascadeCount: number;
}

// =============================================================================
// ROOT CAUSE TYPES
// =============================================================================

/**
 * Identified root cause of errors
 */
export interface RootCause {
  /** Primary error that is the root cause */
  primaryError: ErrorInfo;

  /** File containing the root cause */
  file: string;

  /** Line number of the issue */
  line: number;

  /** Description of the root cause */
  description: string;

  /** Code snippet showing the issue */
  codeContext?: string;

  /** Evidence supporting this conclusion */
  evidence: RootCauseEvidence[];

  /** How many errors this causes */
  affectedErrorCount: number;

  /** Suggested fix type */
  suggestedFixType: 'add' | 'remove' | 'modify' | 'import';

  /** Confidence in this root cause (0-1) */
  confidence: number;
}

/**
 * Evidence supporting a root cause conclusion
 */
export interface RootCauseEvidence {
  /** Type of evidence */
  type: 'error_message' | 'code_pattern' | 'import_analysis' | 'type_mismatch';

  /** Description of the evidence */
  description: string;

  /** Supporting data */
  data?: string;
}

// =============================================================================
// FIX TYPES
// =============================================================================

/**
 * A minimal fix for an error
 */
export interface Fix {
  /** Fix ID */
  id: string;

  /** File to modify */
  file: string;

  /** Type of fix */
  type: 'add_line' | 'remove_line' | 'replace_line' | 'add_import' | 'modify_type';

  /** Line number (for line-based fixes) */
  line?: number;

  /** Original content (for replacement) */
  original?: string;

  /** New content */
  replacement: string;

  /** Description of the fix */
  description: string;
}

/**
 * Plan for fixing the root cause
 */
export interface FixPlan {
  /** Plan ID */
  id: string;

  /** Root cause being fixed */
  rootCause: RootCause;

  /** Ordered list of fixes */
  fixes: Fix[];

  /** Expected errors to be resolved */
  expectedResolutions: number;

  /** Warnings about the fix */
  warnings: string[];

  /** Whether this is a minimal fix (no refactoring) */
  isMinimal: boolean;

  /** Estimated model tier needed */
  suggestedModel: ModelTier;
}

/**
 * Result of applying a fix
 */
export interface FixResult {
  /** Whether the fix was applied successfully */
  success: boolean;

  /** Files that were modified */
  modifiedFiles: string[];

  /** Errors before the fix */
  errorsBefore: number;

  /** Errors after the fix */
  errorsAfter: number;

  /** New errors introduced (if any) */
  newErrors: ErrorInfo[];

  /** Duration of fix in ms */
  duration: number;

  /** Error message if fix failed */
  error?: string;
}

// =============================================================================
// PIPELINE TYPES
// =============================================================================

/**
 * Debug pipeline step
 */
export type DebugPipelineStep =
  | 'collect'      // Collect errors
  | 'analyze'      // Analyze patterns
  | 'read'         // Read affected files
  | 'identify'     // Identify root cause
  | 'plan'         // Plan fix
  | 'execute'      // Execute fix
  | 'verify';      // Verify fix

/**
 * Status of a pipeline step
 */
export type PipelineStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Progress of the debug pipeline
 */
export interface DebugPipelineProgress {
  /** Current step */
  currentStep: DebugPipelineStep;

  /** Status of each step */
  stepStatus: Record<DebugPipelineStep, PipelineStepStatus>;

  /** Percentage complete */
  percentage: number;

  /** Status message */
  message: string;
}

/**
 * Context for the debug pipeline
 */
export interface DebugPipelineContext {
  /** Raw error output */
  rawErrors: string[];

  /** Project files */
  projectFiles: string[];

  /** File contents (for reading) */
  fileContents: Map<string, string>;

  /** Configuration */
  config: DebugPipelineConfig;
}

/**
 * Configuration for the debug pipeline
 */
export interface DebugPipelineConfig {
  /** Maximum errors to process */
  maxErrors: number;

  /** Maximum files to read */
  maxFilesToRead: number;

  /** Timeout for each step (ms) */
  stepTimeout: number;

  /** Whether to auto-apply fixes */
  autoApply: boolean;

  /** Model tier to use for analysis */
  analysisModel: ModelTier;
}

/**
 * Default debug pipeline configuration
 */
export const DEFAULT_DEBUG_CONFIG: DebugPipelineConfig = {
  maxErrors: 50,
  maxFilesToRead: 10,
  stepTimeout: 30000,
  autoApply: false,
  analysisModel: 'flash',
};

/**
 * Result of the debug pipeline
 */
export interface DebugPipelineResult {
  /** Whether the pipeline succeeded */
  success: boolean;

  /** Error collection */
  collection: ErrorCollection;

  /** Error analysis */
  analysis: ErrorAnalysis;

  /** Identified root cause */
  rootCause: RootCause | null;

  /** Fix plan */
  fixPlan: FixPlan | null;

  /** Fix result (if fix was applied) */
  fixResult: FixResult | null;

  /** Total duration */
  duration: number;

  /** Token usage */
  tokenUsage: {
    input: number;
    output: number;
    model: ModelTier;
  };

  /** Error if pipeline failed */
  error?: string;
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  ErrorType,
  ErrorSeverity,
  ErrorInfo,
  ErrorCollection,
  ErrorGroup,
  ErrorAnalysis,
  ErrorCascade,
  RootCauseCandidate,
  RootCause,
  RootCauseEvidence,
  Fix,
  FixPlan,
  FixResult,
  DebugPipelineStep,
  PipelineStepStatus,
  DebugPipelineProgress,
  DebugPipelineContext,
  DebugPipelineConfig,
  DebugPipelineResult,
};
