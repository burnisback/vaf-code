/**
 * Streaming Response Handler
 *
 * Utilities for handling streaming responses from the AI model.
 * Supports text streaming, tool calls, and file operations.
 * V2: Enhanced with structured file operations and status phases.
 */

import type {
  StreamChunk,
  ToolCall,
  FileOperation,
  StreamChunkV2,
  FileOperationV2,
  PhaseStatus,
  OperationPhase,
  StreamErrorCode
} from './types';
import { parseFileOperations, hasFileOperations } from './parser/fileOperations';

/**
 * Create a streaming response for the chat API
 * Uses Server-Sent Events (SSE) format
 */
export function createStreamingResponse(
  stream: ReadableStream<Uint8Array>
): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Encode a stream chunk as SSE format
 */
export function encodeStreamChunk(chunk: StreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Encode a V2 stream chunk as SSE format
 */
export function encodeStreamChunkV2(chunk: StreamChunkV2): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Create a text stream encoder
 */
export function createTextEncoder(): TextEncoder {
  return new TextEncoder();
}

/**
 * Parse an SSE stream chunk
 */
export function parseStreamChunk(data: string): StreamChunk | null {
  try {
    // Remove 'data: ' prefix if present
    const jsonStr = data.startsWith('data: ') ? data.slice(6) : data;
    if (!jsonStr.trim() || jsonStr.trim() === '[DONE]') {
      return null;
    }
    return JSON.parse(jsonStr) as StreamChunk;
  } catch {
    return null;
  }
}

/**
 * Create a readable stream that yields chunks from an async generator
 */
export function createReadableStreamFromGenerator(
  generator: AsyncGenerator<StreamChunk, void, unknown>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await generator.next();

        if (done) {
          // Send done signal
          controller.enqueue(encoder.encode(encodeStreamChunk({ type: 'done' })));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(encodeStreamChunk(value)));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(encodeStreamChunk({ type: 'error', error: errorMessage }))
        );
        controller.close();
      }
    },
  });
}

/**
 * Handle a tool call from the AI model
 * This is a placeholder that will be connected to the WebContainer
 */
export async function handleToolCall(
  toolCall: ToolCall,
  executeToolFn?: (name: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>
): Promise<ToolCall> {
  if (!executeToolFn) {
    return {
      ...toolCall,
      status: 'failed',
      error: 'Tool execution not available',
    };
  }

  try {
    const output = await executeToolFn(toolCall.toolName, toolCall.input);
    return {
      ...toolCall,
      output,
      status: 'completed',
    };
  } catch (error) {
    return {
      ...toolCall,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}

/**
 * Process file operations from AI response
 */
export function extractFileOperations(
  text: string
): FileOperation[] {
  const operations: FileOperation[] = [];

  // Look for file operation markers in the response
  // Format: <<<FILE:path>>>content<<<END_FILE>>>
  const filePattern = /<<<FILE:(create|update|delete):([^>]+)>>>([\s\S]*?)<<<END_FILE>>>/g;

  let match;
  while ((match = filePattern.exec(text)) !== null) {
    const [, type, path, content] = match;
    operations.push({
      type: type as 'create' | 'update' | 'delete',
      path: path.trim(),
      content: type !== 'delete' ? content : undefined,
    });
  }

  return operations;
}

/**
 * Create an async generator that yields text chunks with a typing effect
 */
export async function* createTypingStream(
  text: string,
  delayMs: number = 10
): AsyncGenerator<StreamChunk, void, unknown> {
  const words = text.split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const content = i === 0 ? word : ' ' + word;

    yield { type: 'text', content };

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// ============================================
// V2 STREAMING - Enhanced File Operations
// ============================================

/**
 * Process AI response text and extract V2 file operations
 * Uses the new JSON-based format: <<<FILE_OPERATION>>>...<<<END_FILE_OPERATION>>>
 */
export function extractFileOperationsV2(text: string): {
  operations: FileOperationV2[];
  textContent: string;
  errors: Array<{ index: number; error: string }>;
} {
  const result = parseFileOperations(text);
  return {
    operations: result.operations,
    textContent: result.textWithoutOps,
    errors: result.errors.map(e => ({ index: e.index, error: e.error }))
  };
}

/**
 * Create a status phase chunk
 */
export function createStatusChunk(
  phase: OperationPhase,
  message: string,
  progress?: { current: number; total: number }
): StreamChunkV2 {
  return {
    type: 'status',
    status: { phase, message, progress }
  };
}

/**
 * Create a file operation chunk
 */
export function createOperationChunk(operation: FileOperationV2): StreamChunkV2 {
  return {
    type: 'file_operation',
    operation
  };
}

/**
 * Create an error chunk with recovery information
 */
export function createErrorChunk(
  code: StreamErrorCode,
  message: string,
  recoverable: boolean = true,
  suggestedAction?: string
): StreamChunkV2 {
  return {
    type: 'error',
    error: { code, message, recoverable, suggestedAction }
  };
}

/**
 * Create a readable stream from V2 async generator
 */
export function createReadableStreamFromV2Generator(
  generator: AsyncGenerator<StreamChunkV2, void, unknown>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await generator.next();

        if (done) {
          controller.enqueue(encoder.encode(encodeStreamChunkV2({ type: 'done' })));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(encodeStreamChunkV2(value)));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(encodeStreamChunkV2(createErrorChunk('NETWORK_ERROR', errorMessage, false)))
        );
        controller.close();
      }
    },
  });
}

/**
 * Process streaming text and yield V2 chunks with file operations extracted
 * This is the main entry point for processing AI responses
 */
export async function* processStreamingResponseV2(
  textStream: AsyncIterable<string>,
  onPhaseChange?: (phase: OperationPhase) => void
): AsyncGenerator<StreamChunkV2, void, unknown> {
  let buffer = '';
  let currentPhase: OperationPhase = 'analyzing';

  // Emit initial status
  yield createStatusChunk(currentPhase, 'Analyzing request...');
  onPhaseChange?.(currentPhase);

  for await (const chunk of textStream) {
    buffer += chunk;

    // Check if we have complete file operations
    if (hasFileOperations(buffer)) {
      // Update phase to implementing
      if (currentPhase !== 'implementing') {
        currentPhase = 'implementing';
        yield createStatusChunk(currentPhase, 'Implementing changes...');
        onPhaseChange?.(currentPhase);
      }

      // Extract and yield file operations
      const { operations, textContent, errors } = extractFileOperationsV2(buffer);

      // Yield any text before operations
      if (textContent) {
        yield { type: 'text', content: textContent };
      }

      // Yield each operation
      for (const op of operations) {
        yield createOperationChunk(op);
      }

      // Yield any parse errors
      for (const err of errors) {
        yield createErrorChunk('PARSE_ERROR', err.error, true, 'Check AI response format');
      }

      // Clear buffer after processing
      buffer = '';
    } else {
      // Detect phase from content patterns
      if (buffer.includes('analyzing') || buffer.includes('understanding')) {
        if (currentPhase !== 'analyzing') {
          currentPhase = 'analyzing';
          yield createStatusChunk(currentPhase, 'Analyzing request...');
          onPhaseChange?.(currentPhase);
        }
      } else if (buffer.includes('planning') || buffer.includes('approach')) {
        if (currentPhase !== 'planning') {
          currentPhase = 'planning';
          yield createStatusChunk(currentPhase, 'Planning implementation...');
          onPhaseChange?.(currentPhase);
        }
      }

      // Yield text chunk
      yield { type: 'text', content: chunk };
    }
  }

  // Final verification phase
  currentPhase = 'verifying';
  yield createStatusChunk(currentPhase, 'Verifying changes...');
  onPhaseChange?.(currentPhase);

  // Complete
  currentPhase = 'complete';
  yield createStatusChunk(currentPhase, 'Complete');
  onPhaseChange?.(currentPhase);
}

/**
 * Check if text contains V2 file operations
 */
export function hasFileOperationsV2(text: string): boolean {
  return hasFileOperations(text);
}
