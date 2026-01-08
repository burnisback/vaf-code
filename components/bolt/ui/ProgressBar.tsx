/**
 * Progress Bar Component
 *
 * Visual progress indicator for multi-action execution.
 * Features:
 * - Animated progress
 * - Current action label
 * - Step indicator (e.g., "1/3")
 */

'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface ProgressBarProps {
  current: number;
  total: number;
  currentLabel?: string;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProgressBar({ current, total, currentLabel, className = '' }: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
          <span className="text-xs text-zinc-400">
            {currentLabel || 'Processing...'}
          </span>
        </div>
        <span className="text-xs text-zinc-500 font-mono">
          {current}/{total}
        </span>
      </div>

      {/* Progress Track */}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// STEP PROGRESS
// =============================================================================

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface StepProgressProps {
  steps: Step[];
  className?: string;
}

export function StepProgress({ steps, className = '' }: StepProgressProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {steps.map((step, index) => {
        const statusStyles = {
          pending: 'bg-zinc-800 text-zinc-500',
          active: 'bg-violet-500/20 text-violet-400 ring-2 ring-violet-500/30',
          complete: 'bg-emerald-500/20 text-emerald-400',
          error: 'bg-red-500/20 text-red-400',
        };

        const iconStyles = {
          pending: 'bg-zinc-700 text-zinc-500',
          active: 'bg-violet-500 text-white',
          complete: 'bg-emerald-500 text-white',
          error: 'bg-red-500 text-white',
        };

        return (
          <div
            key={step.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${statusStyles[step.status]}`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${iconStyles[step.status]}`}
            >
              {step.status === 'complete' ? (
                '✓'
              ) : step.status === 'error' ? (
                '✗'
              ) : step.status === 'active' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                index + 1
              )}
            </div>
            <span className="text-sm truncate">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
