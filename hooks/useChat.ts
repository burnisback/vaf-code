import { useCallback, useRef } from 'react';
import { useChatStore } from '@/lib/chatStore';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import type { StreamChunk, OrchestratorEventChunk } from '@/lib/ai/types';
import type { OrchestratorEvent } from '@/lib/ai/orchestrator';

/**
 * useChat Hook
 *
 * Custom hook for chat functionality that connects to the AI API.
 * Handles sending messages, streaming responses, and error handling.
 */

interface UseChatOptions {
  onFileOperation?: (operation: { type: string; path: string; content?: string }) => void;
  onToolCall?: (toolCall: { toolName: string; input: Record<string, unknown> }) => void;
  projectFiles?: string[];
  currentFile?: string | null;
  // Rich project context from WebContainer
  projectContext?: {
    fileTree?: string;  // Formatted file tree string
    keyFiles?: Array<{ path: string; content: string }>;
    projectType?: 'nextjs' | 'vite' | 'cra' | 'unknown';
    entryPoint?: string | null;
  };
}

export function useChat(options: UseChatOptions = {}) {
  const {
    conversationId,
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    setConversationId,
    addMessage,
    setLoading,
    setError,
    setStreaming,
    appendStreamingContent,
    clearStreamingContent,
    finalizeStreamingMessage,
    addFileOperation,
    addToolCall,
    clearMessages,
  } = useChatStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Send a message to the AI
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || isStreaming) {
        return;
      }

      // Add user message to store
      addMessage({
        role: 'user',
        content: content.trim(),
      });

      setLoading(true);
      setError(null);
      clearStreamingContent();

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            message: content.trim(),
            conversationId,
            context: {
              projectFiles: options.projectFiles,
              currentFile: options.currentFile,
              // Rich project context
              fileTree: options.projectContext?.fileTree,
              keyFiles: options.projectContext?.keyFiles,
              projectType: options.projectContext?.projectType,
              entryPoint: options.projectContext?.entryPoint,
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error: ${response.status}`);
        }

        // Check if streaming response
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream')) {
          // Handle streaming response
          setStreaming(true);
          await handleStreamingResponse(response);
        } else {
          // Handle JSON response
          const data = await response.json();

          if (data.conversationId) {
            setConversationId(data.conversationId);
          }

          addMessage({
            role: 'assistant',
            content: data.message,
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);

        // Add error message to chat
        addMessage({
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}`,
        });
      } finally {
        setLoading(false);
        setStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [
      conversationId,
      isLoading,
      isStreaming,
      options.projectFiles,
      options.currentFile,
      options.projectContext,
      addMessage,
      setLoading,
      setError,
      setStreaming,
      clearStreamingContent,
      setConversationId,
    ]
  );

  /**
   * Handle streaming response from the API
   */
  const handleStreamingResponse = async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const chunk: StreamChunk = JSON.parse(data);
              handleStreamChunk(chunk);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Finalize the streaming message
      finalizeStreamingMessage();
    } finally {
      reader.releaseLock();
    }
  };

  // Get workflow store for orchestrator events
  const handleOrchestratorEvent = useWorkflowStore((state) => state.handleOrchestratorEvent);

  /**
   * Handle individual stream chunks
   */
  const handleStreamChunk = (chunk: StreamChunk) => {
    switch (chunk.type) {
      case 'text':
        if (chunk.content) {
          appendStreamingContent(chunk.content);
        }
        break;

      case 'tool_call':
        if (chunk.toolCall) {
          addToolCall(chunk.toolCall);
          options.onToolCall?.(chunk.toolCall);
        }
        break;

      case 'file_operation':
        if (chunk.fileOperation) {
          addFileOperation(chunk.fileOperation);
          options.onFileOperation?.(chunk.fileOperation);
        }
        break;

      case 'orchestrator_event':
        if (chunk.orchestratorEvent) {
          // Forward orchestrator events to workflow store
          handleOrchestratorEvent(chunk.orchestratorEvent as OrchestratorEvent);
        }
        break;

      case 'error':
        setError(chunk.error || 'Unknown error');
        break;

      case 'done':
        // Streaming complete
        break;
    }
  };

  /**
   * Cancel the current request
   */
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setStreaming(false);
  }, [setLoading, setStreaming]);

  /**
   * Clear the conversation
   */
  const clearConversation = useCallback(() => {
    cancelRequest();
    clearMessages();
  }, [cancelRequest, clearMessages]);

  return {
    // State
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    conversationId,

    // Actions
    sendMessage,
    cancelRequest,
    clearConversation,

    // Computed
    currentContent: isStreaming ? streamingContent : null,
  };
}
