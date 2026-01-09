'use client';

/**
 * MegaComplexPanel
 *
 * Unified panel for mega-complex project execution showing
 * research, PRD, architecture, and implementation progress.
 */

import React, { useState } from 'react';
import type {
  OrchestrationState,
  OrchestrationContext,
  ExecutionProgress,
} from '@/lib/bolt/orchestration/types';
import { OrchestrationPanel } from '../orchestration/OrchestrationPanel';

// =============================================================================
// ICONS
// =============================================================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 01-9 9" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

// =============================================================================
// TYPES
// =============================================================================

interface MegaComplexPanelProps {
  /** Current orchestration state */
  state: OrchestrationState;

  /** Current orchestration context */
  context: OrchestrationContext;

  /** Research data (if available) */
  researchData?: unknown;

  /** PRD data (if available) */
  prdData?: unknown;

  /** Architecture data (if available) */
  architectureData?: unknown;

  /** Called when user approves current stage */
  onApprove: () => void;

  /** Called when user rejects current stage */
  onReject: () => void;

  /** Called when user pauses execution */
  onPause: () => void;

  /** Called when user resumes execution */
  onResume: () => void;

  /** Called when user aborts execution */
  onAbort: () => void;
}

type TabId = 'progress' | 'research' | 'prd' | 'architecture';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MegaComplexPanel({
  state,
  context,
  researchData,
  prdData,
  architectureData,
  onApprove,
  onReject,
  onPause,
  onResume,
  onAbort,
}: MegaComplexPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('progress');

  // Determine which tabs are available
  const hasResearch = !!context.researchSessionId || !!researchData;
  const hasPRD = !!context.prdId || !!prdData;
  const hasArchitecture = !!context.architectureId || !!architectureData;

  const progress = calculateProgress(state, context);

  return (
    <div className="h-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <h2 className="text-sm font-medium text-white">Mega-Complex Project</h2>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">
          {context.originalPrompt}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-800 bg-zinc-950/50">
        <TabButton
          active={activeTab === 'progress'}
          onClick={() => setActiveTab('progress')}
          icon={<PlayIcon className="w-4 h-4" />}
          label="Progress"
        />
        {hasResearch && (
          <TabButton
            active={activeTab === 'research'}
            onClick={() => setActiveTab('research')}
            icon={<SearchIcon className="w-4 h-4" />}
            label="Research"
          />
        )}
        {hasPRD && (
          <TabButton
            active={activeTab === 'prd'}
            onClick={() => setActiveTab('prd')}
            icon={<FileTextIcon className="w-4 h-4" />}
            label="PRD"
          />
        )}
        {hasArchitecture && (
          <TabButton
            active={activeTab === 'architecture'}
            onClick={() => setActiveTab('architecture')}
            icon={<GitBranchIcon className="w-4 h-4" />}
            label="Architecture"
          />
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin p-3">
        {activeTab === 'progress' && (
          <OrchestrationPanel
            state={state}
            context={context}
            progress={progress}
            onApprove={onApprove}
            onReject={onReject}
            onPause={onPause}
            onResume={onResume}
            onAbort={onAbort}
          />
        )}

        {activeTab === 'research' && hasResearch && (
          <ResearchPreview data={researchData} sessionId={context.researchSessionId} />
        )}

        {activeTab === 'prd' && hasPRD && (
          <PRDPreview data={prdData} prdId={context.prdId} />
        )}

        {activeTab === 'architecture' && hasArchitecture && (
          <ArchitecturePreview data={architectureData} archId={context.architectureId} />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors
        border-b-2 -mb-px
        ${active
          ? 'border-violet-500 text-white'
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

interface ResearchPreviewProps {
  data?: unknown;
  sessionId?: string;
}

function ResearchPreview({ data, sessionId }: ResearchPreviewProps) {
  if (!data && !sessionId) {
    return (
      <div className="text-center text-zinc-500 text-sm py-8">
        Research data not available
      </div>
    );
  }

  const synthesis = data as {
    summary?: string;
    competitors?: Array<{ name: string; description?: string }>;
    findings?: Array<{ title: string; description?: string }>;
    recommendations?: string[];
  } | undefined;

  return (
    <div className="space-y-4">
      {sessionId && (
        <div className="text-xs text-zinc-500">
          Session: <code className="bg-zinc-800 px-1 rounded">{sessionId}</code>
        </div>
      )}

      {synthesis?.summary && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-1">Summary</h4>
          <p className="text-sm text-zinc-300">{synthesis.summary}</p>
        </div>
      )}

      {synthesis?.competitors && synthesis.competitors.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2">
            Competitors ({synthesis.competitors.length})
          </h4>
          <div className="space-y-2">
            {synthesis.competitors.slice(0, 5).map((comp, i) => (
              <div key={i} className="bg-zinc-800/50 rounded p-2">
                <div className="text-sm font-medium text-white">{comp.name}</div>
                {comp.description && (
                  <div className="text-xs text-zinc-400 mt-0.5">{comp.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {synthesis?.recommendations && synthesis.recommendations.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2">Recommendations</h4>
          <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
            {synthesis.recommendations.slice(0, 5).map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface PRDPreviewProps {
  data?: unknown;
  prdId?: string;
}

function PRDPreview({ data, prdId }: PRDPreviewProps) {
  if (!data && !prdId) {
    return (
      <div className="text-center text-zinc-500 text-sm py-8">
        PRD data not available
      </div>
    );
  }

  const prd = data as {
    name?: string;
    tagline?: string;
    overview?: string;
    features?: Array<{ name: string; priority: string; description?: string }>;
  } | undefined;

  return (
    <div className="space-y-4">
      {prdId && (
        <div className="text-xs text-zinc-500">
          Document: <code className="bg-zinc-800 px-1 rounded">{prdId}</code>
        </div>
      )}

      {prd?.name && (
        <div>
          <h3 className="text-lg font-semibold text-white">{prd.name}</h3>
          {prd.tagline && (
            <p className="text-sm text-zinc-400">{prd.tagline}</p>
          )}
        </div>
      )}

      {prd?.overview && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-1">Overview</h4>
          <p className="text-sm text-zinc-300">{prd.overview}</p>
        </div>
      )}

      {prd?.features && prd.features.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2">
            Features ({prd.features.length})
          </h4>
          <div className="space-y-2">
            {prd.features.slice(0, 5).map((feature, i) => (
              <div key={i} className="bg-zinc-800/50 rounded p-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{feature.name}</span>
                  <PriorityBadge priority={feature.priority} />
                </div>
                {feature.description && (
                  <div className="text-xs text-zinc-400 mt-0.5">{feature.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    must: 'bg-red-500/20 text-red-400',
    should: 'bg-yellow-500/20 text-yellow-400',
    could: 'bg-blue-500/20 text-blue-400',
    wont: 'bg-zinc-500/20 text-zinc-400',
  };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[priority] || colors.could}`}>
      {priority}
    </span>
  );
}

interface ArchitecturePreviewProps {
  data?: unknown;
  archId?: string;
}

function ArchitecturePreview({ data, archId }: ArchitecturePreviewProps) {
  if (!data && !archId) {
    return (
      <div className="text-center text-zinc-500 text-sm py-8">
        Architecture data not available
      </div>
    );
  }

  const arch = data as {
    name?: string;
    overview?: string;
    stack?: {
      frontend?: { framework?: string; styling?: string };
      backend?: { framework?: string };
    };
    phases?: Array<{ name: string; description?: string }>;
  } | undefined;

  return (
    <div className="space-y-4">
      {archId && (
        <div className="text-xs text-zinc-500">
          Document: <code className="bg-zinc-800 px-1 rounded">{archId}</code>
        </div>
      )}

      {arch?.name && (
        <h3 className="text-lg font-semibold text-white">{arch.name}</h3>
      )}

      {arch?.overview && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-1">Overview</h4>
          <p className="text-sm text-zinc-300">{arch.overview}</p>
        </div>
      )}

      {arch?.stack && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2">Tech Stack</h4>
          <div className="flex flex-wrap gap-2">
            {arch.stack.frontend?.framework && (
              <TechBadge label={arch.stack.frontend.framework} />
            )}
            {arch.stack.frontend?.styling && (
              <TechBadge label={arch.stack.frontend.styling} />
            )}
            {arch.stack.backend?.framework && (
              <TechBadge label={arch.stack.backend.framework} />
            )}
          </div>
        </div>
      )}

      {arch?.phases && arch.phases.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2">
            Phases ({arch.phases.length})
          </h4>
          <div className="space-y-2">
            {arch.phases.map((phase, i) => (
              <div key={i} className="bg-zinc-800/50 rounded p-2">
                <div className="text-sm font-medium text-white">
                  Phase {i + 1}: {phase.name}
                </div>
                {phase.description && (
                  <div className="text-xs text-zinc-400 mt-0.5">{phase.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TechBadge({ label }: { label: string }) {
  return (
    <span className="text-xs px-2 py-1 bg-violet-500/20 text-violet-300 rounded">
      {label}
    </span>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function calculateProgress(state: OrchestrationState, context: OrchestrationContext): ExecutionProgress {
  const stages = ['Research', 'Product Definition', 'Architecture', 'Implementation', 'Verification'];

  // Determine completed stages
  const completedStages: string[] = [];
  if (context.researchSessionId) completedStages.push('Research');
  if (context.prdId) completedStages.push('Product Definition');
  if (context.architectureId) completedStages.push('Architecture');
  context.completedPhases.forEach((p) => completedStages.push(`Phase: ${p}`));

  // Determine current stage
  let currentStage = 'Ready';
  if (state === 'researching') currentStage = 'Research';
  else if (state === 'defining-product') currentStage = 'Product Definition';
  else if (state === 'generating-architecture') currentStage = 'Architecture';
  else if (state === 'executing-phase' || state === 'planning-phase') currentStage = 'Implementation';
  else if (state === 'verifying') currentStage = 'Verification';
  else if (state === 'awaiting-approval') currentStage = 'Awaiting Approval';
  else if (state === 'complete') currentStage = 'Complete';
  else if (state === 'failed') currentStage = 'Failed';

  // Calculate percentage
  const totalSteps = 5; // Research, PRD, Arch, Impl, Verify
  let completed = 0;
  if (context.researchSessionId) completed++;
  if (context.prdId) completed++;
  if (context.architectureId) completed++;
  if (context.completedPhases.length > 0) completed++;
  if (state === 'complete') completed = totalSteps;

  const percentage = state === 'complete' ? 100 : Math.round((completed / totalSteps) * 100);

  // Remaining stages
  const remainingStages = stages.filter((s) => !completedStages.includes(s));

  return {
    percentage,
    stage: currentStage,
    stageDetails: getStageDetails(state),
    completedStages,
    remainingStages,
  };
}

function getStageDetails(state: OrchestrationState): string {
  const details: Record<OrchestrationState, string> = {
    idle: 'Ready to start',
    researching: 'Searching and analyzing...',
    'defining-product': 'Generating PRD...',
    'generating-architecture': 'Designing architecture...',
    'planning-phase': 'Planning next phase...',
    'executing-phase': 'Building code...',
    verifying: 'Running verification...',
    refining: 'Fixing issues...',
    'awaiting-approval': 'Waiting for your input',
    paused: 'Execution paused',
    complete: 'Project successfully built!',
    failed: 'Execution failed',
  };
  return details[state];
}
