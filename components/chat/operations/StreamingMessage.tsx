'use client';

import React, { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { FileOperationCard, OperationStatus } from './FileOperationCard';
import { PhaseIndicator, CompactPhaseIndicator } from './PhaseIndicator';
import type {
  StreamChunkV2,
  FileOperationV2,
  OperationPhase,
  ExecutionResult
} from '@/lib/ai/types';

/**
 * StreamingMessage Component
 *
 * Displays an AI message with Bolt.new-style streaming file operations.
 * Shows phase indicator, text content, and file operation cards.
 */

interface StreamingMessageProps {
  /** Text content accumulated so far */
  textContent: string;
  /** Current operation phase */
  phase: OperationPhase;
  /** Phase status message */
  phaseMessage?: string;
  /** File operations received */
  operations: FileOperationV2[];
  /** Execution results for operations */
  executionResults: Map<string, ExecutionResult>;
  /** Whether still streaming */
  isStreaming: boolean;
  /** Handler to retry failed operation */
  onRetryOperation?: (operation: FileOperationV2) => void;
  /** Handler to open file in editor */
  onOpenFile?: (path: string) => void;
}

export function StreamingMessage({
  textContent,
  phase,
  phaseMessage,
  operations,
  executionResults,
  isStreaming,
  onRetryOperation,
  onOpenFile
}: StreamingMessageProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] w-full">
        {/* Message Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            VAF Code
          </span>
          {isStreaming && (
            <CompactPhaseIndicator phase={phase} message={phaseMessage} />
          )}
        </div>

        {/* Main Content Area */}
        <div className="ml-9 space-y-3">
          {/* Phase Indicator (full version, shown during streaming) */}
          {isStreaming && operations.length > 0 && (
            <PhaseIndicator
              phase={phase}
              message={phaseMessage}
              progress={
                operations.length > 1
                  ? {
                      current: Array.from(executionResults.values()).filter(
                        r => r.status === 'success'
                      ).length,
                      total: operations.length
                    }
                  : undefined
              }
            />
          )}

          {/* Text Content */}
          {textContent && (
            <div className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
              {textContent}
              {isStreaming && phase !== 'implementing' && (
                <span className="inline-block w-2 h-4 ml-1 bg-[var(--color-accent-primary)] animate-pulse" />
              )}
            </div>
          )}

          {/* File Operations */}
          {operations.length > 0 && (
            <div className="space-y-2">
              {operations.map((operation, index) => {
                const result = executionResults.get(operation.path);
                const status = getOperationStatus(result, isStreaming, index, operations.length);

                return (
                  <FileOperationCard
                    key={`${operation.path}-${index}`}
                    operation={operation}
                    status={status}
                    error={result?.error}
                    onRetry={
                      result?.status === 'error' && onRetryOperation
                        ? () => onRetryOperation(operation)
                        : undefined
                    }
                    onOpenFile={onOpenFile}
                  />
                );
              })}
            </div>
          )}

          {/* Completion Summary */}
          {!isStreaming && operations.length > 0 && (
            <CompletionSummary
              operations={operations}
              executionResults={executionResults}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPLETION SUMMARY
// ============================================

interface CompletionSummaryProps {
  operations: FileOperationV2[];
  executionResults: Map<string, ExecutionResult>;
}

function CompletionSummary({ operations, executionResults }: CompletionSummaryProps) {
  const results = Array.from(executionResults.values());
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalTime = results.reduce((sum, r) => {
    if (r.endTime && r.startTime) {
      return sum + (r.endTime - r.startTime);
    }
    return sum;
  }, 0);

  if (errorCount === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded-lg">
        <span>✓</span>
        <span>
          {successCount} file{successCount !== 1 ? 's' : ''} updated successfully
          {totalTime > 0 && ` in ${totalTime}ms`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
      <span>⚠</span>
      <span>
        {successCount} succeeded, {errorCount} failed
      </span>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function getOperationStatus(
  result: ExecutionResult | undefined,
  isStreaming: boolean,
  index: number,
  totalOperations: number
): OperationStatus {
  if (result) {
    return result.status as OperationStatus;
  }

  if (isStreaming) {
    // Show executing for current operation, pending for future ones
    if (index === totalOperations - 1) {
      return 'executing';
    }
    return 'pending';
  }

  return 'pending';
}

// ============================================
// LOADING STATE
// ============================================

export function StreamingMessageLoading() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            VAF Code
          </span>
        </div>
        <div className="ml-9">
          <CompactPhaseIndicator phase="analyzing" message="Thinking..." />
        </div>
      </div>
    </div>
  );
}
