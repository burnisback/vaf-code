/**
 * Investigation Types
 *
 * Type definitions for the investigation layer that ensures
 * files are read before being edited.
 */

import type { ModelTier } from '../ai/modelRouter/types';

// =============================================================================
// SEARCH TYPES
// =============================================================================

/**
 * Result of a file search operation
 */
export interface SearchResult {
  /** File path relative to project root */
  filePath: string;

  /** Match context (surrounding text) */
  matchContext?: string;

  /** Line numbers where matches occurred */
  lineNumbers?: number[];

  /** Relevance score (0-1) */
  relevance: number;

  /** Type of match */
  matchType: 'filename' | 'content' | 'pattern';
}

/**
 * Options for file search
 */
export interface SearchOptions {
  /** Maximum number of results to return */
  maxResults?: number;

  /** Include file content in results */
  includeContent?: boolean;

  /** File extensions to include (e.g., ['.ts', '.tsx']) */
  extensions?: string[];

  /** Directories to exclude */
  excludeDirs?: string[];

  /** Case-sensitive search */
  caseSensitive?: boolean;
}

// =============================================================================
// FILE READ TYPES
// =============================================================================

/**
 * Result of reading a file
 */
export interface FileReadResult {
  /** File path */
  filePath: string;

  /** File content (may be truncated for large files) */
  content: string;

  /** Whether content was truncated */
  truncated: boolean;

  /** Total lines in file */
  totalLines: number;

  /** Lines read */
  linesRead: number;

  /** File size in bytes */
  size: number;

  /** Read timestamp */
  readAt: number;

  /** Error if read failed */
  error?: string;
}

/**
 * Specification for which file to read
 */
export interface FileToRead {
  /** File path */
  filePath: string;

  /** Reason for reading this file */
  reason: string;

  /** Priority (higher = more important) */
  priority: number;

  /** Specific line range to read (optional) */
  lineRange?: {
    start: number;
    end: number;
  };
}

// =============================================================================
// INVESTIGATION TYPES
// =============================================================================

/**
 * Context for an investigation
 */
export interface InvestigationContext {
  /** User's original prompt */
  prompt: string;

  /** Request mode from classifier */
  mode: 'question' | 'simple' | 'moderate' | 'complex' | 'mega-complex';

  /** Available files in the project */
  projectFiles: string[];

  /** Project file tree (formatted string) */
  fileTree: string;

  /** Detected framework */
  framework?: string;

  /** Detected styling solution */
  styling?: string;

  /** Detected language (TypeScript/JavaScript) */
  language?: {
    primary: 'typescript' | 'javascript';
    hasTsConfig: boolean;
  };

  /** Existing relevant files (already identified) */
  existingRelevantFiles?: Record<string, string>;

  /** Errors to investigate (for debug mode) */
  errors?: string[];
}

/**
 * Files identified for reading
 */
export interface FilesToReadPlan {
  /** Files that must be read */
  required: FileToRead[];

  /** Files that would be helpful to read */
  optional: FileToRead[];

  /** Reasoning for the plan */
  reasoning: string;
}

/**
 * Result of an investigation
 */
export interface InvestigationResult {
  /** Whether investigation was successful */
  success: boolean;

  /** Files that should be read before making changes */
  filesToRead: FilesToReadPlan;

  /** Actual file contents read */
  filesRead: FileReadResult[];

  /** Key findings from the investigation */
  findings: InvestigationFinding[];

  /** Suggested approach based on findings */
  suggestedApproach?: string;

  /** Suggested todos based on findings */
  suggestedTodos?: InvestigationTodo[];

  /** Token usage for the investigation */
  tokenUsage: {
    input: number;
    output: number;
    model: ModelTier;
  };

  /** Investigation duration in ms */
  duration: number;

  /** Error message if investigation failed */
  error?: string;
}

/**
 * A finding from the investigation
 */
export interface InvestigationFinding {
  /** Finding type */
  type: 'pattern' | 'dependency' | 'conflict' | 'opportunity' | 'warning';

  /** Description of the finding */
  description: string;

  /** Relevant file paths */
  files: string[];

  /** Confidence level (0-1) */
  confidence: number;

  /** Actionable suggestion */
  suggestion?: string;
}

/**
 * A todo suggested by the investigation
 */
export interface InvestigationTodo {
  /** Todo content */
  content: string;

  /** Active form for display */
  activeForm: string;

  /** Todo type */
  type: 'investigate' | 'read' | 'plan' | 'execute' | 'verify';

  /** Related files */
  files?: string[];

  /** Suggested model tier */
  model?: ModelTier;
}

// =============================================================================
// INVESTIGATION STRATEGY
// =============================================================================

/**
 * Strategy for different investigation types
 */
export type InvestigationType =
  | 'implementation'  // Investigating for a new feature/change
  | 'error'           // Investigating errors/bugs
  | 'question'        // Investigating to answer a question
  | 'refactor';       // Investigating for refactoring

/**
 * Configuration for investigation behavior
 */
export interface InvestigationConfig {
  /** Maximum files to read */
  maxFilesToRead: number;

  /** Maximum lines per file */
  maxLinesPerFile: number;

  /** Maximum tokens to use */
  maxTokens: number;

  /** Whether to include test files */
  includeTestFiles: boolean;

  /** Whether to follow imports */
  followImports: boolean;

  /** Timeout in ms */
  timeout: number;
}

/**
 * Default investigation configuration
 */
export const DEFAULT_INVESTIGATION_CONFIG: InvestigationConfig = {
  maxFilesToRead: 10,
  maxLinesPerFile: 500,
  maxTokens: 4000,
  includeTestFiles: false,
  followImports: true,
  timeout: 30000,
};

// =============================================================================
// TRACKED READS
// =============================================================================

/**
 * Tracks which files have been read in a session
 * Used to enforce read-before-edit
 */
export interface ReadTracker {
  /** Set of files that have been read */
  filesRead: Set<string>;

  /** Timestamp of when each file was read */
  readTimestamps: Map<string, number>;

  /** Content cache for quick re-reads */
  contentCache: Map<string, string>;
}

/**
 * Create an empty read tracker
 */
export function createReadTracker(): ReadTracker {
  return {
    filesRead: new Set(),
    readTimestamps: new Map(),
    contentCache: new Map(),
  };
}

/**
 * Check if a file has been read
 */
export function hasBeenRead(tracker: ReadTracker, filePath: string): boolean {
  return tracker.filesRead.has(normalizeFilePath(filePath));
}

/**
 * Mark a file as read
 */
export function markAsRead(
  tracker: ReadTracker,
  filePath: string,
  content?: string
): void {
  const normalized = normalizeFilePath(filePath);
  tracker.filesRead.add(normalized);
  tracker.readTimestamps.set(normalized, Date.now());
  if (content) {
    tracker.contentCache.set(normalized, content);
  }
}

/**
 * Get cached content for a file
 */
export function getCachedContent(
  tracker: ReadTracker,
  filePath: string
): string | undefined {
  return tracker.contentCache.get(normalizeFilePath(filePath));
}

/**
 * Normalize file path for consistent comparison
 */
function normalizeFilePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .toLowerCase();
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  SearchResult,
  SearchOptions,
  FileReadResult,
  FileToRead,
  InvestigationContext,
  FilesToReadPlan,
  InvestigationResult,
  InvestigationFinding,
  InvestigationTodo,
  InvestigationType,
  InvestigationConfig,
  ReadTracker,
};
