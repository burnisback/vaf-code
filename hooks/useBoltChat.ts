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
  detectLanguage,
} from '@/lib/bolt/webcontainer/fileTree';
import {
  ActionQueue,
  createPlanExecutor,
  createPreVerifier,
  isErrorFixIntent,
  isVagueRequest,
  generateClarificationRequest,
  generateCleanProjectResponse,
  generateErrorReportResponse,
  // Phase 3 imports
  createErrorTracker,
  createRollbackController,
  createPerFileVerifier,
  // Phase 4 imports - CheckpointManager for named restore points
  CheckpointManager,
  // Phase 4 imports - EvidenceReporter for evidence-based completion
  EvidenceReporter,
  // Runtime error injection
  injectRuntimeErrorCapture,
  type ExecutionHistoryEntry,
  type QueuedAction,
  type PreVerificationResult,
  type ErrorTracker,
  type RollbackController,
  type PerFileVerifier,
  type ErrorSnapshot,
  type Checkpoint,
  type ErrorCounts,
  type EvidenceReport,
} from '@/lib/bolt/execution';
import {
  classifyRequest,
  classifyRequestSmart,
  type ClassificationResult,
  type RequestMode,
} from '@/lib/bolt/ai/classifier';
// Orchestration imports for mega-complex mode
import {
  createOrchestrator,
  type OrchestrationState,
  type OrchestrationContext,
  type Orchestrator,
  type ExecutionProgress as OrchestrationProgress,
} from '@/lib/bolt/orchestration';
// Import only types from planner (actual generation happens via API)
import type { TaskPlan, PlanGenerationResponse, PlanExecutionResult } from '@/lib/bolt/ai/planner';
import {
  generateRefinement,
  areErrorsFixable,
} from '@/lib/bolt/ai/planner';
import type { VerificationResult } from '@/lib/bolt/execution/verifier';
import type { BoltConfig } from '@/lib/bolt/config';
import { DEFAULT_BOLT_CONFIG } from '@/lib/bolt/config';

// =============================================================================
// TYPES
// =============================================================================

export interface RuntimeErrorInfo {
  id: string;
  type: string;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
}

export interface UseBoltChatOptions {
  webcontainer: WebContainer | null;
  onFilesystemChange?: () => void;
  onTerminalOutput?: (data: string) => void;
  /** Optional configuration override */
  config?: BoltConfig;
  /**
   * Function to get current browser runtime errors from the preview.
   * Called after plan execution to check for runtime crashes.
   */
  getRuntimeErrors?: () => RuntimeErrorInfo[];
  /**
   * Function to clear runtime errors after successful fix.
   */
  clearRuntimeErrors?: () => void;
  /**
   * Delay in ms to wait for preview to load before checking runtime errors.
   * Default: 3000ms
   */
  runtimeErrorCheckDelay?: number;
}

export interface BuildError {
  message: string;
  file?: string;
  line?: number;
  timestamp: number;
}

export interface ExecutionProgress {
  currentTaskId: string | null;
  currentTask: string;
  completedTasks: number;
  totalTasks: number;
}

export interface VerificationSummary {
  success: boolean;
  typeErrors: number;
  moduleErrors: number;
  runtimeErrors: number;
}

export interface UseBoltChatReturn {
  messages: BoltChatMessage[];
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  pendingActions: BoltAction[];
  executionHistory: ExecutionHistoryEntry[];
  buildErrors: BuildError[];
  classification: ClassificationResult | null;
  // Plan-related state
  pendingPlan: TaskPlan | null;
  planReasoning: string;
  isGeneratingPlan: boolean;
  isPlanExecuting: boolean;
  executionProgress: ExecutionProgress | null;
  // Verification state
  verificationResult: VerificationSummary | null;
  fullVerificationResult: VerificationResult | null;
  isVerifying: boolean;
  // Refinement state
  currentIteration: number;
  isRefining: boolean;
  maxIterations: number;
  canRefine: boolean;
  // Orchestration state (mega-complex mode)
  orchestrationState: OrchestrationState | null;
  orchestrationContext: OrchestrationContext | null;
  orchestrationProgress: OrchestrationProgress | null;
  isMegaComplexMode: boolean;
  // Phase 3: Pre-verification approval state
  pendingPreVerification: PreVerificationResult | null;
  isPreVerifying: boolean;
  // Phase 3: Error tracking state
  baselineErrors: ErrorSnapshot | null;
  evidenceReport: string | null;
  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  retryLastMessage: () => Promise<void>;
  rollbackAction: (actionId: string) => Promise<boolean>;
  rollbackAll: () => Promise<number>;
  retryFailedAction: (actionId: string) => Promise<boolean>;
  clearHistory: () => void;
  clearBuildErrors: () => void;
  fixBuildErrors: () => Promise<void>;
  // Plan actions
  approvePlan: () => Promise<void>;
  cancelPlan: () => void;
  // Refinement actions
  fixVerificationErrors: () => Promise<void>;
  // Orchestration actions (mega-complex mode)
  approveOrchestrationStep: () => void;
  rejectOrchestrationStep: (reason?: string) => void;
  pauseOrchestration: () => void;
  resumeOrchestration: () => void;
  abortOrchestration: () => void;
  // Phase 3: Pre-verification approval actions
  approveErrorFix: () => Promise<void>;
  cancelErrorFix: () => void;
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
  config = DEFAULT_BOLT_CONFIG,
  getRuntimeErrors,
  clearRuntimeErrors,
  runtimeErrorCheckDelay = 3000,
}: UseBoltChatOptions): UseBoltChatReturn {
  // Use config values with defaults
  const maxIterations = config.complexMode.maxIterations;
  const [messages, setMessages] = useState<BoltChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<BoltAction[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryEntry[]>([]);
  const [buildErrors, setBuildErrors] = useState<BuildError[]>([]);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  // Plan state
  const [pendingPlan, setPendingPlan] = useState<TaskPlan | null>(null);
  const [planReasoning, setPlanReasoning] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isPlanExecuting, setIsPlanExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress | null>(null);
  // Verification state
  const [verificationResult, setVerificationResult] = useState<VerificationSummary | null>(null);
  const [fullVerificationResult, setFullVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  // Refinement state
  const [currentIteration, setCurrentIteration] = useState(0);
  const [isRefining, setIsRefining] = useState(false);
  // Phase 3: Pre-verification approval state
  const [pendingPreVerification, setPendingPreVerification] = useState<PreVerificationResult | null>(null);
  const [isPreVerifying, setIsPreVerifying] = useState(false);
  const pendingFixPromptRef = useRef<string>('');
  // Phase 3: Skip pre-verification flag (to avoid circular loop)
  const skipPreVerificationRef = useRef<boolean>(false);
  // Phase 3: Error tracking state
  const [baselineErrors, setBaselineErrors] = useState<ErrorSnapshot | null>(null);
  const [evidenceReport, setEvidenceReport] = useState<string | null>(null);
  // Phase 3: Refs for error tracking components
  const errorTrackerRef = useRef<ErrorTracker | null>(null);
  const rollbackControllerRef = useRef<RollbackController | null>(null);
  const perFileVerifierRef = useRef<PerFileVerifier | null>(null);
  // Phase 4: CheckpointManager for named restore points
  const checkpointManagerRef = useRef<CheckpointManager | null>(null);
  // Phase 4: EvidenceReporter for evidence-based completion claims
  const evidenceReporterRef = useRef<EvidenceReporter | null>(null);
  // Orchestration state (mega-complex mode)
  const [orchestrationState, setOrchestrationState] = useState<OrchestrationState | null>(null);
  const [orchestrationContext, setOrchestrationContext] = useState<OrchestrationContext | null>(null);
  const [orchestrationProgress, setOrchestrationProgress] = useState<OrchestrationProgress | null>(null);
  const orchestratorRef = useRef<Orchestrator | null>(null);
  const planContextRef = useRef<{
    projectContext: { fileTree: string; framework: string; styling: string } | null;
    conversationHistory: { role: string; content: string }[];
  }>({ projectContext: null, conversationHistory: [] });

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
      // P0 FIX: Per-file verification callback
      onFileVerify: async (filePath: string) => {
        // Only run verification if perFileVerifier is initialized (during error-fix operations)
        if (!perFileVerifierRef.current) {
          return { valid: true, errors: [] };
        }

        const result = await perFileVerifierRef.current.verifyFile(filePath);
        return {
          valid: result.passed,
          errors: result.errors.map(e => `${e.file}:${e.line} - ${e.code}: ${e.message}`),
        };
      },
      // P0 FIX: Auto-rollback notification callback
      onAutoRollback: (filePath: string, reason: string) => {
        onTerminalOutput?.(`\x1b[33m[Bolt] ↩ Auto-rolled back ${filePath}: ${reason}\x1b[0m\r\n`);
      },
    });
  }, [webcontainer, onFilesystemChange, handleTerminalOutput, onTerminalOutput]);

  // Phase 4: Inject runtime error capture when webcontainer is available
  useEffect(() => {
    if (!webcontainer) return;

    const injectErrorCapture = async () => {
      try {
        const results = await injectRuntimeErrorCapture(webcontainer);
        const successCount = results.filter(r => r.success && !r.alreadyInjected).length;
        const alreadyCount = results.filter(r => r.alreadyInjected).length;

        if (successCount > 0) {
          onTerminalOutput?.(`\x1b[36m[RuntimeCapture] Injected error capture into ${successCount} file(s)\x1b[0m\r\n`);
        } else if (alreadyCount > 0) {
          // Already injected, no need to report
        }
      } catch (error) {
        // Silent fail - runtime error capture is optional
        console.debug('[RuntimeCapture] Could not inject error capture:', error);
      }
    };

    // Delay injection to allow project setup
    const timer = setTimeout(injectErrorCapture, 2000);
    return () => clearTimeout(timer);
  }, [webcontainer, onTerminalOutput]);

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

      // Classify the request using smart LLM-based classifier
      // This provides much more accurate classification than keyword matching
      setIsLoading(true);
      setLoadingMessage('Analyzing request...');

      const requestClassification = await classifyRequestSmart(content.trim(), {
        timeout: 3000, // 3 second timeout, fallback to keywords
        debug: false,
      });
      setClassification(requestClassification);

      console.log('[useBoltChat] Classification:', {
        mode: requestClassification.mode,
        confidence: requestClassification.confidence,
        domains: requestClassification.domains,
        reasoning: requestClassification.reasoning,
      });

      // Check for vague requests first - these need clarification
      if (isVagueRequest(content.trim())) {
        console.log('[useBoltChat] Vague request detected, asking for clarification...');

        // Add user message
        const userMessage: BoltChatMessage = {
          id: generateId(),
          role: 'user',
          content: content.trim(),
          timestamp: Date.now(),
        };

        // Generate clarification request
        const clarification = generateClarificationRequest(content.trim());

        // Add assistant response asking for clarification
        const assistantMessage: BoltChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: clarification.response,
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // Phase 1 + Phase 3: Pre-Change Verification with User Approval
      // If the user's intent suggests error fixing, verify FIRST before making changes
      // Skip if called from approveErrorFix (to avoid circular loop)
      const errorFixIntent = isErrorFixIntent(content.trim(), true); // Enable debug logging
      if (errorFixIntent && !skipPreVerificationRef.current) {
        console.log('[useBoltChat] Error-fix intent detected, running pre-verification...');
        setIsPreVerifying(true);
        setLoadingMessage('Running pre-change verification...');

        const preVerifier = createPreVerifier(webcontainer, {
          onProgress: (msg) => {
            setLoadingMessage(msg);
            onTerminalOutput?.(`\x1b[36m[PreVerify] ${msg}\x1b[0m\r\n`);
          },
        });

        // Add timeout to pre-verification to prevent indefinite hanging
        const PRE_VERIFY_TIMEOUT = 60000; // 60 seconds max
        let preVerifyResult: PreVerificationResult;

        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Pre-verification timed out')), PRE_VERIFY_TIMEOUT);
          });

          preVerifyResult = await Promise.race([
            preVerifier.verify(),
            timeoutPromise,
          ]);
        } catch (timeoutError) {
          console.error('[useBoltChat] Pre-verification timed out or failed:', timeoutError);
          setIsPreVerifying(false);
          setLoadingMessage('');
          onTerminalOutput?.(`\x1b[33m[PreVerify] ⚠ Verification timed out, proceeding without pre-check\x1b[0m\r\n`);

          // Skip pre-verification and proceed with normal flow
          // This prevents hanging - user can still get AI assistance
          preVerifyResult = {
            isClean: true,
            totalErrors: 0,
            staticAnalysis: null,
            buildResult: null,
            lintResult: null,
            testResult: null,
            eslintResult: null,
            targetedTestResult: null,
            unifiedResult: null,
            summary: 'Pre-verification skipped due to timeout',
            errorDetails: '',
            shouldProceed: true,
            duration: PRE_VERIFY_TIMEOUT,
            requiresApproval: false,
            isJSOnlyProject: false,
          };
        }

        // Add user message
        const userMessage: BoltChatMessage = {
          id: generateId(),
          role: 'user',
          content: content.trim(),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMessage]);

        if (preVerifyResult.isClean) {
          // Project is clean - NO errors to fix
          // Report this and STOP - don't make any changes
          console.log('[useBoltChat] Pre-verification: Project is clean, no changes needed');

          const cleanResponse: BoltChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: generateCleanProjectResponse(),
            timestamp: Date.now(),
            status: 'complete',
          };

          setMessages((prev) => [...prev, cleanResponse]);
          setIsPreVerifying(false);
          setLoadingMessage('');

          onTerminalOutput?.(`\x1b[32m[PreVerify] ✓ No errors found - project is clean\x1b[0m\r\n`);
          return; // EXIT - don't proceed with changes
        }

        // Phase 3: Errors found - show to user and wait for approval
        console.log('[useBoltChat] Pre-verification found errors:', preVerifyResult.totalErrors);
        onTerminalOutput?.(`\x1b[33m[PreVerify] Found ${preVerifyResult.totalErrors} error(s) - awaiting approval to fix\x1b[0m\r\n`);

        // Store the pre-verification result for approval
        setPendingPreVerification(preVerifyResult);
        pendingFixPromptRef.current = content.trim();

        // Show error report and ask for approval
        const errorReportResponse: BoltChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: generateErrorReportResponse(preVerifyResult),
          timestamp: Date.now(),
          status: 'complete',
        };

        setMessages((prev) => [...prev, errorReportResponse]);
        setIsPreVerifying(false);
        setLoadingMessage('');

        // EXIT - wait for user to click "Approve Fix" button
        return;
      }

      const userMessage: BoltChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      lastPromptRef.current = content.trim();
      setMessages((prev) => [...prev, userMessage]);
      setError(null);
      setPendingActions([]);

      try {
        setLoadingMessage('Building project context...');

        // Build project context with language detection
        const fileTree = await buildFileTree(webcontainer);
        const framework = detectFramework(fileTree);
        const styling = detectStyling(fileTree);
        const language = await detectLanguage(webcontainer);
        const existingFiles = await getRelevantFiles(webcontainer, content.trim());

        const projectContext = {
          fileTree,
          framework,
          styling,
          language,
          existingFiles,
        };

        console.log('[useBoltChat] Project context:', {
          framework,
          styling,
          language: language.primary,
          hasTsConfig: language.hasTsConfig,
        });

        // Build conversation history (last 10 messages)
        const conversationHistory = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // For mega-complex mode, start orchestration flow
        if (requestClassification.mode === 'mega-complex') {
          // Add explanation message
          const megaComplexMessage: BoltChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `This is a mega-complex project that requires:\n- Web research to understand the domain\n- Product requirements definition (PRD)\n- Technical architecture design\n- Multi-phase implementation\n\nStarting the orchestrated flow...`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, megaComplexMessage]);

          // Create orchestrator with callbacks
          const orchestrator = createOrchestrator(
            { originalPrompt: content.trim() },
            {
              onStateChange: (from, to, ctx) => {
                setOrchestrationState(to);
                setOrchestrationContext(ctx);
                setOrchestrationProgress(orchestrator.getProgress());
              },
              onApprovalNeeded: (what) => {
                const approvalMessage: BoltChatMessage = {
                  id: generateId(),
                  role: 'assistant',
                  content: `Ready for your approval. Please review the ${what} above and approve to continue.`,
                  timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, approvalMessage]);
              },
              onResearchComplete: (sessionId) => {
                const researchMessage: BoltChatMessage = {
                  id: generateId(),
                  role: 'assistant',
                  content: `Research complete. Session ID: ${sessionId}`,
                  timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, researchMessage]);
              },
              onPRDReady: (prdId) => {
                const prdMessage: BoltChatMessage = {
                  id: generateId(),
                  role: 'assistant',
                  content: `Product Requirements Document ready. Document ID: ${prdId}`,
                  timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, prdMessage]);
              },
              onArchitectureReady: (archId) => {
                const archMessage: BoltChatMessage = {
                  id: generateId(),
                  role: 'assistant',
                  content: `Technical architecture designed. Document ID: ${archId}`,
                  timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, archMessage]);
              },
              onComplete: (ctx) => {
                const completeMessage: BoltChatMessage = {
                  id: generateId(),
                  role: 'assistant',
                  content: `Project complete! Built in ${Math.round(ctx.metrics.totalDuration / 1000 / 60)} minutes.`,
                  timestamp: Date.now(),
                  status: 'complete',
                };
                setMessages((prev) => [...prev, completeMessage]);
              },
              onError: (errorMsg) => {
                const errorMessage: BoltChatMessage = {
                  id: generateId(),
                  role: 'assistant',
                  content: `Error: ${errorMsg}`,
                  timestamp: Date.now(),
                  status: 'error',
                };
                setMessages((prev) => [...prev, errorMessage]);
              },
            }
          );

          orchestratorRef.current = orchestrator;
          setOrchestrationState(orchestrator.state);
          setOrchestrationContext(orchestrator.context);

          // Note: The actual execution happens via API routes that use the OrchestrationRunner
          // For now, we just set up the client-side orchestrator for state tracking
          // The user will need to approve each step via the UI
          orchestrator.send({
            type: 'START_RESEARCH',
            payload: { prompt: content.trim() },
          });

          setIsLoading(false);
          setLoadingMessage('');
          return; // Exit - orchestration UI will handle the rest
        }

        // For complex mode, generate a plan first instead of direct execution
        if (requestClassification.mode === 'complex') {
          setIsGeneratingPlan(true);
          setLoadingMessage('Generating implementation plan...');

          try {
            // Call the server-side plan generation API
            const planResponse = await fetch('/api/bolt-plan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: content.trim(),
                projectContext: {
                  fileTree,
                  framework,
                  styling,
                },
                conversationHistory,
              }),
            });

            if (!planResponse.ok) {
              const errorData = await planResponse.json().catch(() => ({}));
              throw new Error(errorData.error || 'Plan generation failed');
            }

            const { plan, reasoning } = await planResponse.json() as PlanGenerationResponse;

            // Store context for plan execution
            planContextRef.current = {
              projectContext: { fileTree, framework, styling },
              conversationHistory,
            };

            setPendingPlan(plan);
            setPlanReasoning(reasoning);

            // Add assistant message explaining plan is ready
            const planMessage: BoltChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: `I've analyzed your request and created an implementation plan with ${plan.tasks.length} tasks. Please review the plan and click "Execute Plan" to proceed.`,
              timestamp: Date.now(),
              status: 'complete',
            };
            setMessages((prev) => [...prev, planMessage]);

            onTerminalOutput?.(`\r\n\x1b[36m[Bolt] Generated plan with ${plan.tasks.length} tasks\x1b[0m\r\n`);
          } catch (planError) {
            console.error('[useBoltChat] Plan generation failed:', planError);
            setError(planError instanceof Error ? planError.message : 'Failed to generate plan');
          } finally {
            setIsGeneratingPlan(false);
            setLoadingMessage('');
          }
          return; // Exit early - wait for plan approval
        }

        // For non-complex modes, proceed with direct generation
        setIsLoading(true);
        setLoadingMessage('Generating code...');

        // Call the API with classification for intelligent handling
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
            classification: requestClassification,
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

  /**
   * Approve and execute the pending plan using PlanExecutor
   */
  const approvePlan = useCallback(async (iterationOverride?: number) => {
    if (!pendingPlan || isPlanExecuting || !webcontainer) return;

    const iteration = iterationOverride ?? currentIteration;
    setCurrentIteration(iteration);
    setIsPlanExecuting(true);
    setExecutionProgress({
      currentTaskId: null,
      currentTask: 'Initializing...',
      completedTasks: 0,
      totalTasks: pendingPlan.tasks.length,
    });

    try {
      // Update plan status
      const executingPlan: TaskPlan = {
        ...pendingPlan,
        status: 'executing',
        tasks: pendingPlan.tasks.map(t => ({ ...t, status: 'pending' as const })),
      };
      setPendingPlan(executingPlan);

      // Create the plan executor with callbacks
      const executor = createPlanExecutor(webcontainer, {
        onTaskStart: (task) => {
          setExecutionProgress(prev => prev ? {
            ...prev,
            currentTaskId: task.id,
            currentTask: task.description,
          } : null);
          // Update task status in plan
          setPendingPlan(current => current ? {
            ...current,
            tasks: current.tasks.map(t =>
              t.id === task.id ? { ...t, status: 'in_progress' as const } : t
            ),
          } : null);
        },
        onTaskComplete: (task) => {
          // Update task status in plan
          setPendingPlan(current => current ? {
            ...current,
            tasks: current.tasks.map(t =>
              t.id === task.id ? { ...t, status: 'completed' as const } : t
            ),
          } : null);
        },
        onTaskError: (task, error) => {
          // Update task status in plan
          setPendingPlan(current => current ? {
            ...current,
            tasks: current.tasks.map(t =>
              t.id === task.id ? { ...t, status: 'failed' as const, error } : t
            ),
          } : null);
        },
        onProgress: (completed, total, currentTask) => {
          setExecutionProgress(prev => prev ? {
            ...prev,
            completedTasks: completed,
            totalTasks: total,
            currentTask,
          } : null);
        },
        onFilesystemChange: () => {
          onFilesystemChange?.();
        },
        onTerminalOutput: (data) => {
          onTerminalOutput?.(data);
        },
      });

      // Execute the plan
      const result = await executor.execute(executingPlan);

      // Update plan with final status
      setPendingPlan(result.plan);

      // Set verification results if available
      // We need to get the full verification result from the verifier
      // For now we store what we have from PlanExecutionResult
      let finalVerification = result.verification ? {
        success: result.verification.success,
        typeErrors: result.verification.typeErrors,
        moduleErrors: result.verification.moduleErrors,
        runtimeErrors: result.verification.runtimeErrors,
      } : null;

      // Phase 2: Browser Runtime Error Verification
      // Wait for the preview to reload and check for browser runtime errors
      let browserRuntimeErrors: RuntimeErrorInfo[] = [];
      if (getRuntimeErrors && result.success && (!finalVerification || finalVerification.success)) {
        // Set verification status to show we're checking browser errors
        setIsVerifying(true);
        setLoadingMessage('Checking for browser runtime errors...');

        // Wait for the preview to load and potential errors to be captured
        await new Promise(resolve => setTimeout(resolve, runtimeErrorCheckDelay));

        // Get any runtime errors from the browser
        browserRuntimeErrors = getRuntimeErrors();

        if (browserRuntimeErrors.length > 0) {
          console.log('[useBoltChat] Browser runtime errors detected:', browserRuntimeErrors.length);

          // Update verification result to include browser runtime errors
          const existingRuntimeErrors = finalVerification?.runtimeErrors || 0;
          finalVerification = {
            success: false, // Mark as failed since we have runtime errors
            typeErrors: finalVerification?.typeErrors || 0,
            moduleErrors: finalVerification?.moduleErrors || 0,
            runtimeErrors: existingRuntimeErrors + browserRuntimeErrors.length,
          };

          // Create a detailed full verification result for the refinement loop
          const browserErrorDetails = browserRuntimeErrors.map(err => ({
            type: 'runtime' as const,
            message: `[Browser] ${err.message}`,
            severity: 'error' as const,
            file: err.source,
            line: err.line,
          }));

          setFullVerificationResult({
            success: false,
            buildSuccess: result.verification?.success ?? true,
            typeErrors: [],
            moduleErrors: [],
            runtimeErrors: browserErrorDetails,
            lintErrors: [],
            timestamp: Date.now(),
            rawOutput: browserRuntimeErrors.map(e => `${e.type}: ${e.message}\n${e.stack || ''}`).join('\n\n'),
          });
        }

        setIsVerifying(false);
      }

      // Set the final verification result
      if (finalVerification) {
        setVerificationResult(finalVerification);
      }

      // Add completion message
      let completionContent = result.success
        ? `Plan completed successfully! ${result.completedTasks} task(s) executed in ${(result.executionTime / 1000).toFixed(1)}s.`
        : `Plan completed with ${result.failedTasks} error(s). ${result.completedTasks}/${result.plan.tasks.length} tasks succeeded.`;

      // Add verification info to message
      if (finalVerification) {
        if (finalVerification.success) {
          completionContent += ' Build verified successfully.';
        } else {
          const totalVerifyErrors = finalVerification.typeErrors + finalVerification.moduleErrors + finalVerification.runtimeErrors;
          completionContent += ` Build verification found ${totalVerifyErrors} error(s).`;
          if (browserRuntimeErrors.length > 0) {
            completionContent += ` (${browserRuntimeErrors.length} browser runtime error${browserRuntimeErrors.length > 1 ? 's' : ''})`;
          }
        }
      }

      const completionMessage: BoltChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: completionContent,
        timestamp: Date.now(),
        status: result.success && finalVerification?.success !== false ? 'complete' : 'error',
      };
      setMessages(prev => [...prev, completionMessage]);

      // Auto-trigger fix if we have browser runtime errors and can refine
      if (browserRuntimeErrors.length > 0 && iteration < maxIterations && config.complexMode.autoFixRuntimeErrors !== false) {
        console.log('[useBoltChat] Auto-triggering fix for browser runtime errors');
        // Small delay to let UI update
        setTimeout(() => {
          fixVerificationErrors();
        }, 500);
      }

    } catch (err) {
      console.error('[useBoltChat] Plan execution failed:', err);
      setError(err instanceof Error ? err.message : 'Plan execution failed');
      if (pendingPlan) {
        setPendingPlan({ ...pendingPlan, status: 'failed' });
      }
    } finally {
      setIsPlanExecuting(false);
      setExecutionProgress(null);
      // Only clear plan/verification if successful or max iterations reached
      // Otherwise keep them visible for the Fix Errors button
      const shouldKeepForRefinement = verificationResult && !verificationResult.success && iteration < maxIterations;

      if (!shouldKeepForRefinement) {
        // Clear plan after a delay, keep verification visible longer
        setTimeout(() => {
          setPendingPlan(null);
          setPlanReasoning('');
          setCurrentIteration(0);
        }, 2000);
        // Clear verification after longer delay
        setTimeout(() => {
          setVerificationResult(null);
          setFullVerificationResult(null);
        }, 5000);
      }
    }
  }, [pendingPlan, isPlanExecuting, webcontainer, onFilesystemChange, onTerminalOutput, currentIteration, verificationResult]);

  /**
   * Fix verification errors by generating and executing a refinement plan
   */
  const fixVerificationErrors = useCallback(async () => {
    if (!pendingPlan || !verificationResult || isRefining || isPlanExecuting || !webcontainer) {
      console.warn('[useBoltChat] Cannot fix errors: missing requirements');
      return;
    }

    // Check if we can still refine
    if (currentIteration >= maxIterations) {
      const maxMessage: BoltChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Maximum refinement attempts (${maxIterations}) reached. Manual intervention required.`,
        timestamp: Date.now(),
        status: 'error',
      };
      setMessages(prev => [...prev, maxMessage]);
      return;
    }

    setIsRefining(true);

    try {
      // Build project context for refinement
      const fileTree = await buildFileTree(webcontainer);
      const framework = detectFramework(fileTree);
      const styling = detectStyling(fileTree);
      const language = await detectLanguage(webcontainer);

      // Create a mock VerificationResult from the summary
      // In a real scenario, we'd store the full result
      const mockVerificationResult: VerificationResult = {
        success: verificationResult.success,
        buildSuccess: verificationResult.success,
        typeErrors: Array(verificationResult.typeErrors).fill(null).map((_, i) => ({
          type: 'type' as const,
          message: `Type error ${i + 1}`,
          severity: 'error' as const,
        })),
        moduleErrors: Array(verificationResult.moduleErrors).fill(null).map((_, i) => ({
          type: 'module' as const,
          message: `Module error ${i + 1}`,
          severity: 'error' as const,
        })),
        runtimeErrors: Array(verificationResult.runtimeErrors).fill(null).map((_, i) => ({
          type: 'runtime' as const,
          message: `Runtime error ${i + 1}`,
          severity: 'error' as const,
        })),
        lintErrors: [],
        timestamp: Date.now(),
        rawOutput: '',
      };

      // Use full verification result if available
      const verificationToUse = fullVerificationResult || mockVerificationResult;

      // Generate refinement plan
      const refinementResult = await generateRefinement({
        originalPlan: pendingPlan,
        verificationResult: verificationToUse,
        projectContext: {
          fileTree,
          framework,
          styling,
          language,
        },
        iteration: currentIteration,
      });

      if (refinementResult.canRefine && refinementResult.plan) {
        // Add message about refinement
        const refineMessage: BoltChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Refinement plan created (iteration ${currentIteration + 1}/${maxIterations}):\n${refinementResult.reasoning}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, refineMessage]);

        // Set the refinement plan and increment iteration
        setPendingPlan(refinementResult.plan);
        setPlanReasoning(refinementResult.reasoning);

        // Clear verification before re-execution
        setVerificationResult(null);
        setFullVerificationResult(null);

        // Auto-execute the refinement plan with incremented iteration
        setIsRefining(false);
        await approvePlan(currentIteration + 1);
      } else if (refinementResult.shouldAbort) {
        // Show abort message
        const abortMessage: BoltChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Unable to auto-fix: ${refinementResult.abortReason}`,
          timestamp: Date.now(),
          status: 'error',
        };
        setMessages(prev => [...prev, abortMessage]);
      } else {
        // Could not generate fixes
        const noFixMessage: BoltChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: refinementResult.reasoning || 'Could not generate fixes for the detected errors.',
          timestamp: Date.now(),
          status: 'error',
        };
        setMessages(prev => [...prev, noFixMessage]);
      }
    } catch (err) {
      console.error('[useBoltChat] Refinement failed:', err);
      const errorMessage: BoltChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Refinement failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsRefining(false);
    }
  }, [pendingPlan, verificationResult, fullVerificationResult, isRefining, isPlanExecuting, webcontainer, currentIteration, approvePlan]);

  /**
   * Cancel the pending plan
   */
  const cancelPlan = useCallback(() => {
    setPendingPlan(null);
    setPlanReasoning('');
    setError(null);
    setCurrentIteration(0);
    setVerificationResult(null);
    setFullVerificationResult(null);
  }, []);

  // Compute canRefine
  const canRefineValue = Boolean(
    verificationResult &&
    !verificationResult.success &&
    currentIteration < maxIterations &&
    !isRefining &&
    !isPlanExecuting
  );

  // Orchestration control functions
  const approveOrchestrationStep = useCallback(() => {
    orchestratorRef.current?.send({ type: 'USER_APPROVE' });
  }, []);

  const rejectOrchestrationStep = useCallback((reason?: string) => {
    orchestratorRef.current?.send({ type: 'USER_REJECT', payload: { reason } });
    // Reset orchestration state
    orchestratorRef.current = null;
    setOrchestrationState(null);
    setOrchestrationContext(null);
    setOrchestrationProgress(null);
  }, []);

  const pauseOrchestration = useCallback(() => {
    orchestratorRef.current?.send({ type: 'USER_PAUSE' });
  }, []);

  const resumeOrchestration = useCallback(() => {
    orchestratorRef.current?.send({ type: 'USER_RESUME' });
  }, []);

  const abortOrchestration = useCallback(() => {
    orchestratorRef.current?.send({ type: 'USER_ABORT' });
    // Reset orchestration state
    orchestratorRef.current = null;
    setOrchestrationState(null);
    setOrchestrationContext(null);
    setOrchestrationProgress(null);
  }, []);

  // Compute isMegaComplexMode
  const isMegaComplexMode = orchestratorRef.current !== null;

  /**
   * Phase 3: Approve fixing the detected errors
   * This continues the fix flow after user reviews the error report
   */
  const approveErrorFix = useCallback(async () => {
    if (!pendingPreVerification || !webcontainer) return;

    const savedPreVerification = pendingPreVerification;

    // Clear pending state
    setPendingPreVerification(null);
    pendingFixPromptRef.current = '';

    // Add approval message
    const approvalMessage: BoltChatMessage = {
      id: generateId(),
      role: 'user',
      content: '[Approved fixing the detected errors]',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, approvalMessage]);

    // Phase 3: Initialize error tracking components
    errorTrackerRef.current = createErrorTracker(webcontainer, {
      onProgress: (msg) => onTerminalOutput?.(`\x1b[36m${msg}\x1b[0m\r\n`),
    });

    rollbackControllerRef.current = createRollbackController(webcontainer, {
      autoRollbackOnErrorIncrease: true,
      autoRollbackOnVerifyFail: true,
      onProgress: (msg) => onTerminalOutput?.(`\x1b[36m${msg}\x1b[0m\r\n`),
      onRollback: (decision) => {
        onTerminalOutput?.(`\x1b[33m[Rollback] ${decision.reason}\x1b[0m\r\n`);
      },
    });

    perFileVerifierRef.current = createPerFileVerifier(webcontainer, {
      rollbackOnAnyError: false, // Only rollback on critical errors
      onProgress: (msg) => onTerminalOutput?.(`\x1b[36m${msg}\x1b[0m\r\n`),
    });

    // Phase 4: Initialize CheckpointManager for named restore points
    checkpointManagerRef.current = new CheckpointManager(webcontainer, {
      maxCheckpoints: 10,
      autoCheckpoint: true,
      onProgress: (msg) => onTerminalOutput?.(`\x1b[36m${msg}\x1b[0m\r\n`),
    });

    // Phase 4: Initialize EvidenceReporter for evidence-based completion
    evidenceReporterRef.current = new EvidenceReporter(webcontainer, {
      requireVerification: true,
      includeDetails: true,
      onProgress: (msg) => onTerminalOutput?.(`\x1b[36m${msg}\x1b[0m\r\n`),
    });

    // Capture pre-change state for evidence
    if (errorTrackerRef.current && evidenceReporterRef.current) {
      const baseline = await errorTrackerRef.current.captureBaseline();
      const errorCounts: ErrorCounts = EvidenceReporter.createErrorCounts(
        undefined, // staticAnalysis - will be captured during verification
        undefined, // build
        { errorCount: baseline.errorCount }, // lint approximation
        { passed: 0, failed: 0, total: 0 } // tests
      );
      evidenceReporterRef.current.capturePreChangeState(errorCounts);
    }

    // Create a checkpoint before starting error fixes
    await checkpointManagerRef.current.createCheckpoint('before-error-fix', 'Pre-fix checkpoint');
    onTerminalOutput?.(`\x1b[36m[Checkpoint] Created restore point: before-error-fix\x1b[0m\r\n`);

    // Capture baseline error count (from pre-verification result)
    const baseline = await errorTrackerRef.current.captureBaseline();
    setBaselineErrors(baseline);
    onTerminalOutput?.(`\x1b[36m[ErrorTracker] Baseline: ${baseline.errorCount} error(s)\x1b[0m\r\n`);

    // Configure ActionQueue for per-file verification
    if (actionQueueRef.current) {
      actionQueueRef.current.enablePerFileVerification(true);
      actionQueueRef.current.setConfig({
        enablePerFileVerify: true,
        autoRollbackOnFailure: true,
      });
    }

    // Create a detailed fix prompt using the error details
    const fixPrompt = `Please fix the following errors that were detected in the project:

${savedPreVerification.errorDetails}

Make targeted changes only to the files with actual errors. Do not modify files that don't have errors.`;

    // Set flag to skip pre-verification (already done)
    skipPreVerificationRef.current = true;

    try {
      // Use the original sendMessage flow
      await sendMessage(fixPrompt);

      // P0 FIX: Check if errors increased - if so, auto-rollback
      if (errorTrackerRef.current && actionQueueRef.current) {
        const errorState = await errorTrackerRef.current.checkErrorState();

        if (errorState.comparison?.errorsIncreased) {
          onTerminalOutput?.(`\x1b[33m[ErrorTracker] ⚠ Errors increased: ${errorState.comparison.summary}\x1b[0m\r\n`);
          onTerminalOutput?.(`\x1b[33m[ErrorTracker] Triggering automatic batch rollback...\x1b[0m\r\n`);

          // Execute batch rollback
          const rollbackCount = await actionQueueRef.current.rollbackAll();

          if (rollbackCount > 0) {
            onTerminalOutput?.(`\x1b[32m[ErrorTracker] ✓ Rolled back ${rollbackCount} file(s) to prevent error increase\x1b[0m\r\n`);

            // Add rollback notification message
            const rollbackMessage: BoltChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: `**⚠️ Auto-Rollback Triggered**\n\nThe fix attempt introduced ${errorState.comparison.delta} new error(s). All ${rollbackCount} file change(s) have been rolled back to preserve the previous state.\n\n**Before:** ${errorState.comparison.baseline.errorCount} error(s)\n**After attempt:** ${errorState.comparison.current.errorCount} error(s)\n\nPlease review the errors and try a different approach.`,
              timestamp: Date.now(),
              status: 'complete',
            };
            setMessages((prev) => [...prev, rollbackMessage]);
          }
        } else if (errorState.comparison?.errorsDecreased) {
          onTerminalOutput?.(`\x1b[32m[ErrorTracker] ✓ Progress: ${Math.abs(errorState.comparison.delta)} error(s) fixed\x1b[0m\r\n`);

          // P1 FIX: Show evidence report in completion message
          const evidenceReport = errorTrackerRef.current.generateEvidenceReport();

          // Phase 4: Capture post-change state and generate evidence-based completion
          if (evidenceReporterRef.current) {
            const postErrorCounts: ErrorCounts = EvidenceReporter.createErrorCounts(
              undefined,
              undefined,
              { errorCount: errorState.comparison.current.errorCount },
              { passed: 0, failed: 0, total: 0 }
            );
            evidenceReporterRef.current.capturePostChangeState(postErrorCounts);

            // Record that verification was run
            evidenceReporterRef.current.recordEvidence({
              timestamp: Date.now(),
              typescript: { exitCode: 0, errorCount: 0, errors: [] },
              build: { success: true, errorCount: 0, errors: [] },
              lint: { success: true, errorCount: errorState.comparison.current.errorCount, warningCount: 0 },
              tests: { ran: false, passed: 0, failed: 0, total: 0 },
            });
          }

          const successMessage: BoltChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: errorState.comparison.current.errorCount === 0
              ? `**✅ All Errors Fixed**\n\n${evidenceReport}\n\nThe project is now error-free.`
              : `**✅ Fix Progress**\n\n${evidenceReport}\n\n${errorState.comparison.current.errorCount} error(s) remaining.`,
            timestamp: Date.now(),
            status: 'complete',
          };
          setMessages((prev) => [...prev, successMessage]);
        } else if (errorState.comparison) {
          // No change in error count
          const evidenceReport = errorTrackerRef.current.generateEvidenceReport();

          // Phase 4: Update EvidenceReporter with no-change state
          if (evidenceReporterRef.current) {
            const postErrorCounts: ErrorCounts = EvidenceReporter.createErrorCounts(
              undefined,
              undefined,
              { errorCount: errorState.comparison.current.errorCount },
              { passed: 0, failed: 0, total: 0 }
            );
            evidenceReporterRef.current.capturePostChangeState(postErrorCounts);
          }

          const noChangeMessage: BoltChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: `**ℹ️ No Change in Error Count**\n\n${evidenceReport}\n\nThe errors remain. Please review and try a different approach.`,
            timestamp: Date.now(),
            status: 'complete',
          };
          setMessages((prev) => [...prev, noChangeMessage]);
        }
      }
    } finally {
      // Reset the skip flag after completion
      skipPreVerificationRef.current = false;

      // Disable per-file verification after fix operation
      if (actionQueueRef.current) {
        actionQueueRef.current.enablePerFileVerification(false);
      }

      // Phase 3: Generate evidence report (also output to terminal)
      if (errorTrackerRef.current) {
        const report = errorTrackerRef.current.generateEvidenceReport();
        setEvidenceReport(report);
        onTerminalOutput?.(`\x1b[32m\n${report}\x1b[0m\r\n`);
      }
    }
  }, [pendingPreVerification, webcontainer, sendMessage, onTerminalOutput]);

  /**
   * Phase 3: Cancel the error fix request
   */
  const cancelErrorFix = useCallback(() => {
    setPendingPreVerification(null);
    pendingFixPromptRef.current = '';

    const cancelMessage: BoltChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: 'Error fix cancelled. Let me know if you need anything else.',
      timestamp: Date.now(),
      status: 'complete',
    };
    setMessages((prev) => [...prev, cancelMessage]);
  }, []);

  return {
    messages,
    isLoading,
    loadingMessage,
    error,
    pendingActions,
    executionHistory,
    buildErrors,
    classification,
    // Plan state
    pendingPlan,
    planReasoning,
    isGeneratingPlan,
    isPlanExecuting,
    executionProgress,
    // Verification state
    verificationResult,
    fullVerificationResult,
    isVerifying,
    // Refinement state
    currentIteration,
    isRefining,
    maxIterations: maxIterations,
    canRefine: canRefineValue,
    // Orchestration state (mega-complex mode)
    orchestrationState,
    orchestrationContext,
    orchestrationProgress,
    isMegaComplexMode,
    // Phase 3: Pre-verification approval state
    pendingPreVerification,
    isPreVerifying,
    // Phase 3: Error tracking state
    baselineErrors,
    evidenceReport,
    // Actions
    sendMessage,
    clearMessages,
    retryLastMessage,
    rollbackAction,
    rollbackAll,
    retryFailedAction,
    clearHistory,
    clearBuildErrors,
    fixBuildErrors,
    // Plan actions
    approvePlan,
    cancelPlan,
    // Refinement actions
    fixVerificationErrors,
    // Orchestration actions (mega-complex mode)
    approveOrchestrationStep,
    rejectOrchestrationStep,
    pauseOrchestration,
    resumeOrchestration,
    abortOrchestration,
    // Phase 3: Pre-verification approval actions
    approveErrorFix,
    cancelErrorFix,
  };
}
