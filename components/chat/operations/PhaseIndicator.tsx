'use client';

import React from 'react';
import {
  Search,
  Lightbulb,
  Wrench,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { OperationPhase } from '@/lib/ai/types';

/**
 * PhaseIndicator Component
 *
 * Shows the current AI operation phase with a Bolt.new-style progress bar.
 * Phases: analyzing → planning → implementing → verifying → complete
 */

interface PhaseIndicatorProps {
  phase: OperationPhase;
  message?: string;
  progress?: {
    current: number;
    total: number;
  };
}

const PHASES: OperationPhase[] = ['analyzing', 'planning', 'implementing', 'verifying', 'complete'];

export function PhaseIndicator({ phase, message, progress }: PhaseIndicatorProps) {
  const currentIndex = PHASES.indexOf(phase);
  const isError = phase === 'error';

  return (
    <div className="px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] rounded-lg">
      {/* Phase Steps */}
      <div className="flex items-center justify-between mb-3">
        {PHASES.slice(0, -1).map((p, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isPending = index > currentIndex;

          return (
            <React.Fragment key={p}>
              <PhaseStep
                phase={p}
                isActive={isActive}
                isCompleted={isCompleted}
                isPending={isPending}
                isError={isError && isActive}
              />
              {index < PHASES.length - 2 && (
                <PhaseConnector isCompleted={isCompleted} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current Phase Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isError && phase !== 'complete' && (
            <Loader2 className="w-3 h-3 text-[var(--color-accent-primary)] animate-spin" />
          )}
          {phase === 'complete' && (
            <CheckCircle className="w-3 h-3 text-green-400" />
          )}
          {isError && (
            <AlertCircle className="w-3 h-3 text-red-400" />
          )}
          <span className="text-xs text-[var(--color-text-secondary)]">
            {message || getDefaultMessage(phase)}
          </span>
        </div>

        {progress && (
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {progress.current} / {progress.total}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mt-2 h-1 bg-[var(--color-surface-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent-primary)] transition-all duration-300 ease-out"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// PHASE STEP
// ============================================

interface PhaseStepProps {
  phase: OperationPhase;
  isActive: boolean;
  isCompleted: boolean;
  isPending: boolean;
  isError?: boolean;
}

function PhaseStep({ phase, isActive, isCompleted, isPending, isError }: PhaseStepProps) {
  const { icon: Icon, label } = getPhaseConfig(phase);

  let circleClass = 'border-[var(--color-border-default)] bg-transparent';
  let iconClass = 'text-[var(--color-text-tertiary)]';
  let labelClass = 'text-[var(--color-text-tertiary)]';

  if (isCompleted) {
    circleClass = 'border-green-500 bg-green-500';
    iconClass = 'text-white';
    labelClass = 'text-green-400';
  } else if (isActive && !isError) {
    circleClass = 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10';
    iconClass = 'text-[var(--color-accent-primary)]';
    labelClass = 'text-[var(--color-accent-primary)]';
  } else if (isError) {
    circleClass = 'border-red-500 bg-red-500/10';
    iconClass = 'text-red-400';
    labelClass = 'text-red-400';
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${circleClass}`}
      >
        {isCompleted ? (
          <CheckCircle className="w-4 h-4 text-white" />
        ) : isActive && !isError ? (
          <Loader2 className={`w-4 h-4 animate-spin ${iconClass}`} />
        ) : (
          <Icon className={`w-4 h-4 ${iconClass}`} />
        )}
      </div>
      <span className={`text-[10px] font-medium capitalize ${labelClass}`}>
        {label}
      </span>
    </div>
  );
}

// ============================================
// PHASE CONNECTOR
// ============================================

function PhaseConnector({ isCompleted }: { isCompleted: boolean }) {
  return (
    <div className="flex-1 h-0.5 mx-2 mb-5">
      <div
        className={`h-full transition-colors duration-300 ${
          isCompleted ? 'bg-green-500' : 'bg-[var(--color-border-default)]'
        }`}
      />
    </div>
  );
}

// ============================================
// COMPACT PHASE INDICATOR
// ============================================

interface CompactPhaseIndicatorProps {
  phase: OperationPhase;
  message?: string;
}

export function CompactPhaseIndicator({ phase, message }: CompactPhaseIndicatorProps) {
  const { icon: Icon } = getPhaseConfig(phase);
  const isError = phase === 'error';
  const isComplete = phase === 'complete';

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)]">
      {isComplete ? (
        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
      ) : isError ? (
        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
      ) : (
        <Icon className="w-3.5 h-3.5 text-[var(--color-accent-primary)] animate-pulse" />
      )}
      <span className={`text-xs font-medium ${
        isComplete ? 'text-green-400' :
        isError ? 'text-red-400' :
        'text-[var(--color-text-secondary)]'
      }`}>
        {message || getDefaultMessage(phase)}
      </span>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function getPhaseConfig(phase: OperationPhase) {
  switch (phase) {
    case 'analyzing':
      return { icon: Search, label: 'Analyze' };
    case 'planning':
      return { icon: Lightbulb, label: 'Plan' };
    case 'implementing':
      return { icon: Wrench, label: 'Build' };
    case 'verifying':
      return { icon: CheckCircle, label: 'Verify' };
    case 'complete':
      return { icon: CheckCircle, label: 'Done' };
    case 'error':
      return { icon: AlertCircle, label: 'Error' };
    default:
      return { icon: Loader2, label: phase };
  }
}

function getDefaultMessage(phase: OperationPhase): string {
  switch (phase) {
    case 'analyzing':
      return 'Analyzing your request...';
    case 'planning':
      return 'Planning implementation...';
    case 'implementing':
      return 'Writing code...';
    case 'verifying':
      return 'Verifying changes...';
    case 'complete':
      return 'Complete!';
    case 'error':
      return 'An error occurred';
    default:
      return 'Processing...';
  }
}
