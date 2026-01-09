'use client';

/**
 * IterationBadge
 *
 * Shows current refinement iteration status with visual progress dots.
 * Used to indicate the iteration number during plan refinement loops.
 */

import React from 'react';
import { RefreshCw, Check, AlertTriangle, Loader2 } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type IterationStatus = 'idle' | 'executing' | 'success' | 'failed' | 'refining';

export interface IterationBadgeProps {
  /** Current iteration number (0-indexed) */
  iteration: number;
  /** Maximum allowed iterations */
  maxIterations?: number;
  /** Current status */
  status: IterationStatus;
  /** Optional className for container */
  className?: string;
}

export interface IterationDotsProps {
  /** Current iteration number (0-indexed) */
  iteration: number;
  /** Maximum allowed iterations */
  maxIterations: number;
  /** Current status */
  status: IterationStatus;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Visual dots indicating iteration progress
 */
export function IterationDots({ iteration, maxIterations, status }: IterationDotsProps) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: maxIterations }).map((_, i) => {
        let dotClass = 'w-2 h-2 rounded-full transition-all duration-300 ';

        if (i < iteration) {
          // Past iterations
          dotClass += 'bg-violet-500';
        } else if (i === iteration) {
          // Current iteration
          if (status === 'executing' || status === 'refining') {
            dotClass += 'bg-violet-400 animate-pulse ring-2 ring-violet-400/30';
          } else if (status === 'success') {
            dotClass += 'bg-emerald-400';
          } else if (status === 'failed') {
            dotClass += 'bg-red-400';
          } else {
            dotClass += 'bg-violet-400';
          }
        } else {
          // Future iterations
          dotClass += 'bg-zinc-700';
        }

        return <div key={i} className={dotClass} />;
      })}
    </div>
  );
}

/**
 * Main IterationBadge component
 */
export function IterationBadge({
  iteration,
  maxIterations = 3,
  status,
  className = '',
}: IterationBadgeProps) {
  const isInitial = iteration === 0;
  const isFinal = iteration >= maxIterations - 1;

  // Get status text
  const getStatusText = (): string => {
    if (status === 'idle') return isInitial ? 'Ready' : 'Waiting';
    if (status === 'executing') {
      return isInitial ? 'Running...' : `Refinement ${iteration}...`;
    }
    if (status === 'refining') return 'Generating fixes...';
    if (status === 'success') return 'Complete';
    if (status === 'failed') {
      return isFinal ? 'Max attempts reached' : 'Errors found';
    }
    return '';
  };

  // Get status icon
  const getStatusIcon = (): React.ReactNode => {
    switch (status) {
      case 'refining':
        return <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin" />;
      case 'executing':
        return <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />;
      case 'success':
        return <Check className="w-3.5 h-3.5 text-emerald-400" />;
      case 'failed':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return null;
    }
  };

  // Get container classes based on status
  const getContainerClass = (): string => {
    let base = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ';

    switch (status) {
      case 'executing':
      case 'refining':
        return base + 'bg-violet-500/10 border border-violet-500/20';
      case 'success':
        return base + 'bg-emerald-500/10 border border-emerald-500/20';
      case 'failed':
        return base + 'bg-red-500/10 border border-red-500/20';
      default:
        return base + 'bg-zinc-800/50 border border-zinc-700/50';
    }
  };

  return (
    <div className={`${getContainerClass()} ${className}`}>
      <IterationDots
        iteration={iteration}
        maxIterations={maxIterations}
        status={status}
      />

      <span className="text-xs text-zinc-400">{getStatusText()}</span>

      {getStatusIcon()}
    </div>
  );
}

// =============================================================================
// COMPACT VARIANT
// =============================================================================

export interface CompactIterationBadgeProps {
  /** Current iteration number (0-indexed) */
  iteration: number;
  /** Maximum allowed iterations */
  maxIterations?: number;
  /** Current status */
  status: IterationStatus;
}

/**
 * Compact version showing just iteration number
 */
export function CompactIterationBadge({
  iteration,
  maxIterations = 3,
  status,
}: CompactIterationBadgeProps) {
  // Get color based on status
  const getColor = (): string => {
    switch (status) {
      case 'executing':
      case 'refining':
        return 'text-violet-400';
      case 'success':
        return 'text-emerald-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-zinc-400';
    }
  };

  return (
    <span className={`text-xs font-medium ${getColor()}`}>
      {iteration + 1}/{maxIterations}
      {status === 'refining' && (
        <RefreshCw className="w-3 h-3 ml-1 inline animate-spin" />
      )}
    </span>
  );
}

// =============================================================================
// DETAILED VARIANT
// =============================================================================

export interface DetailedIterationBadgeProps {
  /** Current iteration number (0-indexed) */
  iteration: number;
  /** Maximum allowed iterations */
  maxIterations?: number;
  /** Current status */
  status: IterationStatus;
  /** Number of remaining attempts */
  remainingAttempts?: number;
  /** Whether the errors are fixable */
  errorsFixable?: boolean;
  /** Optional className for container */
  className?: string;
}

/**
 * Detailed version with more information
 */
export function DetailedIterationBadge({
  iteration,
  maxIterations = 3,
  status,
  remainingAttempts,
  errorsFixable = true,
  className = '',
}: DetailedIterationBadgeProps) {
  const remaining = remainingAttempts ?? (maxIterations - iteration - 1);

  return (
    <div className={`bg-zinc-900/50 rounded-lg border border-zinc-800/50 p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-400">
          Refinement Progress
        </span>
        <CompactIterationBadge
          iteration={iteration}
          maxIterations={maxIterations}
          status={status}
        />
      </div>

      <IterationDots
        iteration={iteration}
        maxIterations={maxIterations}
        status={status}
      />

      {status === 'failed' && remaining > 0 && errorsFixable && (
        <p className="text-xs text-zinc-500 mt-2">
          {remaining} attempt{remaining !== 1 ? 's' : ''} remaining
        </p>
      )}

      {status === 'failed' && remaining === 0 && (
        <p className="text-xs text-red-400/80 mt-2">
          Maximum refinement attempts reached. Manual intervention required.
        </p>
      )}

      {status === 'failed' && !errorsFixable && (
        <p className="text-xs text-amber-400/80 mt-2">
          Some errors may require manual fixes.
        </p>
      )}
    </div>
  );
}

export default IterationBadge;
