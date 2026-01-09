import { z } from 'genkit';

/**
 * AI Types - TypeScript interfaces for the Agentic Factory chat system
 */

// Message roles
export type MessageRole = 'user' | 'assistant' | 'system';

// Chat message schema
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// File operation types
export type FileOperationType = 'create' | 'update' | 'delete';

export const fileOperationSchema = z.object({
  type: z.enum(['create', 'update', 'delete']),
  path: z.string(),
  content: z.string().optional(),
});

export type FileOperation = z.infer<typeof fileOperationSchema>;

// Tool call schema
export const toolCallSchema = z.object({
  toolName: z.string(),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).optional(),
  status: z.enum(['pending', 'executing', 'completed', 'failed']),
  error: z.string().optional(),
});

export type ToolCall = z.infer<typeof toolCallSchema>;

// Chat request schema
export const chatRequestSchema = z.object({
  message: z.string(),
  conversationId: z.string().optional(),
  context: z.object({
    projectFiles: z.array(z.string()).optional(),
    currentFile: z.string().optional(),
    template: z.string().optional(),
    // Rich project context from WebContainer scanning
    fileTree: z.string().optional(),
    keyFiles: z.array(z.object({
      path: z.string(),
      content: z.string(),
    })).optional(),
    projectType: z.string().optional(),
    entryPoint: z.string().optional(),
  }).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// Chat response schema
export const chatResponseSchema = z.object({
  message: z.string(),
  conversationId: z.string(),
  toolCalls: z.array(toolCallSchema).optional(),
  fileOperations: z.array(fileOperationSchema).optional(),
  isComplete: z.boolean(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

// Streaming chunk types
export type StreamChunkType = 'text' | 'tool_call' | 'file_operation' | 'orchestrator_event' | 'error' | 'done';

// Orchestrator event for workflow visualization
export const orchestratorEventSchema = z.object({
  type: z.enum(['STATE_CHANGE', 'AGENT_INVOKED', 'AGENT_RESPONSE', 'EVALUATION', 'FILE_OPERATION', 'COMPLETE', 'ERROR']),
  state: z.string().optional(),
  phase: z.string().optional(),
  agent: z.string().optional(),
  step: z.record(z.unknown()).optional(),
  response: z.record(z.unknown()).optional(),
  result: z.record(z.unknown()).optional(),
  operation: z.record(z.unknown()).optional(),
  status: z.string().optional(),
  success: z.boolean().optional(),
  error: z.record(z.unknown()).optional(),
});

export type OrchestratorEventChunk = z.infer<typeof orchestratorEventSchema>;

export const streamChunkSchema = z.object({
  type: z.enum(['text', 'tool_call', 'file_operation', 'orchestrator_event', 'error', 'done']),
  content: z.string().optional(),
  toolCall: toolCallSchema.optional(),
  fileOperation: fileOperationSchema.optional(),
  orchestratorEvent: orchestratorEventSchema.optional(),
  error: z.string().optional(),
});

export type StreamChunk = z.infer<typeof streamChunkSchema>;

// Conversation context
export interface ConversationContext {
  conversationId: string;
  messages: ChatMessage[];
  projectFiles: string[];
  currentFile: string | null;
  createdAt: string;
  updatedAt: string;
  // Project context from WebContainer
  fileTree?: FileNode[];
  keyFileContents?: KeyFileContent[];
  projectType?: 'nextjs' | 'vite' | 'cra' | 'unknown';
  suggestedEntryPoint?: string | null;
}

// File tree node for project structure
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  extension?: string;
}

// Key file content for AI context
export interface KeyFileContent {
  path: string;
  content: string;
  truncated: boolean;
}

// Agent response for internal use
export interface AgentResponse {
  text: string;
  toolCalls: ToolCall[];
  fileOperations: FileOperation[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

// ============================================
// FILE OPERATIONS V2 - VAF Specification Aligned
// ============================================

/** Write operation - creates new file or full replacement */
export interface WriteOperation {
  type: 'write';
  path: string;
  content: string;
  description: string;
}

/** Edit operation - surgical changes with old/new content */
export interface EditOperation {
  type: 'edit';
  path: string;
  edits: Array<{
    oldContent: string;
    newContent: string;
    context?: string;
  }>;
  description: string;
}

/** Delete operation */
export interface DeleteOperation {
  type: 'delete';
  path: string;
  reason: string;
}

/** Union of all file operations */
export type FileOperationV2 = WriteOperation | EditOperation | DeleteOperation;

// ============================================
// SELF-VALIDATION
// ============================================

export interface SelfCheck {
  meetsAcceptanceCriteria: boolean;
  criteriaStatus: Array<{
    criterion: string;
    met: boolean;
    evidence: string;
  }>;
  risks: string[];
}

// ============================================
// STATUS PHASES (for visual feedback)
// ============================================

export type OperationPhase =
  | 'analyzing'
  | 'planning'
  | 'implementing'
  | 'verifying'
  | 'complete'
  | 'error';

export interface PhaseStatus {
  phase: OperationPhase;
  message: string;
  progress?: {
    current: number;
    total: number;
  };
}

// ============================================
// ENHANCED STREAM CHUNK V2
// ============================================

export interface StreamChunkV2 {
  type: 'text' | 'file_operation' | 'status' | 'self_check' | 'error' | 'done';
  content?: string;
  operation?: FileOperationV2;
  status?: PhaseStatus;
  selfCheck?: SelfCheck;
  error?: {
    code: StreamErrorCode;
    message: string;
    recoverable: boolean;
    suggestedAction?: string;
  };
}

export type StreamErrorCode =
  | 'PARSE_ERROR'
  | 'EDIT_NO_MATCH'
  | 'EDIT_AMBIGUOUS'
  | 'FILE_NOT_FOUND'
  | 'WRITE_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT';

// ============================================
// EXECUTION RESULT
// ============================================

export interface ExecutionResult {
  operationId: string;
  operation: FileOperationV2;
  status: 'pending' | 'executing' | 'success' | 'error';
  startTime: number;
  endTime?: number;
  error?: string;
}

export interface BatchExecutionResult {
  results: ExecutionResult[];
  totalTime: number;
  successCount: number;
  errorCount: number;
}
