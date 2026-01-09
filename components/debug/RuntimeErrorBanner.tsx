'use client';

/**
 * RuntimeErrorBanner Component
 *
 * Displays runtime errors captured from the preview iframe and provides
 * options to auto-fix or dismiss them.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Bug,
  Zap,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { RuntimeError, DebugSession } from '@/lib/bolt/types';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface RuntimeErrorBannerProps {
  errors: RuntimeError[];
  debugSession: DebugSession | null;
  onStartDebug: (error: RuntimeError) => void;
  onDismiss: (errorId: string) => void;
  onDismissAll: () => void;
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

interface ErrorRowProps {
  error: RuntimeError;
  onDebug: () => void;
  onDismiss: () => void;
  isDebugging: boolean;
}

function ErrorRow({ error, onDebug, onDismiss, isDebugging }: ErrorRowProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/5 group">
      <Bug className="w-3 h-3 text-red-400/50 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-red-300 truncate">{error.message}</p>
        <p className="text-[10px] text-red-400/50">
          {error.type} • {error.source || 'unknown source'}
          {error.occurrenceCount > 1 && ` • ×${error.occurrenceCount}`}
        </p>
      </div>
      {!isDebugging && (
        <button
          onClick={onDebug}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
          title="Debug this error"
        >
          <Zap className="w-3 h-3 text-red-300" />
        </button>
      )}
      <button
        onClick={onDismiss}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
        title="Dismiss"
      >
        <X className="w-3 h-3 text-red-400/50" />
      </button>
    </div>
  );
}

interface DebugStatusBadgeProps {
  status: DebugSession['status'];
}

function DebugStatusBadge({ status }: DebugStatusBadgeProps) {
  const statusConfig: Record<DebugSession['status'], { label: string; color: string }> = {
    idle: { label: 'Idle', color: 'text-zinc-300 bg-zinc-500/20' },
    detecting: { label: 'Detecting...', color: 'text-yellow-300 bg-yellow-500/20' },
    analyzing: { label: 'Analyzing...', color: 'text-blue-300 bg-blue-500/20' },
    fixing: { label: 'Applying fix...', color: 'text-violet-300 bg-violet-500/20' },
    verifying: { label: 'Verifying...', color: 'text-emerald-300 bg-emerald-500/20' },
    resolved: { label: 'Resolved!', color: 'text-green-300 bg-green-500/20' },
    failed: { label: 'Failed', color: 'text-red-300 bg-red-500/20' },
  };

  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded text-xs font-medium',
        config.color,
        'flex items-center gap-1.5'
      )}
    >
      {['detecting', 'analyzing', 'fixing', 'verifying'].includes(status) && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {config.label}
    </span>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function RuntimeErrorBanner({
  errors,
  debugSession,
  onStartDebug,
  onDismiss,
  onDismissAll,
}: RuntimeErrorBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (errors.length === 0) return null;

  const isDebugging =
    debugSession &&
    ['detecting', 'analyzing', 'fixing', 'verifying'].includes(debugSession.status);

  const primaryError = errors[0];
  const additionalCount = errors.length - 1;

  return (
    <div className="border-b border-red-500/20 bg-red-500/5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300 truncate">
            {primaryError.message}
          </span>
          {additionalCount > 0 && (
            <span className="text-xs text-red-400/70 flex-shrink-0">
              +{additionalCount} more
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-red-400/50 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-red-400/50 flex-shrink-0" />
          )}
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isDebugging ? (
            <button
              onClick={() => onStartDebug(primaryError)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium',
                'bg-red-500/20 hover:bg-red-500/30 text-red-300',
                'transition-colors'
              )}
            >
              <Zap className="w-3 h-3" />
              Auto-Fix
            </button>
          ) : (
            <DebugStatusBadge status={debugSession.status} />
          )}

          <button
            onClick={onDismissAll}
            className="p-1 hover:bg-red-500/10 rounded transition-colors"
            title="Dismiss all"
          >
            <X className="w-3.5 h-3.5 text-red-400/50" />
          </button>
        </div>
      </div>

      {/* Expanded Error List */}
      {isExpanded && (
        <div className="px-3 pb-2 space-y-1">
          {errors.map((error) => (
            <ErrorRow
              key={error.id}
              error={error}
              onDebug={() => onStartDebug(error)}
              onDismiss={() => onDismiss(error.id)}
              isDebugging={!!isDebugging}
            />
          ))}
        </div>
      )}
    </div>
  );
}
