'use client';

/**
 * BoltPlaygroundLayout
 *
 * Professional IDE layout inspired by bolt.new.
 *
 * Layout Structure:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │                          HEADER                                   │
 * ├─────────────────────┬────────────────────────────────────────────┤
 * │                     │  ┌─────────┬─────────┐                     │
 * │      CHAT PANEL     │  │  Code   │ Preview │  ← Workbench Tabs   │
 * │                     │  ├─────────┴─────────┴────────────────────┤
 * │                     │  │  FILE TREE  │     EDITOR / PREVIEW     │
 * │                     │  │             │                           │
 * │                     │  │             ├───────────────────────────┤
 * │                     │  │             │        TERMINAL           │
 * │      [Input...]     │  └─────────────┴───────────────────────────┤
 * └─────────────────────┴────────────────────────────────────────────┘
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { BoltWebContainerProvider, useBoltWebContainer } from '@/lib/bolt/webcontainer/context';
import { BoltFileExplorer } from './BoltFileExplorer';
import { BoltCodeEditor } from './BoltCodeEditor';
import { BoltTerminal } from './BoltTerminal';
import { BoltPreview } from './BoltPreview';
import { useBoltChat } from '@/hooks/useBoltChat';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Zap,
  MessageSquare,
  Eye,
  Code,
  Send,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeft,
  Check,
  X,
  FileCode,
  Terminal,
  RotateCcw,
  Trash2,
  History,
  Undo2,
  AlertTriangle,
  Settings,
  Ban,
  Wrench,
} from 'lucide-react';
import type { BoltOpenFile, BoltChatMessage, BoltAction } from '@/lib/bolt/types';
import { ToastProvider, useToastHelpers } from './ui/Toast';
import { ProgressBar } from './ui/ProgressBar';
import { UndoConfirmModal } from './ui/Modal';
import { ClassificationBadge } from './ui/ModeBadge';
import {
  PlanPreview,
  PlanPreviewSkeleton,
  TaskProgress,
  VerificationIndicator,
  IterationBadge,
  type IterationStatus,
} from './complex';
// Mega-complex mode components
import {
  MiniTodoList,
  CurrentTodo,
  ApprovalDialog,
  MiniProgressBadge,
  MegaComplexPanel,
  MegaComplexMessage,
  type MegaComplexMessageType,
  EvidenceLog,
  MiniEvidenceLog,
} from './mega';
import { BoltConfigProvider, useBoltConfig } from '@/lib/bolt/config';
import { BoltSettingsPanel } from './settings';
import { EnhancedChatMessage } from '@/components/chat/EnhancedChatMessage';
import type { ExecutionPhase, ExecutionTask } from '@/components/chat/progress/ExecutionProgress';
import { RuntimeErrorBanner, DebugSessionPanel } from '@/components/debug';
import { useRuntimeErrors } from '@/hooks/useRuntimeErrors';
import type { RuntimeError } from '@/lib/bolt/types';

// =============================================================================
// TYPES
// =============================================================================

type WorkbenchTab = 'code' | 'preview';

// =============================================================================
// LOADING SCREEN
// =============================================================================

function BoltLoadingScreen() {
  const { loadingState, loadingMessage, error, retryInit } = useBoltWebContainer();

  const stages = [
    { key: 'booting', label: 'Boot' },
    { key: 'mounting', label: 'Mount' },
    { key: 'installing', label: 'Install' },
    { key: 'starting', label: 'Start' },
  ];

  const currentIndex = stages.findIndex((s) => s.key === loadingState);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 mb-4 shadow-lg shadow-violet-500/25">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Bolt Playground</h1>
          <p className="text-zinc-500 mt-1 text-sm">Powered by WebContainer</p>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
            <div className="flex items-center justify-center gap-2 text-red-400 mb-3">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Initialization failed</span>
            </div>
            <p className="text-red-300/80 text-sm mb-4">{error}</p>
            <button
              onClick={retryInit}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="flex justify-center gap-3 mb-6">
              {stages.map((stage, i) => {
                const isActive = stage.key === loadingState;
                const isComplete = currentIndex > i;
                return (
                  <div key={stage.key} className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                        isComplete
                          ? 'bg-emerald-500 text-white'
                          : isActive
                          ? 'bg-violet-500 text-white ring-4 ring-violet-500/30'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {isComplete ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs mt-2 ${isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2 text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
              <span className="text-sm">{loadingMessage}</span>
            </div>

            <p className="text-zinc-600 text-xs mt-6">First load may take 30-60 seconds</p>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ACTION STATUS INDICATOR
// =============================================================================

function ActionStatusIndicator({ action }: { action: BoltAction }) {
  const statusIcon = {
    pending: <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />,
    executing: <Loader2 className="w-3 h-3 animate-spin text-violet-400" />,
    success: <Check className="w-3 h-3 text-emerald-400" />,
    error: <X className="w-3 h-3 text-red-400" />,
    blocked: <Ban className="w-3 h-3 text-amber-400" />,
  };

  const typeIcon = action.type === 'file' ? (
    <FileCode className="w-3 h-3" />
  ) : (
    <Terminal className="w-3 h-3" />
  );

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
        action.status === 'error'
          ? 'bg-red-500/10 text-red-300'
          : action.status === 'success'
          ? 'bg-emerald-500/10 text-emerald-300'
          : 'bg-zinc-800/50 text-zinc-400'
      }`}
    >
      {typeIcon}
      <span className="truncate max-w-[150px]">
        {action.type === 'file' ? action.filePath : action.content.slice(0, 30)}
      </span>
      {statusIcon[action.status || 'pending']}
    </div>
  );
}

// =============================================================================
// CHAT MESSAGE COMPONENT (Enhanced)
// =============================================================================

interface ChatMessageProps {
  message: BoltChatMessage;
  executionPhase?: ExecutionPhase;
  executionTasks?: ExecutionTask[];
  onOpenFile?: (path: string) => void;
}

function ChatMessage({ message, executionPhase, executionTasks, onOpenFile }: ChatMessageProps) {
  return (
    <div className="mb-3 animate-fade-in">
      <EnhancedChatMessage
        message={message}
        isStreaming={message.status === 'streaming'}
        executionPhase={executionPhase}
        executionTasks={executionTasks}
        onOpenFile={onOpenFile}
        showAvatar={true}
      />
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Detect if a message is a mega-complex orchestration update and return its type.
 * Returns null if it's a regular message.
 */
function detectMegaComplexMessageType(content: string): MegaComplexMessageType | null {
  const lowerContent = content.toLowerCase();

  // Research related
  if (lowerContent.includes('research complete') || lowerContent.includes('researching domain')) {
    return 'research';
  }

  // PRD related
  if (lowerContent.includes('prd') || lowerContent.includes('product requirements')) {
    return 'prd';
  }

  // Architecture related
  if (lowerContent.includes('architecture') || lowerContent.includes('technical design')) {
    return 'architecture';
  }

  // Phase related
  if (lowerContent.includes('phase') && (lowerContent.includes('starting') || lowerContent.includes('complete'))) {
    return 'phase';
  }

  // Approval related
  if (lowerContent.includes('approval') || lowerContent.includes('approve')) {
    return 'approval';
  }

  // Complete
  if (lowerContent.includes('project complete') || lowerContent.includes('successfully built')) {
    return 'complete';
  }

  // Error
  if (lowerContent.includes('orchestration') && lowerContent.includes('error')) {
    return 'error';
  }

  return null;
}

/**
 * Extract title from mega-complex message content
 */
function extractMegaComplexTitle(content: string, type: MegaComplexMessageType): string {
  const titles: Record<MegaComplexMessageType, string> = {
    research: 'Research Update',
    prd: 'Product Requirements',
    architecture: 'Architecture Design',
    phase: 'Implementation Phase',
    approval: 'Approval Required',
    complete: 'Project Complete',
    error: 'Execution Error',
  };
  return titles[type];
}

// =============================================================================
// CHAT PANEL
// =============================================================================

interface BoltChatPanelProps {
  onFilesystemChange?: () => void;
  onOpenFile?: (path: string) => void;
  /** Flush pending editor changes to WebContainer before verification */
  flushPendingEdits?: () => Promise<void>;
}

function BoltChatPanel({ onFilesystemChange, onOpenFile, flushPendingEdits }: BoltChatPanelProps) {
  const { webcontainer, writeToTerminal, triggerFilesystemRefresh, getTerminalErrors, clearTerminalHistory } = useBoltWebContainer();
  const { config } = useBoltConfig();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMegaPanelOpen, setIsMegaPanelOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToastHelpers();

  // Runtime errors from browser console - declare BEFORE useBoltChat so we can pass the getter
  const {
    errors: runtimeErrors,
    debugSession,
    isHandlerActive,
    hasErrors: hasRuntimeErrors,
    startDebugSession,
    updateDebugSession,
    clearError: clearRuntimeError,
    clearAllErrors: clearAllRuntimeErrors,
    endDebugSession,
  } = useRuntimeErrors();

  // Create a stable callback to get runtime errors for verification
  const getRuntimeErrorsCallback = useCallback(() => {
    return runtimeErrors.map(err => ({
      id: err.id,
      type: err.type,
      message: err.message,
      stack: err.stack,
      source: err.source,
      line: err.line,
    }));
  }, [runtimeErrors]);

  const {
    messages,
    isLoading,
    loadingMessage,
    error,
    pendingActions,
    executionHistory,
    buildErrors,
    classification,
    // Plan-related state
    pendingPlan,
    planReasoning,
    isGeneratingPlan,
    isPlanExecuting,
    executionProgress,
    // Verification state
    verificationResult,
    isVerifying,
    // Refinement state
    currentIteration,
    isRefining,
    maxIterations,
    canRefine,
    // Pre-verification state (Phase 3)
    pendingPreVerification,
    isPreVerifying,
    sendMessage,
    clearMessages,
    retryLastMessage,
    rollbackAction,
    rollbackAll,
    retryFailedAction,
    clearBuildErrors,
    fixBuildErrors,
    // Plan actions
    approvePlan,
    cancelPlan,
    // Refinement actions
    fixVerificationErrors,
    // Pre-verification actions (Phase 3)
    approveErrorFix,
    cancelErrorFix,
    // Orchestration state (mega-complex mode)
    orchestrationState,
    orchestrationContext,
    orchestrationProgress,
    isMegaComplexMode,
    // Orchestration actions
    approveOrchestrationStep,
    rejectOrchestrationStep,
    pauseOrchestration,
    resumeOrchestration,
    abortOrchestration,
    // Todo system state
    todos,
    currentTodo,
    todoProgress,
    // Orchestration data from each phase
    researchData,
    prdData,
    architectureData,
    // Investigation layer state (read-before-edit)
    investigationResult,
    isInvestigating,
    // Debug pipeline state
    debugPipelineResult,
    debugPipelineProgress,
  } = useBoltChat({
    webcontainer,
    onFilesystemChange: () => {
      triggerFilesystemRefresh();
      onFilesystemChange?.();
    },
    onTerminalOutput: writeToTerminal,
    config,
    // Pass runtime error functions for verification integration
    getRuntimeErrors: getRuntimeErrorsCallback,
    clearRuntimeErrors: clearAllRuntimeErrors,
    runtimeErrorCheckDelay: config.complexMode.runtimeErrorCheckDelay || 3000,
    // Flush function to save pending editor changes before verification
    flushPendingEdits,
    // Pass terminal errors from dev server output
    getTerminalErrors,
    // Clear terminal history after successful fix to prevent stale errors
    clearTerminalErrors: clearTerminalHistory,
  });

  // Handle auto-debug for runtime errors
  const handleAutoDebug = useCallback(async (error: RuntimeError) => {
    // Start the debug session
    startDebugSession(error);
    updateDebugSession({ status: 'analyzing' });

    try {
      // Get relevant files from the webcontainer
      const relevantFiles: { path: string; content: string }[] = [];

      // Try to read files from error source if available
      if (error.source && webcontainer) {
        try {
          // Clean the path
          const cleanPath = error.source
            .replace(/^https?:\/\/[^/]+/, '')
            .replace(/\?.*$/, '')
            .replace(/^\//, '');

          if (cleanPath.startsWith('src/')) {
            const content = await webcontainer.fs.readFile(cleanPath, 'utf-8');
            relevantFiles.push({ path: cleanPath, content });
          }
        } catch {
          // File read failed, continue with empty context
        }
      }

      // Call the debug API
      const response = await fetch('/api/bolt-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error,
          context: {
            previousAttempts: debugSession?.fixAttempts || [],
            relevantFiles,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Debug API request failed');
      }

      const { analysis, proposedActions } = await response.json();

      updateDebugSession({ status: 'fixing' });

      // Execute the proposed actions via sendMessage
      // Format the fix as a message to the AI
      if (proposedActions.length > 0) {
        const fixMessage = `Apply the following fix for the runtime error "${error.message.slice(0, 50)}...":\n\n${
          proposedActions.map((a: any) =>
            a.type === 'file'
              ? `File: ${a.filePath}\n\`\`\`\n${a.content}\n\`\`\``
              : `Run: ${a.content}`
          ).join('\n\n')
        }`;

        await sendMessage(fixMessage);
      }

      // Wait for verification
      updateDebugSession({ status: 'verifying' });

      // The verification will happen automatically when errors clear or persist
      // For now, mark as resolved after a delay
      setTimeout(() => {
        if (runtimeErrors.length === 0) {
          endDebugSession(true);
          clearAllRuntimeErrors();
          toast.success('Error Fixed', 'The runtime error has been resolved');
        } else {
          // Check if this specific error is gone
          const errorStillExists = runtimeErrors.some(
            (e) => e.message === error.message && e.type === error.type
          );
          if (!errorStillExists) {
            endDebugSession(true);
            toast.success('Error Fixed', 'The runtime error has been resolved');
          } else {
            endDebugSession(false);
            toast.error('Fix Failed', 'The error persists. Manual fix may be required.');
          }
        }
      }, 3000);
    } catch (err) {
      console.error('[AutoDebug] Error:', err);
      updateDebugSession({ status: 'failed' });
      endDebugSession(false);
      toast.error('Debug Failed', 'Could not analyze the error automatically');
    }
  }, [
    webcontainer,
    debugSession,
    startDebugSession,
    updateDebugSession,
    endDebugSession,
    clearAllRuntimeErrors,
    runtimeErrors,
    sendMessage,
    toast,
  ]);

  // Compute execution phase for enhanced messages
  const currentExecutionPhase = useMemo((): ExecutionPhase | undefined => {
    if (isGeneratingPlan) return 'thinking';
    if (isPlanExecuting) return 'executing';
    if (isVerifying) return 'verifying';
    if (verificationResult?.success) return 'complete';
    if (verificationResult && !verificationResult.success) return 'error';
    return undefined;
  }, [isGeneratingPlan, isPlanExecuting, isVerifying, verificationResult]);

  // Convert pending actions to execution tasks for the enhanced UI
  const executionTasks = useMemo((): ExecutionTask[] => {
    return pendingActions.map((action, index) => ({
      id: `action-${index}`,
      label: action.type === 'file' ? (action.filePath || 'File operation') : (action.content?.slice(0, 40) || 'Command'),
      type: action.type === 'file' ? (action.operation === 'delete' ? 'delete' : action.operation === 'modify' ? 'modify' : 'file') : 'shell',
      status: action.status === 'executing' ? 'running' : action.status || 'pending',
      filePath: action.filePath,
    }));
  }, [pendingActions]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingActions]);

  // Handle send
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  }, [input, isLoading, sendMessage]);

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Suggestions
  const suggestions = [
    'Create a counter component',
    'Add a contact form',
    'Build a card layout',
  ];

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f]">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white text-sm">Bolt</h2>
              {config.ui.showClassificationBadge && classification && (
                <ClassificationBadge classification={classification} size="sm" />
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {isLoading ? loadingMessage || 'Working...' : 'AI Assistant'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {executionHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-1.5 rounded transition-colors ${
                showHistory
                  ? 'text-violet-400 bg-violet-500/20'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
              title="Execution history"
            >
              <History className="w-4 h-4" />
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Execution History Panel */}
      {showHistory && executionHistory.length > 0 && (
        <div className="border-b border-zinc-800/50 bg-zinc-900/50 max-h-48 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/30">
            <span className="text-xs font-medium text-zinc-400">
              Recent Actions ({executionHistory.filter(h => h.canRollback).length} can rollback)
            </span>
            {executionHistory.some(h => h.canRollback) && (
              <button
                onClick={() => setShowUndoConfirm(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-colors"
              >
                <Undo2 className="w-3 h-3" />
                Undo All
              </button>
            )}
          </div>
          <div className="p-2 space-y-1">
            {executionHistory.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                  entry.result.success
                    ? 'bg-emerald-500/5 text-emerald-300'
                    : 'bg-red-500/5 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {entry.action.type === 'file' ? (
                    <FileCode className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <Terminal className="w-3 h-3 flex-shrink-0" />
                  )}
                  <span className="truncate">
                    {entry.action.type === 'file'
                      ? entry.action.filePath
                      : entry.action.content.slice(0, 30)}
                  </span>
                  {entry.result.success ? (
                    <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                  )}
                </div>
                {entry.canRollback && (
                  <button
                    onClick={async () => {
                      const success = await rollbackAction(entry.id);
                      if (success) {
                        writeToTerminal(`\x1b[33m[Bolt] Rolled back: ${entry.action.filePath}\x1b[0m\r\n`);
                        toast.success('Rolled back', entry.action.filePath || 'Action undone');
                      } else {
                        toast.error('Rollback failed', 'Could not undo this action');
                      }
                    }}
                    className="p-1 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 rounded flex-shrink-0"
                    title="Rollback this action"
                  >
                    <Undo2 className="w-3 h-3" />
                  </button>
                )}
                {!entry.result.success && (
                  <button
                    onClick={async () => {
                      const success = await retryFailedAction(entry.id);
                      if (success) {
                        toast.info('Retrying', entry.action.filePath || 'Action retrying...');
                      } else {
                        toast.error('Retry failed', 'Could not retry this action');
                      }
                    }}
                    className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded flex-shrink-0"
                    title="Retry this action"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Runtime Errors Banner */}
      {hasRuntimeErrors && (
        <RuntimeErrorBanner
          errors={runtimeErrors}
          debugSession={debugSession}
          onStartDebug={handleAutoDebug}
          onDismiss={clearRuntimeError}
          onDismissAll={clearAllRuntimeErrors}
        />
      )}

      {/* Debug Session Panel */}
      {debugSession && debugSession.status !== 'idle' && debugSession.status !== 'resolved' && (
        <div className="px-4 pt-3">
          <DebugSessionPanel
            session={debugSession}
            onCancel={() => endDebugSession(false)}
            onRetry={() => debugSession.currentError && handleAutoDebug(debugSession.currentError)}
          />
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-auto-hide p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-zinc-400 font-medium mb-1">Start a conversation</h3>
            <p className="text-zinc-600 text-sm max-w-[200px]">
              Ask me to build, modify, or explain any code
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestion(suggestion)}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-zinc-800/50 text-zinc-400 rounded-full text-xs hover:bg-zinc-800 hover:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              // In mega-complex mode, check if this is an orchestration message
              const megaType = isMegaComplexMode && message.role === 'assistant'
                ? detectMegaComplexMessageType(message.content)
                : null;

              // Render as MegaComplexMessage if it's an orchestration update
              if (megaType) {
                return (
                  <div key={message.id} className="mb-3">
                    <MegaComplexMessage
                      type={megaType}
                      title={extractMegaComplexTitle(message.content, megaType)}
                      content={message.content}
                      onViewDetails={() => setIsMegaPanelOpen(true)}
                      onApprove={megaType === 'approval' ? approveOrchestrationStep : undefined}
                      onReject={megaType === 'approval' ? () => rejectOrchestrationStep() : undefined}
                    />
                  </div>
                );
              }

              // Regular message
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  executionPhase={index === messages.length - 1 ? currentExecutionPhase : undefined}
                  executionTasks={index === messages.length - 1 ? executionTasks : undefined}
                  onOpenFile={onOpenFile}
                />
              );
            })}

            {/* Mega-Complex Mode: Progress and Todo Tracking */}
            {isMegaComplexMode && orchestrationState && (
              <div className="mb-3 space-y-2">
                {/* Pipeline Progress Indicator */}
                <div className="flex items-center justify-between">
                  <MiniProgressBadge
                    state={orchestrationState}
                  />
                  <button
                    onClick={() => setIsMegaPanelOpen(true)}
                    className="text-xs text-violet-400 hover:text-violet-300 hover:underline"
                  >
                    View Full Panel
                  </button>
                </div>

                {/* Current Todo Task */}
                {currentTodo && (
                  <CurrentTodo todo={currentTodo} />
                )}

                {/* Mini Todo List */}
                {todos.length > 0 && (
                  <MiniTodoList
                    todos={todos}
                    showCount={3}
                  />
                )}

                {/* Investigation Evidence Log (read-before-edit results) */}
                {(investigationResult || isInvestigating) && (
                  <EvidenceLog
                    investigation={investigationResult}
                    isInvestigating={isInvestigating}
                    className="mt-2"
                    onViewFile={onOpenFile}
                  />
                )}
              </div>
            )}

            {/* Mega-Complex Mode: Approval Dialog */}
            {isMegaComplexMode && orchestrationState && (
              orchestrationState === 'awaiting-approval' ||
              orchestrationState.toString().includes('awaiting')
            ) && orchestrationContext && (
              <div className="mb-3">
                <ApprovalDialog
                  request={{
                    id: `approval-${Date.now()}`,
                    type: orchestrationState === 'awaiting-approval'
                      ? (orchestrationContext.currentPhaseId ? 'phase' : 'architecture')
                      : 'research',
                    title: `Approve ${orchestrationContext.currentPhaseId || 'Architecture'}`,
                    description: orchestrationContext.error || 'Ready for your review',
                    content: orchestrationContext,
                    status: 'pending',
                    createdAt: Date.now(),
                  }}
                  onApprove={approveOrchestrationStep}
                  onReject={(reason) => rejectOrchestrationStep(reason)}
                />
              </div>
            )}

            {/* Plan Generation Loading State */}
            {isGeneratingPlan && (
              <div className="mb-3">
                <PlanPreviewSkeleton />
              </div>
            )}

            {/* Pending Plan Awaiting Approval */}
            {/* Only show if: plan exists, not executing, not generating, AND no verification results yet */}
            {/* The !isVerifying && !verificationResult check prevents flash after execution completes */}
            {pendingPlan && !isPlanExecuting && !isGeneratingPlan && !isVerifying && !verificationResult && (
              <div className="mb-3">
                <PlanPreview
                  plan={pendingPlan}
                  reasoning={planReasoning}
                  onApprove={approvePlan}
                  onCancel={cancelPlan}
                  isExecuting={false}
                />
              </div>
            )}

            {/* Plan Executing - Show TaskProgress for real-time updates */}
            {config.ui.showTaskProgress && pendingPlan && isPlanExecuting && executionProgress && (
              <div className="mb-3">
                <TaskProgress
                  plan={pendingPlan}
                  currentTaskId={executionProgress.currentTaskId || undefined}
                  completedTasks={executionProgress.completedTasks}
                  totalTasks={executionProgress.totalTasks}
                />
              </div>
            )}

            {/* Verification Status with Refinement (shown after plan execution) */}
            {(isVerifying || verificationResult || isRefining) && (
              <div className="mb-3 space-y-2">
                {/* Iteration Badge - only show during refinement iterations */}
                {config.ui.showIterationBadge && (currentIteration > 0 || isRefining) && (
                  <IterationBadge
                    iteration={currentIteration}
                    maxIterations={maxIterations}
                    status={
                      isRefining
                        ? 'refining'
                        : isPlanExecuting
                        ? 'executing'
                        : verificationResult?.success
                        ? 'success'
                        : verificationResult
                        ? 'failed'
                        : 'idle'
                    }
                  />
                )}

                {/* Verification Indicator */}
                <VerificationIndicator
                  isVerifying={isVerifying}
                  result={verificationResult ? {
                    success: verificationResult.success,
                    buildSuccess: verificationResult.success,
                    typeErrors: Array(verificationResult.typeErrors).fill({ type: 'type', message: '', severity: 'error' }),
                    moduleErrors: Array(verificationResult.moduleErrors).fill({ type: 'module', message: '', severity: 'error' }),
                    runtimeErrors: Array(verificationResult.runtimeErrors).fill({ type: 'runtime', message: '', severity: 'error' }),
                    lintErrors: [],
                    timestamp: Date.now(),
                    rawOutput: '',
                  } : null}
                />

                {/* Fix Errors Button - only show when refinement is possible */}
                {canRefine && (
                  <button
                    onClick={fixVerificationErrors}
                    disabled={isRefining || isPlanExecuting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRefining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Fixes...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Fix Errors ({maxIterations - currentIteration - 1} attempt{maxIterations - currentIteration - 1 !== 1 ? 's' : ''} left)
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Pending Actions with Progress */}
            {pendingActions.length > 0 && (
              <div className="mb-3 p-3 bg-zinc-800/30 rounded-lg space-y-3">
                <ProgressBar
                  current={pendingActions.filter(a => a.status === 'success' || a.status === 'error').length}
                  total={pendingActions.length}
                  currentLabel={
                    pendingActions.find(a => a.status === 'executing')?.filePath ||
                    pendingActions.find(a => a.status === 'executing')?.content?.slice(0, 30) ||
                    'Processing...'
                  }
                />
                <div className="flex flex-wrap gap-1">
                  {pendingActions.map((action, i) => (
                    <ActionStatusIndicator key={i} action={action} />
                  ))}
                </div>
              </div>
            )}

            {/* Pre-Verification Approval Panel (Phase 3) */}
            {pendingPreVerification && !pendingPreVerification.isClean && (
              <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {pendingPreVerification.totalErrors} Error{pendingPreVerification.totalErrors !== 1 ? 's' : ''} Found
                </div>
                <p className="text-xs text-zinc-400">
                  Pre-verification detected errors in your project. Would you like me to fix them?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={approveErrorFix}
                    disabled={isPreVerifying}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPreVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        <Wrench className="w-4 h-4" />
                        Fix Errors
                      </>
                    )}
                  </button>
                  <button
                    onClick={cancelErrorFix}
                    disabled={isPreVerifying}
                    className="px-3 py-2 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-300 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{error}</span>
          </div>
          <button
            onClick={retryLastMessage}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* Build Errors Banner */}
      {buildErrors.length > 0 && (
        <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Build Errors Detected ({buildErrors.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fixBuildErrors}
                disabled={isLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 rounded transition-colors disabled:opacity-50"
              >
                <Zap className="w-3 h-3" />
                Fix Errors
              </button>
              <button
                onClick={clearBuildErrors}
                className="p-1 text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/20 rounded transition-colors"
                title="Dismiss errors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="max-h-24 overflow-y-auto overflow-x-hidden scrollbar-thin space-y-1">
            {buildErrors.slice(0, 5).map((err, i) => (
              <div key={i} className="text-xs text-amber-200/80 font-mono">
                {err.file && err.line ? (
                  <span className="text-amber-400">{err.file}:{err.line}</span>
                ) : null}
                {err.file && err.line ? ' - ' : ''}
                {err.message}
              </div>
            ))}
            {buildErrors.length > 5 && (
              <div className="text-xs text-amber-400/60">
                ...and {buildErrors.length - 5} more error(s)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-zinc-800/50">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to build?"
            disabled={isLoading || !webcontainer}
            rows={3}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 text-sm resize-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !webcontainer}
            className="absolute right-3 bottom-3 p-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-violet-500 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>

      {/* Undo Confirmation Modal */}
      <UndoConfirmModal
        isOpen={showUndoConfirm}
        onClose={() => setShowUndoConfirm(false)}
        onConfirm={async () => {
          setIsUndoing(true);
          try {
            const count = await rollbackAll();
            if (count > 0) {
              writeToTerminal(`\x1b[33m[Bolt] Rolled back ${count} action(s)\x1b[0m\r\n`);
              toast.success('Undo complete', `Rolled back ${count} action${count !== 1 ? 's' : ''}`);
            }
          } catch (err) {
            toast.error('Undo failed', 'Could not undo actions');
          } finally {
            setIsUndoing(false);
            setShowUndoConfirm(false);
          }
        }}
        actionCount={executionHistory.filter(h => h.canRollback).length}
        actions={executionHistory
          .filter(h => h.canRollback)
          .map(h => ({
            type: h.action.type,
            path: h.action.filePath,
            content: h.action.content,
          }))}
        isLoading={isUndoing}
      />

      {/* Settings Panel */}
      <BoltSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Mega-Complex Panel Sidebar */}
      {isMegaComplexMode && orchestrationState && orchestrationContext && (
        <div
          className={`fixed inset-y-0 right-0 w-96 bg-zinc-900 border-l border-zinc-800 shadow-xl transform transition-transform duration-300 z-50 ${
            isMegaPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-white">Mega-Complex Project</h2>
            <button
              onClick={() => setIsMegaPanelOpen(false)}
              className="p-1 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-full overflow-hidden">
            <MegaComplexPanel
              state={orchestrationState}
              context={orchestrationContext}
              researchData={researchData}
              prdData={prdData}
              architectureData={architectureData}
              onApprove={approveOrchestrationStep}
              onReject={() => rejectOrchestrationStep()}
              onPause={pauseOrchestration}
              onResume={resumeOrchestration}
              onAbort={abortOrchestration}
            />
          </div>
        </div>
      )}

      {/* Backdrop for Mega Panel */}
      {isMegaPanelOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMegaPanelOpen(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// WORKBENCH
// =============================================================================

interface WorkbenchProps {
  activeTab: WorkbenchTab;
  onTabChange: (tab: WorkbenchTab) => void;
  openFiles: BoltOpenFile[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onFileChange: (path: string, content: string) => void;
  onFileClose: (path: string) => void;
  onFileSave: (path: string) => void;
}

function Workbench({
  activeTab,
  onTabChange,
  openFiles,
  activeFile,
  onFileSelect,
  onFileChange,
  onFileClose,
  onFileSave,
}: WorkbenchProps) {
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Workbench Tab Bar */}
      <div className="h-10 flex items-center justify-between px-2 bg-[#0f0f0f] border-b border-zinc-800/50 flex-shrink-0">
        <div className="flex items-center">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 mr-2 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800/50 transition-colors"
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Tabs */}
          <div className="flex items-center bg-zinc-900/50 rounded-lg p-0.5">
            <button
              onClick={() => onTabChange('code')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'code'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Code
            </button>
            <button
              onClick={() => onTabChange('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'preview'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Workbench Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'code' ? (
          <>
            {/* File Explorer Sidebar */}
            {!sidebarCollapsed && (
              <div className="w-56 flex-shrink-0 border-r border-zinc-800/50">
                <BoltFileExplorer onFileSelect={onFileSelect} selectedPath={activeFile} />
              </div>
            )}

            {/* Editor + Terminal */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Editor */}
              <div className={`flex-1 min-h-0 ${terminalCollapsed ? '' : 'h-[65%]'}`}>
                <BoltCodeEditor
                  openFiles={openFiles}
                  activeFile={activeFile}
                  onFileChange={onFileChange}
                  onFileClose={onFileClose}
                  onFileSelect={onFileSelect}
                  onFileSave={onFileSave}
                />
              </div>

              {/* Terminal */}
              <div className={`border-t border-zinc-800/50 ${terminalCollapsed ? 'h-8' : 'h-[35%]'} transition-all`}>
                {/* Terminal Header with collapse toggle */}
                <div
                  className="h-8 flex items-center justify-between px-3 bg-[#0f0f0f] cursor-pointer hover:bg-zinc-900/50 transition-colors"
                  onClick={() => setTerminalCollapsed(!terminalCollapsed)}
                >
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Terminal</span>
                  <button className="text-zinc-600 hover:text-zinc-400">
                    {terminalCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
                {!terminalCollapsed && (
                  <div className="h-[calc(100%-2rem)]">
                    <BoltTerminal />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Preview Tab */
          <div className="flex-1">
            <BoltPreview />
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN LAYOUT
// =============================================================================

function BoltMainLayout() {
  const { webcontainer, triggerFilesystemRefresh, previewUrl } = useBoltWebContainer();

  // State
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('preview');
  const [openFiles, setOpenFiles] = useState<BoltOpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // Ref for save handler
  const openFilesRef = useRef<BoltOpenFile[]>(openFiles);
  useEffect(() => {
    openFilesRef.current = openFiles;
  }, [openFiles]);

  // File handlers
  const handleFileSelect = useCallback((path: string) => {
    const name = path.split('/').pop() || path;
    setOpenFiles((prev) => {
      if (prev.some((f) => f.path === path)) return prev;
      return [...prev, { path, name }];
    });
    setActiveFile(path);
    setActiveTab('code');
  }, []);

  const handleFileClose = useCallback((path: string) => {
    setOpenFiles((prev) => {
      const remaining = prev.filter((f) => f.path !== path);
      return remaining;
    });
    setActiveFile((current) => {
      if (current === path) {
        const remaining = openFilesRef.current.filter((f) => f.path !== path);
        return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
      }
      return current;
    });
  }, []);

  const handleFileChange = useCallback((path: string, content: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content, isDirty: true } : f))
    );
  }, []);

  const handleFileSave = useCallback(
    async (path: string) => {
      if (!webcontainer) return;
      const file = openFilesRef.current.find((f) => f.path === path);

      // If no content in state, the editor might have auto-saved directly
      // Just clear the dirty flag in that case
      if (!file) return;

      try {
        // Only write to disk if we have cached content that hasn't been written yet
        // Auto-save writes directly and then calls this to clear the flag
        if (file.content && file.isDirty) {
          await webcontainer.fs.writeFile(path, file.content);
        }

        // Clear the dirty flag
        setOpenFiles((prev) =>
          prev.map((f) => (f.path === path ? { ...f, isDirty: false } : f))
        );
        triggerFilesystemRefresh();
      } catch (error) {
        console.error('[BoltPlayground] Save error:', error);
      }
    },
    [webcontainer, triggerFilesystemRefresh]
  );

  // Flush all dirty files to WebContainer before verification
  // This ensures any pending editor changes are saved
  const flushAllDirtyFiles = useCallback(async () => {
    if (!webcontainer) return;

    const dirtyFiles = openFilesRef.current.filter((f) => f.isDirty && f.content);
    if (dirtyFiles.length === 0) return;

    console.log('[BoltPlayground] Flushing', dirtyFiles.length, 'dirty file(s) before verification');

    try {
      await Promise.all(
        dirtyFiles.map(async (file) => {
          if (file.content) {
            await webcontainer.fs.writeFile(file.path, file.content);
            console.log('[BoltPlayground] Flushed:', file.path);
          }
        })
      );

      // Clear dirty flags
      setOpenFiles((prev) =>
        prev.map((f) => (dirtyFiles.some((d) => d.path === f.path) ? { ...f, isDirty: false } : f))
      );
    } catch (error) {
      console.error('[BoltPlayground] Flush error:', error);
    }
  }, [webcontainer]);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <header className="h-11 flex items-center justify-between px-4 bg-[#0f0f0f] border-b border-zinc-800/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white text-sm">Bolt Playground</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-500 text-xs font-medium">Ready</span>
          </div>
        </div>

        {previewUrl && (
          <div className="text-xs text-zinc-600 font-mono truncate max-w-[300px]">
            {previewUrl}
          </div>
        )}
      </header>

      {/* Main Content: Chat + Workbench */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel - Collapsible */}
        <div
          className={`flex-shrink-0 border-r border-zinc-800/50 transition-all duration-300 ${
            chatCollapsed ? 'w-12' : 'w-[352px]'
          }`}
        >
          {chatCollapsed ? (
            // Collapsed state - show expand button
            <div className="h-full flex flex-col items-center pt-3 bg-[#0f0f0f]">
              <button
                onClick={() => setChatCollapsed(false)}
                className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-colors"
                title="Expand chat"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <span className="text-zinc-600 text-xs [writing-mode:vertical-lr] rotate-180">Chat</span>
              </div>
            </div>
          ) : (
            // Expanded state - show full chat with collapse button
            <div className="h-full flex flex-col">
              {/* Collapse button bar */}
              <div className="absolute top-[52px] left-[340px] z-10">
                <button
                  onClick={() => setChatCollapsed(true)}
                  className="p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                  title="Collapse chat"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              <BoltChatPanel onOpenFile={handleFileSelect} flushPendingEdits={flushAllDirtyFiles} />
            </div>
          )}
        </div>

        {/* Workbench */}
        <div className="flex-1 min-w-0">
          <Workbench
            activeTab={activeTab}
            onTabChange={setActiveTab}
            openFiles={openFiles}
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
            onFileChange={handleFileChange}
            onFileClose={handleFileClose}
            onFileSave={handleFileSave}
          />
        </div>
      </div>

      {/* Status Bar */}
      <footer className="h-6 flex items-center justify-between px-3 bg-[#0f0f0f] border-t border-zinc-800/50 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Connected</span>
          </div>
          {previewUrl && (
            <span className="text-zinc-600">Dev server running</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-600">
          {activeFile && (
            <>
              <span>{activeFile.split('.').pop()?.toUpperCase()}</span>
              <span className="truncate max-w-[200px]">{activeFile}</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

// =============================================================================
// LAYOUT WRAPPER
// =============================================================================

function BoltLayoutInner() {
  const { isReady, loadingState } = useBoltWebContainer();

  if (!isReady || loadingState === 'error') {
    return <BoltLoadingScreen />;
  }

  return <BoltMainLayout />;
}

// =============================================================================
// EXPORTED COMPONENT
// =============================================================================

interface BoltPlaygroundLayoutProps {
  templateId?: string;
}

export function BoltPlaygroundLayout({ templateId }: BoltPlaygroundLayoutProps) {
  return (
    <BoltConfigProvider>
      <ToastProvider>
        <BoltWebContainerProvider templateId={templateId}>
          <BoltLayoutInner />
        </BoltWebContainerProvider>
      </ToastProvider>
    </BoltConfigProvider>
  );
}
