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
  type: 'file' | 'shell';
  filePath?: string;
  content: string;
  status?: 'pending' | 'executing' | 'success' | 'error';
  error?: string;
}

// =============================================================================
// EXECUTION TYPES
// =============================================================================

export interface BoltExecutionResult {
  type: 'file' | 'shell';
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
  existingFiles?: { path: string; content: string }[];
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
