/**
 * useBoltChat Hook
 *
 * Manages chat state and integrates with the bolt-generate API.
 * Handles SSE streaming, action execution, and message management.
 *
 * Phase 5 Enhancements:
 * - Action queue with ordered execution
 * - File backup and rollback capability
 * - Execution history tracking
 * - Enhanced progress indicators
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { WebContainer } from '@webcontainer/api';
import type { BoltChatMessage, BoltAction, BoltStreamChunk } from '@/lib/bolt/types';
import {
  buildFileTree,
  getRelevantFiles,
  detectFramework,
  detectStyling,
} from '@/lib/bolt/webcontainer/fileTree';
import {
  ActionQueue,
  type ExecutionHistoryEntry,
  type QueuedAction,
} from '@/lib/bolt/execution';

// =============================================================================
// TYPES
// =============================================================================

export interface UseBoltChatOptions {
  webcontainer: WebContainer | null;
  onFilesystemChange?: () => void;
  onTerminalOutput?: (data: string) => void;
}

export interface BuildError {
  message: string;
  file?: string;
  line?: number;
  timestamp: number;
}

export interface UseBoltChatReturn {
  messages: BoltChatMessage[];
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  pendingActions: BoltAction[];
  executionHistory: ExecutionHistoryEntry[];
  buildErrors: BuildError[];
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
  rollbackAction: (actionId: string) => Promise<boolean>;
  rollbackAll: () => Promise<number>;
  retryFailedAction: (actionId: string) => Promise<boolean>;
  clearHistory: () => void;
  clearBuildErrors: () => void;
  fixBuildErrors: () => Promise<void>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parse terminal output for build/compile errors
 * Returns detected errors or empty array
 */
function detectBuildErrors(output: string): BuildError[] {
  const errors: BuildError[] = [];
  const timestamp = Date.now();

  // Strip ANSI codes for parsing
  const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');

  // Common error patterns
  const errorPatterns = [
    // TypeScript/JavaScript errors
    /(?:error|Error)(?:\s+TS\d+)?:\s*(.+?)(?:\n|$)/gi,
    // Module not found
    /Module not found:\s*(.+?)(?:\n|$)/gi,
    // Cannot find module
    /Cannot find module\s*['"](.+?)['"]/gi,
    // Syntax errors
    /SyntaxError:\s*(.+?)(?:\n|$)/gi,
    // Reference errors
    /ReferenceError:\s*(.+?)(?:\n|$)/gi,
    // Build failed
    /(?:Build|Compilation)\s+failed[:\s]*(.+)?(?:\n|$)/gi,
    // File path errors (e.g., ./src/components/Button.tsx:10:5)
    /(?:\.\/)?([^\s:]+\.(?:tsx?|jsx?|css|scss)):(\d+)(?::\d+)?[\s:]+(?:error|Error)[:\s]*(.+?)(?:\n|$)/gi,
  ];

  for (const pattern of errorPatterns) {
    let match;
    while ((match = pattern.exec(cleanOutput)) !== null) {
      // Check if this looks like a file path error
      if (match[2] && match[3]) {
        errors.push({
          message: match[3].trim(),
          file: match[1],
          line: parseInt(match[2], 10),
          timestamp,
        });
      } else {
        errors.push({
          message: match[1]?.trim() || 'Build error detected',
          timestamp,
        });
      }
    }
  }

  // Deduplicate errors by message
  const seen = new Set<string>();
  return errors.filter((err) => {
    const key = `${err.message}-${err.file || ''}-${err.line || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onText: (text: string) => void,
  onAction: (action: BoltAction) => void,
  onDone: () => void,
  onError: (message: string) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(line.slice(6)) as BoltStreamChunk;

          switch (data.type) {
            case 'text':
              if (data.content) {
                onText(data.content);
              }
              break;

            case 'action':
              if (data.action) {
                onAction({
                  type: data.action.type,
                  filePath: data.action.filePath,
                  content: data.action.content,
                  status: 'pending',
                });
              }
              break;

            case 'done':
              onDone();
              return; // Exit the entire function

            case 'error':
              onError(data.message || 'Unknown error');
              return; // Exit on error too
          }
        } catch (parseError) {
          console.warn('[useBoltChat] Failed to parse SSE line:', line);
        }
      }
    }
  } catch (error) {
    console.error('[useBoltChat] Stream reading error:', error);
    onError(error instanceof Error ? error.message : 'Stream reading failed');
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useBoltChat({
  webcontainer,
  onFilesystemChange,
  onTerminalOutput,
}: UseBoltChatOptions): UseBoltChatReturn {
  const [messages, setMessages] = useState<BoltChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<BoltAction[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryEntry[]>([]);
  const [buildErrors, setBuildErrors] = useState<BuildError[]>([]);

  const lastPromptRef = useRef<string>('');
  const actionQueueRef = useRef<ActionQueue | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const terminalBufferRef = useRef<string>('');

  // Create action queue once and update callbacks via ref
  // This ensures the same instance persists across renders to preserve history
  if (!actionQueueRef.current) {
    actionQueueRef.current = new ActionQueue(null, {});
  }
  const actionQueue = actionQueueRef.current;

  /**
   * Handle terminal output - detect build errors
   */
  const handleTerminalOutput = useCallback(
    (data: string) => {
      // Forward to original callback
      onTerminalOutput?.(data);

      // Buffer terminal output for error detection
      terminalBufferRef.current += data;

      // Check for errors in the buffer
      const errors = detectBuildErrors(terminalBufferRef.current);
      if (errors.length > 0) {
        setBuildErrors((prev) => {
          // Only add new errors
          const newErrors = errors.filter(
            (e) => !prev.some((p) => p.message === e.message && p.file === e.file)
          );
          return newErrors.length > 0 ? [...prev, ...newErrors] : prev;
        });
      }

      // Clear buffer periodically to avoid memory buildup (keep last 2000 chars)
      if (terminalBufferRef.current.length > 4000) {
        terminalBufferRef.current = terminalBufferRef.current.slice(-2000);
      }
    },
    [onTerminalOutput]
  );

  // Update webcontainer and callbacks when they change
  useEffect(() => {
    actionQueue.setWebContainer(webcontainer);
    actionQueue.setCallbacks({
      onProgress: setLoadingMessage,
      onFilesystemChange,
      onTerminalOutput: handleTerminalOutput,
      onActionStart: (action) => {
        setPendingActions((prev) =>
          prev.map((a) =>
            a.filePath === action.filePath && a.type === action.type
              ? { ...a, status: 'executing' }
              : a
          )
        );
      },
      onActionComplete: (action, result) => {
        setPendingActions((prev) =>
          prev.map((a) =>
            a.filePath === action.filePath && a.type === action.type
              ? { ...a, status: result.success ? 'success' : 'error' }
              : a
          )
        );
        // Update history from the stable actionQueue instance
        setExecutionHistory(actionQueueRef.current?.getHistory() || []);
      },
      onActionError: (action, errorMsg) => {
        setPendingActions((prev) =>
          prev.map((a) =>
            a.filePath === action.filePath && a.type === action.type
              ? { ...a, status: 'error', error: errorMsg }
              : a
          )
        );
      },
    });
  }, [webcontainer, onFilesystemChange, handleTerminalOutput]);

  /**
   * Execute actions through the queue
   */
  const executeActions = useCallback(
    async (actions: BoltAction[]): Promise<BoltAction[]> => {
      const queuedActions = actionQueue.enqueue(actions);

      // Wait for all to complete
      return new Promise((resolve) => {
        const checkComplete = setInterval(() => {
          if (!actionQueue.isExecuting() && actionQueue.getPendingCount() === 0) {
            clearInterval(checkComplete);
            const state = actionQueue.getState();
            const results = [...state.completed, ...state.failed].map((qa) => ({
              type: qa.type,
              filePath: qa.filePath,
              content: qa.content,
              status: qa.status,
              error: qa.error,
            }));
            resolve(results);
          }
        }, 100);
      });
    },
    [actionQueue]
  );

  /**
   * Rollback a specific action and notify the conversation
   */
  const rollbackAction = useCallback(
    async (actionId: string): Promise<boolean> => {
      // Get the action details before rollback
      const history = actionQueue.getHistory();
      const entry = history.find((h) => h.id === actionId);

      const success = await actionQueue.rollback(actionId);
      if (success && entry?.action.filePath) {
        setExecutionHistory(actionQueue.getHistory());

        // Add a system message to notify the AI about the rollback
        const rollbackMessage: BoltChatMessage = {
          id: generateId(),
          role: 'user',
          content: `[SYSTEM NOTE: The file "${entry.action.filePath}" was just undone/rolled back and NO LONGER EXISTS in the project. Please do not reference or import this file in future responses. The file tree has been updated.]`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, rollbackMessage]);
      }
      return success;
    },
    [actionQueue]
  );

  /**
   * Rollback all recent actions and notify the conversation
   */
  const rollbackAll = useCallback(async (): Promise<number> => {
    // Get all rollbackable entries before rollback
    const history = actionQueue.getHistory();
    const rollbackable = history.filter((h) => h.canRollback);
    const filePaths = rollbackable
      .map((h) => h.action.filePath)
      .filter(Boolean) as string[];

    const count = await actionQueue.rollbackAll();
    setExecutionHistory(actionQueue.getHistory());

    // Add a system message to notify the AI about the rollbacks
    if (count > 0 && filePaths.length > 0) {
      const fileList = filePaths.map((f) => `- ${f}`).join('\n');
      const rollbackMessage: BoltChatMessage = {
        id: generateId(),
        role: 'user',
        content: `[SYSTEM NOTE: The following ${count} file(s) were just undone/rolled back and NO LONGER EXIST in the project:\n${fileList}\n\nPlease do not reference or import these files in future responses. The file tree has been updated to reflect current state.]`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, rollbackMessage]);
    }

    return count;
  }, [actionQueue]);

  /**
   * Clear execution history
   */
  const clearHistory = useCallback(() => {
    actionQueue.clearHistory();
    setExecutionHistory([]);
  }, [actionQueue]);

  /**
   * Retry a failed action
   */
  const retryFailedAction = useCallback(
    async (actionId: string): Promise<boolean> => {
      const success = await actionQueue.retryAction(actionId);
      if (success) {
        setExecutionHistory(actionQueue.getHistory());
      }
      return success;
    },
    [actionQueue]
  );

  /**
   * Send a message to the AI
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || !webcontainer) return;

      // Cancel any existing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const userMessage: BoltChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      lastPromptRef.current = content.trim();
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);
      setPendingActions([]);

      try {
        setLoadingMessage('Building project context...');

        // Build project context
        const fileTree = await buildFileTree(webcontainer);
        const framework = detectFramework(fileTree);
        const styling = detectStyling(fileTree);
        const existingFiles = await getRelevantFiles(webcontainer, content.trim());

        const projectContext = {
          fileTree,
          framework,
          styling,
          existingFiles,
        };

        // Build conversation history (last 10 messages)
        const conversationHistory = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        setLoadingMessage('Generating code...');

        // Call the API
        const response = await fetch('/api/bolt-generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            prompt: content.trim(),
            projectContext,
            conversationHistory,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        // Create assistant message placeholder
        const assistantMessage: BoltChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          actions: [],
          status: 'streaming',
        };

        setMessages((prev) => [...prev, assistantMessage]);

        let fullContent = '';
        const collectedActions: BoltAction[] = [];

        // Parse SSE stream
        await parseSSEStream(
          reader,
          // onText
          (text) => {
            fullContent += text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id ? { ...m, content: fullContent } : m
              )
            );
          },
          // onAction
          (action) => {
            collectedActions.push(action);
            setPendingActions([...collectedActions]);
          },
          // onDone
          () => {
            setLoadingMessage('');
          },
          // onError
          (errorMessage) => {
            setError(errorMessage);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id ? { ...m, status: 'error' } : m
              )
            );
          }
        );

        // Execute all collected actions using the action queue
        if (collectedActions.length > 0) {
          setLoadingMessage('Executing actions...');
          onTerminalOutput?.(`\r\n\x1b[36m[Bolt] Executing ${collectedActions.length} action(s)...\x1b[0m\r\n`);

          // Clear the queue state before new execution
          actionQueue.clearCompleted();

          // Execute through the queue (handles backup, progress, etc.)
          const executedActions = await executeActions(collectedActions);

          // Update assistant message with executed actions
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, actions: executedActions, status: 'complete' }
                : m
            )
          );

          // Update execution history
          setExecutionHistory(actionQueue.getHistory());

          onTerminalOutput?.(`\x1b[32m[Bolt] ✓ All actions completed\x1b[0m\r\n`);
        } else {
          // No actions, just mark as complete
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id ? { ...m, status: 'complete' } : m
            )
          );
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[useBoltChat] Request aborted');
          return;
        }

        console.error('[useBoltChat] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');

        // Add error message
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.status === 'streaming') {
            return prev.map((m) =>
              m.id === last.id
                ? {
                    ...m,
                    content: m.content || 'Sorry, an error occurred.',
                    status: 'error',
                  }
                : m
            );
          }
          return prev;
        });
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
        // Delay clearing pending actions to ensure progress bar is visible
        setTimeout(() => {
          setPendingActions([]);
        }, 1500); // Keep visible for 1.5s after completion
      }
    },
    [
      webcontainer,
      isLoading,
      messages,
      executeActions,
      actionQueue,
      onTerminalOutput,
    ]
  );

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setPendingActions([]);
  }, []);

  /**
   * Retry the last message
   */
  const retryLastMessage = useCallback(async () => {
    if (lastPromptRef.current) {
      // Remove the last assistant message if it was an error
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.status === 'error') {
          return prev.slice(0, -2); // Remove both user and assistant message
        }
        return prev.slice(0, -1); // Remove just the last message
      });

      await sendMessage(lastPromptRef.current);
    }
  }, [sendMessage]);

  /**
   * Clear build errors
   */
  const clearBuildErrors = useCallback(() => {
    setBuildErrors([]);
    terminalBufferRef.current = '';
  }, []);

  /**
   * Fix build errors by sending them to the AI
   */
  const fixBuildErrors = useCallback(async () => {
    if (buildErrors.length === 0 || isLoading) return;

    // Format errors for the AI
    const errorList = buildErrors
      .map((err) => {
        if (err.file && err.line) {
          return `- ${err.file}:${err.line} - ${err.message}`;
        }
        return `- ${err.message}`;
      })
      .join('\n');

    // Create a prompt asking the AI to fix the errors
    const fixPrompt = `There are build errors in the project that need to be fixed:

${errorList}

Please analyze these errors and fix them. Make sure to:
1. Read the affected files to understand the context
2. Identify the root cause of each error
3. Provide the corrected code`;

    // Clear errors before sending (they'll reappear if not fixed)
    clearBuildErrors();

    // Send the fix request
    await sendMessage(fixPrompt);
  }, [buildErrors, isLoading, sendMessage, clearBuildErrors]);

  return {
    messages,
    isLoading,
    loadingMessage,
    error,
    pendingActions,
    executionHistory,
    buildErrors,
    sendMessage,
    clearMessages,
    retryLastMessage,
    rollbackAction,
    rollbackAll,
    retryFailedAction,
    clearHistory,
    clearBuildErrors,
    fixBuildErrors,
  };
}
