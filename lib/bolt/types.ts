/**
 * Bolt Playground Types
 *
 * Type definitions for the Bolt-inspired unified generator architecture.
 */

// =============================================================================
// WEBCONTAINER TYPES
// =============================================================================

export type BoltLoadingState =
  | 'idle'
  | 'booting'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error';

export interface BoltWebContainerState {
  isBooting: boolean;
  isReady: boolean;
  error: string | null;
  previewUrl: string | null;
  loadingState: BoltLoadingState;
  loadingMessage: string;
}

// =============================================================================
// FILE SYSTEM TYPES
// =============================================================================

export interface BoltFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: BoltFileNode[];
  isExpanded?: boolean;
}

export interface BoltOpenFile {
  path: string;
  name: string;
  content?: string;
  isDirty?: boolean;
}

// =============================================================================
// CHAT TYPES
// =============================================================================

export interface BoltChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actions?: BoltAction[];
  status?: 'streaming' | 'complete' | 'error';
}

// =============================================================================
// ARTIFACT TYPES (from AI response)
// =============================================================================

export interface BoltArtifact {
  id: string;
  title: string;
  actions: BoltAction[];
}

export interface BoltAction {
  type: 'file' | 'shell' | 'delete';
  filePath?: string;
  content: string;
  status?: 'pending' | 'executing' | 'success' | 'error' | 'blocked';
  error?: string;
  /** File operation type for file actions */
  operation?: 'create' | 'modify' | 'delete';
  /** Output from shell commands */
  output?: string;
  /** Reason why action was blocked (for destructive commands) */
  blockedReason?: string;
  /** Files that reference this file (for delete safety check) */
  referencedBy?: string[];
}

// =============================================================================
// EXECUTION TYPES
// =============================================================================

export interface BoltExecutionResult {
  type: 'file' | 'shell' | 'delete';
  path?: string;
  command?: string;
  success: boolean;
  error?: string;
  exitCode?: number;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface BoltGenerateRequest {
  prompt: string;
  projectContext: BoltProjectContext;
  conversationHistory?: { role: string; content: string }[];
}

export interface BoltProjectContext {
  fileTree: string;
  framework: string;
  styling: string;
  language?: ProjectLanguageInfo;
  existingFiles?: { path: string; content: string }[];
}

export interface ProjectLanguageInfo {
  primary: 'typescript' | 'javascript';
  hasTypeScript: boolean;
  hasJavaScript: boolean;
  hasTsConfig: boolean;
  fileExtensions: {
    components: '.tsx' | '.jsx';
    modules: '.ts' | '.js';
  };
}

export interface BoltStreamChunk {
  type: 'text' | 'action' | 'done' | 'error';
  content?: string;
  action?: {
    type: 'file' | 'shell';
    filePath?: string;
    content: string;
  };
  message?: string;
}

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

export interface BoltTemplate {
  id: string;
  name: string;
  description: string;
  framework: string;
  styling: string;
  startCommand: string;
  files: Record<string, string | { file: { contents: string } } | { directory: Record<string, any> }>;
}

// =============================================================================
// RUNTIME ERROR TYPES
// =============================================================================

export type RuntimeErrorType =
  | 'uncaught_error'
  | 'unhandled_rejection'
  | 'console_error'
  | 'react_error'
  | 'network_error';

export interface RuntimeError {
  id: string;
  type: RuntimeErrorType;
  message: string;
  stack?: string;
  componentStack?: string;  // React-specific
  source?: string;          // File path
  line?: number;
  column?: number;
  url?: string;             // For network errors
  timestamp: number;
  /** How many times this exact error has occurred */
  occurrenceCount: number;
}

// =============================================================================
// DEBUG SESSION TYPES
// =============================================================================

export type DebugSessionStatus =
  | 'idle'
  | 'detecting'
  | 'analyzing'
  | 'fixing'
  | 'verifying'
  | 'resolved'
  | 'failed';

export interface DebugSession {
  id: string;
  status: DebugSessionStatus;
  currentError: RuntimeError | null;
  fixAttempts: FixAttempt[];
  startedAt: number;
  resolvedAt?: number;
  /** Max attempts before giving up (default: 3) */
  maxAttempts: number;
}

export interface FixAttempt {
  id: string;
  attemptNumber: number;
  error: RuntimeError;
  analysis: ErrorAnalysis;
  proposedFix: BoltAction[];
  status: 'pending' | 'applied' | 'verified' | 'failed';
  verificationResult?: VerificationResult;
  timestamp: number;
}

export interface ErrorAnalysis {
  rootCause: string;
  affectedFiles: string[];
  suggestedApproach: string;
  confidence: 'high' | 'medium' | 'low';
  relatedPatterns?: string[];  // Similar patterns in codebase
}

export interface VerificationResult {
  success: boolean;
  errorsRemaining: RuntimeError[];
  newErrorsIntroduced: RuntimeError[];
  message: string;
}

// =============================================================================
// DEBUG CONTEXT TYPES
// =============================================================================

export interface DebugContext {
  previousAttempts: FixAttempt[];
  projectFiles: { path: string; content: string }[];
  errorHistory: RuntimeError[];
}

export interface ProjectPatterns {
  framework: string;
  styling: string;
  stateManagement?: string;
  conventions: string[];
  examples: { description: string; code: string }[];
}
