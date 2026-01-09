'use client';

/**
 * ResearchProgress
 *
 * Shows real-time progress of research execution.
 */

import React from 'react';
import { Search, FileText, Loader2, Check, X, Globe } from 'lucide-react';
import type { ExecutionProgress } from '@/lib/bolt/research/executor';
import type { ResearchPhase, SearchResponse, ExtractedContent } from '@/lib/bolt/research/types';

interface ResearchProgressProps {
  /** Current progress */
  progress: ExecutionProgress | null;

  /** Completed phases */
  completedPhases: ResearchPhase[];

  /** Current phase (if executing) */
  currentPhase: ResearchPhase | null;

  /** Search results collected so far */
  searchResults: SearchResponse[];

  /** Extracted content collected so far */
  extractedContent: ExtractedContent[];

  /** Whether research is complete */
  isComplete: boolean;

  /** Error if failed */
  error?: string;

  /** Called when user wants to abort */
  onAbort?: () => void;
}

export function ResearchProgress({
  progress,
  completedPhases,
  currentPhase,
  searchResults,
  extractedContent,
  isComplete,
  error,
  onAbort,
}: ResearchProgressProps) {
  const totalResults = searchResults.reduce((sum, s) => sum + s.results.length, 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-violet-400" />
          <h3 className="text-sm font-medium text-white">Web Research</h3>
        </div>

        {!isComplete && onAbort && (
          <button
            onClick={onAbort}
            className="text-xs text-zinc-400 hover:text-red-400 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {progress && !isComplete && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{progress.action}</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="text-xs text-zinc-500">
            Phase {progress.currentPhase} of {progress.totalPhases}
          </div>
        </div>
      )}

      {/* Phases */}
      <div className="space-y-2">
        {completedPhases.map((phase) => (
          <PhaseItem key={phase.id} phase={phase} status="complete" />
        ))}
        {currentPhase && (
          <PhaseItem phase={currentPhase} status="in_progress" />
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 pt-2 border-t border-zinc-800">
        <Stat icon={Search} label="Results" value={totalResults} />
        <Stat icon={FileText} label="Pages" value={extractedContent.length} />
      </div>

      {/* Status */}
      {isComplete && !error && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <Check className="w-4 h-4" />
          <span>Research complete</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <X className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function PhaseItem({
  phase,
  status,
}: {
  phase: ResearchPhase;
  status: 'pending' | 'in_progress' | 'complete';
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {status === 'complete' && (
        <Check className="w-4 h-4 text-emerald-400" />
      )}
      {status === 'in_progress' && (
        <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
      )}
      {status === 'pending' && (
        <div className="w-4 h-4 rounded-full border border-zinc-700" />
      )}

      <span className={status === 'complete' ? 'text-zinc-400' : 'text-white'}>
        {phase.name}
      </span>

      <span className="text-xs text-zinc-600">
        {phase.queries.length} queries
      </span>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <Icon className="w-3.5 h-3.5" />
      <span>{value}</span>
      <span className="text-zinc-600">{label}</span>
    </div>
  );
}
