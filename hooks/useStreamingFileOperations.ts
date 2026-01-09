'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebContainer } from '@/lib/webcontainer/context';
import type {
  StreamChunkV2,
  FileOperationV2,
  OperationPhase,
  ExecutionResult,
  BatchExecutionResult
} from '@/lib/ai/types';
import {
  initializeExecutor,
  executeFileOperation,
  isConfigFile,
  getConfigChangeType
} from '@/lib/ai/executor';

/**
 * useStreamingFileOperations Hook
 *
 * Connects streaming AI responses to WebContainer for live code updates.
 * Handles file operations, HMR triggering, and dev server restarts.
 */

export interface StreamingState {
  phase: OperationPhase;
  phaseMessage: string;
  textContent: string;
  operations: FileOperationV2[];
  executionResults: Map<string, ExecutionResult>;
  isStreaming: boolean;
  error: string | null;
}

export interface UseStreamingFileOperationsReturn {
  state: StreamingState;
  processChunk: (chunk: StreamChunkV2) => Promise<void>;
  startStreaming: () => void;
  endStreaming: () => void;
  reset: () => void;
  retryOperation: (operation: FileOperationV2) => Promise<void>;
}

const initialState: StreamingState = {
  phase: 'analyzing',
  phaseMessage: 'Analyzing request...',
  textContent: '',
  operations: [],
  executionResults: new Map(),
  isStreaming: false,
  error: null
};

export function useStreamingFileOperations(): UseStreamingFileOperationsReturn {
  const { webcontainer, triggerFilesystemRefresh, writeToTerminal } = useWebContainer();
  const [state, setState] = useState<StreamingState>(initialState);
  const executorInitialized = useRef(false);
  const pendingRestartRef = useRef(false);

  // Initialize executor when webcontainer is available
  useEffect(() => {
    if (webcontainer && !executorInitialized.current) {
      initializeExecutor(webcontainer);
      executorInitialized.current = true;
    }
  }, [webcontainer]);

  /**
   * Start a new streaming session
   */
  const startStreaming = useCallback(() => {
    setState({
      ...initialState,
      isStreaming: true
    });
  }, []);

  /**
   * End the streaming session
   */
  const endStreaming = useCallback(() => {
    setState(prev => ({
      ...prev,
      isStreaming: false,
      phase: 'complete',
      phaseMessage: 'Complete!'
    }));

    // Handle any pending restarts
    if (pendingRestartRef.current) {
      pendingRestartRef.current = false;
      writeToTerminal?.('\r\n\x1b[33m⚠ Config files changed. You may need to restart the dev server.\x1b[0m\r\n');
    }
  }, [writeToTerminal]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState(initialState);
    pendingRestartRef.current = false;
  }, []);

  /**
   * Execute a file operation against WebContainer
   */
  const executeOperation = useCallback(async (operation: FileOperationV2): Promise<ExecutionResult> => {
    if (!webcontainer) {
      return {
        operationId: `op-${Date.now()}`,
        operation,
        status: 'error',
        startTime: Date.now(),
        endTime: Date.now(),
        error: 'WebContainer not available'
      };
    }

    // Log to terminal
    const opType = operation.type.toUpperCase();
    writeToTerminal?.(`\x1b[36m[${opType}]\x1b[0m ${operation.path}\r\n`);

    // Execute the operation
    const result = await executeFileOperation(operation);

    // Log result
    if (result.status === 'success') {
      writeToTerminal?.(`\x1b[32m  ✓ Success\x1b[0m (${result.endTime! - result.startTime}ms)\r\n`);

      // Check if config file changed
      if (isConfigFile(operation.path)) {
        const changeType = getConfigChangeType(operation.path);
        if (changeType === 'restart') {
          pendingRestartRef.current = true;
          writeToTerminal?.(`\x1b[33m  ⚠ Config file changed - restart may be needed\x1b[0m\r\n`);
        }
      }

      // Trigger filesystem refresh for HMR
      triggerFilesystemRefresh();
    } else {
      writeToTerminal?.(`\x1b[31m  ✗ Error: ${result.error}\x1b[0m\r\n`);
    }

    return result;
  }, [webcontainer, triggerFilesystemRefresh, writeToTerminal]);

  /**
   * Process a streaming chunk
   */
  const processChunk = useCallback(async (chunk: StreamChunkV2) => {
    switch (chunk.type) {
      case 'text':
        if (chunk.content) {
          setState(prev => ({
            ...prev,
            textContent: prev.textContent + chunk.content
          }));
        }
        break;

      case 'status':
        if (chunk.status) {
          setState(prev => ({
            ...prev,
            phase: chunk.status!.phase,
            phaseMessage: chunk.status!.message
          }));
        }
        break;

      case 'file_operation':
        if (chunk.operation) {
          // Add operation to list
          setState(prev => ({
            ...prev,
            operations: [...prev.operations, chunk.operation!]
          }));

          // Execute the operation
          const result = await executeOperation(chunk.operation);

          // Update results
          setState(prev => {
            const newResults = new Map(prev.executionResults);
            newResults.set(chunk.operation!.path, result);
            return {
              ...prev,
              executionResults: newResults
            };
          });
        }
        break;

      case 'error':
        if (chunk.error) {
          setState(prev => ({
            ...prev,
            error: chunk.error!.message,
            phase: 'error',
            phaseMessage: chunk.error!.message
          }));
        }
        break;

      case 'done':
        endStreaming();
        break;
    }
  }, [executeOperation, endStreaming]);

  /**
   * Retry a failed operation
   */
  const retryOperation = useCallback(async (operation: FileOperationV2) => {
    const result = await executeOperation(operation);

    setState(prev => {
      const newResults = new Map(prev.executionResults);
      newResults.set(operation.path, result);
      return {
        ...prev,
        executionResults: newResults
      };
    });
  }, [executeOperation]);

  return {
    state,
    processChunk,
    startStreaming,
    endStreaming,
    reset,
    retryOperation
  };
}

/**
 * Parse SSE stream and yield V2 chunks
 */
export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<StreamChunkV2, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE messages
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const chunk = JSON.parse(jsonStr) as StreamChunkV2;
            yield chunk;
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }
  }
}
