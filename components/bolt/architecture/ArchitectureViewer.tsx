'use client';

/**
 * ArchitectureViewer
 *
 * Interactive viewer for architecture documents.
 */

import React, { useState } from 'react';
import {
  FileCode,
  Database,
  Server,
  Layers,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Download,
  Play,
  Copy,
  CheckCircle,
  Clock,
  Zap,
} from 'lucide-react';
import type { ArchitectureDocument, ImplementationPhase } from '@/lib/bolt/architecture/types';
import { exportArchitectureToMarkdown, getArchitectureStats, getArchitectureCompleteness } from '@/lib/bolt/architecture/utils';

interface ArchitectureViewerProps {
  architecture: ArchitectureDocument;
  onStartImplementation?: (phaseId: string) => void;
  completedPhases?: Set<string>;
}

export function ArchitectureViewer({
  architecture,
  onStartImplementation,
  completedPhases = new Set(),
}: ArchitectureViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['stack', 'phases'])
  );
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const handleDownload = () => {
    const markdown = exportArchitectureToMarkdown(architecture);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${architecture.name.replace(/\s+/g, '_')}_Architecture.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const markdown = exportArchitectureToMarkdown(architecture);
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = getArchitectureStats(architecture);
  const completeness = getArchitectureCompleteness(architecture);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-800/50">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{architecture.name}</h2>
            <p className="text-sm text-zinc-400 mt-0.5 max-w-2xl">{architecture.overview}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
              <span>v{architecture.version}</span>
              <span className={`capitalize ${
                architecture.status === 'approved' ? 'text-emerald-400' :
                architecture.status === 'review' ? 'text-yellow-400' :
                'text-zinc-400'
              }`}>{architecture.status}</span>
              <span className={`flex items-center gap-1 ${
                completeness.score >= 80 ? 'text-emerald-400' :
                completeness.score >= 60 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                <Zap className="w-3 h-3" />
                {completeness.score}% complete
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-zinc-700 rounded transition-colors"
              title="Copy as Markdown"
            >
              {copied ? (
                <span className="text-xs text-emerald-400">Copied!</span>
              ) : (
                <Copy className="w-4 h-4 text-zinc-400" />
              )}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-zinc-700 rounded transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-700">
          <Stat label="Phases" value={stats.phaseCount} icon={GitBranch} />
          <Stat label="Tasks" value={stats.taskCount} icon={FileCode} />
          <Stat label="Models" value={stats.modelCount} icon={Database} />
          <Stat label="Endpoints" value={stats.endpointCount} icon={Server} />
          <Stat label="Est. Days" value={stats.estimatedDays} icon={Clock} />
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-zinc-800">
        {/* Technology Stack */}
        <Section
          title="Technology Stack"
          icon={Layers}
          isExpanded={expandedSections.has('stack')}
          onToggle={() => toggleSection('stack')}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-2">Frontend</h4>
              <ul className="space-y-1 text-sm text-zinc-300">
                <li className="flex items-center gap-2">
                  <span className="text-zinc-500">Framework:</span>
                  {architecture.stack.frontend.framework}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-zinc-500">Styling:</span>
                  {architecture.stack.frontend.styling}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-zinc-500">State:</span>
                  {architecture.stack.frontend.stateManagement}
                </li>
              </ul>
            </div>
            <div>
              {architecture.stack.database && (
                <>
                  <h4 className="text-xs font-medium text-zinc-500 mb-2">Database</h4>
                  <p className="text-sm text-zinc-300">{architecture.stack.database.engine}</p>
                </>
              )}
              {architecture.stack.infrastructure.hosting && (
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-zinc-500 mb-2">Infrastructure</h4>
                  <p className="text-sm text-zinc-300">{architecture.stack.infrastructure.hosting}</p>
                </div>
              )}
            </div>
          </div>

          {architecture.stack.frontend.libraries.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-medium text-zinc-500 mb-2">Libraries</h4>
              <div className="flex flex-wrap gap-1">
                {architecture.stack.frontend.libraries.map((lib, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 bg-zinc-800 rounded text-zinc-400"
                    title={lib.purpose}
                  >
                    {lib.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Data Models */}
        <Section
          title={`Data Models (${architecture.data.models.length})`}
          icon={Database}
          isExpanded={expandedSections.has('data')}
          onToggle={() => toggleSection('data')}
        >
          <div className="space-y-3">
            {architecture.data.models.map((model, i) => (
              <ModelCard key={i} model={model} />
            ))}
          </div>
        </Section>

        {/* API Endpoints */}
        <Section
          title={`API Endpoints (${architecture.api.endpoints.length})`}
          icon={Server}
          isExpanded={expandedSections.has('api')}
          onToggle={() => toggleSection('api')}
        >
          <div className="space-y-2">
            {architecture.api.endpoints.map((ep, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded">
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                  ep.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' :
                  ep.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                  ep.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                  ep.method === 'PATCH' ? 'bg-orange-500/20 text-orange-400' :
                  ep.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {ep.method}
                </span>
                <span className="text-sm text-white font-mono">{ep.path}</span>
                <span className="text-xs text-zinc-500 flex-1 truncate">{ep.description}</span>
                {ep.authRequired && (
                  <span className="text-[10px] px-1 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                    Auth
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Implementation Phases */}
        <Section
          title={`Implementation Phases (${architecture.phases.length})`}
          icon={GitBranch}
          isExpanded={expandedSections.has('phases')}
          onToggle={() => toggleSection('phases')}
        >
          <div className="space-y-3">
            {architecture.phases.map((phase, i) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                index={i}
                isSelected={selectedPhase === phase.id}
                isCompleted={completedPhases.has(phase.id)}
                onSelect={() => setSelectedPhase(phase.id === selectedPhase ? null : phase.id)}
                onStart={() => onStartImplementation?.(phase.id)}
              />
            ))}
          </div>
        </Section>
      </div>

      {/* Footer with progress */}
      {completedPhases.size > 0 && (
        <div className="p-4 border-t border-zinc-800 bg-zinc-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Implementation Progress</span>
            <span className="text-sm text-white">
              {completedPhases.size}/{architecture.phases.length} phases complete
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all"
              style={{ width: `${(completedPhases.size / architecture.phases.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-zinc-500" />
      <div>
        <span className="text-lg font-semibold text-violet-400">{value}</span>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 hover:bg-zinc-800/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        )}
        <Icon className="w-4 h-4 text-violet-400" />
        <span className="text-sm text-white">{title}</span>
      </button>
      {isExpanded && <div className="px-9 pb-4">{children}</div>}
    </div>
  );
}

function ModelCard({ model }: { model: { name: string; description: string; fields: Array<{ name: string; type: string; required: boolean }> } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-zinc-800/50 rounded overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <Database className="w-4 h-4 text-blue-400" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-white">{model.name}</h4>
          <p className="text-xs text-zinc-500">{model.description}</p>
        </div>
        <span className="text-xs text-zinc-600">{model.fields.length} fields</span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-zinc-700">
          <div className="mt-2 space-y-1">
            {model.fields.map((field, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-white font-mono">{field.name}</span>
                <span className="text-zinc-500">{field.type}</span>
                {field.required && (
                  <span className="text-red-400">*</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseCard({
  phase,
  index,
  isSelected,
  isCompleted,
  onSelect,
  onStart,
}: {
  phase: ImplementationPhase;
  index: number;
  isSelected: boolean;
  isCompleted: boolean;
  onSelect: () => void;
  onStart: () => void;
}) {
  const complexityColor =
    phase.complexity <= 3 ? 'text-emerald-400' :
    phase.complexity <= 6 ? 'text-yellow-400' :
    'text-red-400';

  return (
    <div className={`border rounded-lg overflow-hidden ${
      isCompleted ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-700'
    }`}>
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800/50 transition-colors"
      >
        {isCompleted ? (
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        ) : (
          <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs flex items-center justify-center">
            {index + 1}
          </span>
        )}
        <div className="flex-1 text-left">
          <h4 className="text-sm font-medium text-white">{phase.name}</h4>
          <p className="text-xs text-zinc-500">{phase.tasks.length} tasks</p>
        </div>
        <span className={`text-xs ${complexityColor}`}>
          Complexity: {phase.complexity}/10
        </span>
        {isSelected ? (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {isSelected && (
        <div className="p-3 pt-0 border-t border-zinc-800">
          <p className="text-xs text-zinc-400 mb-3">{phase.description}</p>

          {phase.goals.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-zinc-500 mb-1">Goals</h5>
              <ul className="space-y-0.5">
                {phase.goals.map((goal, i) => (
                  <li key={i} className="text-xs text-zinc-400">- {goal}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1 mb-3">
            <h5 className="text-xs font-medium text-zinc-500 mb-1">Tasks</h5>
            {phase.tasks.map((task, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-zinc-600">{i + 1}.</span>
                <span>{task.description}</span>
                {task.files.length > 0 && (
                  <span className="text-zinc-600">({task.files.length} files)</span>
                )}
              </div>
            ))}
          </div>

          {phase.dependsOn.length > 0 && (
            <p className="text-xs text-zinc-600 mb-3">
              Depends on: {phase.dependsOn.join(', ')}
            </p>
          )}

          {!isCompleted && (
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Start Phase
            </button>
          )}
        </div>
      )}
    </div>
  );
}
