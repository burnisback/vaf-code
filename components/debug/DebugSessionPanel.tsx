'use client';

/**
 * DebugSessionPanel Component
 *
 * Displays the progress of an ongoing debug session, showing the
 * detect → analyze → fix → verify workflow with visual feedback.
 */

import React, { useState } from 'react';
import {
  Bug,
  Search,
  Wrench,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { DebugSession, FixAttempt } from '@/lib/bolt/types';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface DebugSessionPanelProps {
  session: DebugSession;
  onCancel: () => void;
  onRetry: () => void;
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

interface FixAttemptRowProps {
  attempt: FixAttempt;
  index: number;
}

function FixAttemptRow({ attempt, index }: FixAttemptRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded bg-zinc-800/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-zinc-800/70 transition-colors"
      >
        <span className="text-[10px] text-zinc-500 w-4">#{index + 1}</span>
        <span className="text-xs text-zinc-400 flex-1 truncate">
          {attempt.analysis.suggestedApproach}
        </span>
        {attempt.verificationResult?.success ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
        ) : (
          <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
        )}
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-zinc-500" />
        ) : (
          <ChevronRight className="w-3 h-3 text-zinc-500" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-2 space-y-1 text-xs text-zinc-500 border-t border-zinc-700/50">
          <p className="pt-2">
            <span className="text-zinc-400">Root Cause:</span>{' '}
            {attempt.analysis.rootCause}
          </p>
          <p>
            <span className="text-zinc-400">Files:</span>{' '}
            {attempt.analysis.affectedFiles.join(', ') || 'None identified'}
          </p>
          <p>
            <span className="text-zinc-400">Confidence:</span>{' '}
            <span
              className={cn(
                attempt.analysis.confidence === 'high' && 'text-emerald-400',
                attempt.analysis.confidence === 'medium' && 'text-yellow-400',
                attempt.analysis.confidence === 'low' && 'text-red-400'
              )}
            >
              {attempt.analysis.confidence}
            </span>
          </p>
          <p>
            <span className="text-zinc-400">Result:</span>{' '}
            {attempt.verificationResult?.message || 'Pending verification'}
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DebugSessionPanel({
  session,
  onCancel,
  onRetry,
}: DebugSessionPanelProps) {
  const steps = [
    { key: 'detecting', label: 'Detecting', icon: Bug },
    { key: 'analyzing', label: 'Analyzing', icon: Search },
    { key: 'fixing', label: 'Fixing', icon: Wrench },
    { key: 'verifying', label: 'Verifying', icon: CheckCircle2 },
  ] as const;

  const currentStepIndex = steps.findIndex((s) => s.key === session.status);
  const isComplete = session.status === 'resolved' || session.status === 'failed';

  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 border-b border-zinc-700/50">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Debug Session</span>
          <span className="text-xs text-zinc-500">
            Attempt {session.fixAttempts.length + 1} of {session.maxAttempts}
          </span>
        </div>
        {!isComplete && (
          <button
            onClick={onCancel}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.key === session.status;
            const isPast = index < currentStepIndex;
            const isFuture = index > currentStepIndex && !isComplete;

            return (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                      isActive &&
                        'bg-violet-500/20 text-violet-400 ring-2 ring-violet-500/30',
                      isPast && 'bg-emerald-500/20 text-emerald-400',
                      isFuture && 'bg-zinc-800 text-zinc-600',
                      isComplete &&
                        session.status === 'resolved' &&
                        'bg-emerald-500/20 text-emerald-400',
                      isComplete &&
                        session.status === 'failed' &&
                        index <= currentStepIndex &&
                        'bg-red-500/20 text-red-400'
                    )}
                  >
                    {isActive && (
                      <div className="absolute w-8 h-8 rounded-full bg-violet-500/20 animate-ping" />
                    )}
                    <Icon className="w-4 h-4 relative z-10" />
                  </div>
                  <span
                    className={cn(
                      'text-[10px]',
                      isActive && 'text-violet-400',
                      isPast && 'text-emerald-400',
                      isFuture && 'text-zinc-600'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-px mx-2 transition-colors',
                      isPast ? 'bg-emerald-500/50' : 'bg-zinc-700'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Current Error */}
      {session.currentError && (
        <div className="px-4 pb-3">
          <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-300 font-mono truncate">
              {session.currentError.message}
            </p>
            {session.currentError.source && (
              <p className="text-[10px] text-red-400/60 mt-1">
                {session.currentError.source}
                {session.currentError.line && `:${session.currentError.line}`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Fix Attempts History */}
      {session.fixAttempts.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-zinc-500 mb-2">Previous Attempts</p>
          <div className="space-y-2">
            {session.fixAttempts.map((attempt, index) => (
              <FixAttemptRow key={attempt.id} attempt={attempt} index={index} />
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {isComplete && (
        <div
          className={cn(
            'px-4 py-3 flex items-center justify-between',
            session.status === 'resolved'
              ? 'bg-emerald-500/10 border-t border-emerald-500/20'
              : 'bg-red-500/10 border-t border-red-500/20'
          )}
        >
          <div className="flex items-center gap-2">
            {session.status === 'resolved' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-300">Error resolved!</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-300">
                  Could not resolve automatically
                </span>
              </>
            )}
          </div>
          {session.status === 'failed' && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
