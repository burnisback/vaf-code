'use client';

import React from 'react';
import {
  Crown,
  ClipboardList,
  Layers,
  Monitor,
  Server,
  FlaskConical,
  Palette,
  CheckCircle,
  Search,
  FolderSearch,
  BadgeCheck,
  Rocket,
  Sparkles,
  Loader2,
  FileJson,
  CheckCircle2,
  AlertCircle,
  FolderOpen
} from 'lucide-react';
import { useWebContainer } from '@/lib/webcontainer/context';
import { useProjectAnalysis } from '@/hooks/useProjectAnalysis';

interface AgentNode {
  id: string;
  name: string;
  role: string;
  icon: React.ComponentType<{ className?: string }>;
  level: number;
  children?: AgentNode[];
}

const agentHierarchy: AgentNode[] = [
  {
    id: 'orchestrator',
    name: 'VAF-ORCHESTRATOR',
    role: 'CEO / Root Coordinator',
    icon: Crown,
    level: 0,
    children: [
      {
        id: 'pm',
        name: 'VAF-PM',
        role: 'Product Manager',
        icon: ClipboardList,
        level: 1,
      },
      {
        id: 'architect',
        name: 'VAF-Architect',
        role: 'Solution Architect',
        icon: Layers,
        level: 1,
        children: [
          {
            id: 'frontend',
            name: 'VAF-Frontend',
            role: 'Frontend Engineer',
            icon: Monitor,
            level: 2,
          },
          {
            id: 'backend',
            name: 'VAF-Backend',
            role: 'Backend Engineer',
            icon: Server,
            level: 2,
          },
          {
            id: 'unit-test',
            name: 'VAF-Unit Test Engineer',
            role: 'Unit Testing Specialist',
            icon: FlaskConical,
            level: 2,
          },
        ],
      },
      {
        id: 'designer',
        name: 'VAF-Designer',
        role: 'UX/UI Designer',
        icon: Palette,
        level: 1,
      },
      {
        id: 'qa',
        name: 'VAF-QA',
        role: 'Quality Assurance',
        icon: CheckCircle,
        level: 1,
      },
      {
        id: 'researcher',
        name: 'VAF-Researcher',
        role: 'Research & Analysis',
        icon: Search,
        level: 1,
      },
      {
        id: 'filefinder',
        name: 'VAF-FileFinder',
        role: 'Code Navigation',
        icon: FolderSearch,
        level: 1,
      },
      {
        id: 'validator',
        name: 'VAF-Validator',
        role: 'Validation & Compliance',
        icon: BadgeCheck,
        level: 1,
        children: [
          {
            id: 'release',
            name: 'VAF-Release',
            role: 'Release Manager',
            icon: Rocket,
            level: 2,
          },
        ],
      },
    ],
  },
];

interface AgentCardProps {
  agent: AgentNode;
  isRoot?: boolean;
}

function AgentCard({ agent, isRoot = false }: AgentCardProps) {
  const Icon = agent.icon;

  const levelStyles = {
    0: {
      card: 'px-6 py-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/30 shadow-xl',
      iconBg: 'bg-gradient-to-br from-purple-500/20 to-blue-500/20',
      iconColor: 'text-purple-400',
      iconSize: 'w-8 h-8',
      titleSize: 'text-lg',
    },
    1: {
      card: 'px-4 py-3 bg-[var(--color-surface-secondary)] border-[var(--color-border-default)] shadow-sm',
      iconBg: 'bg-[var(--color-surface-tertiary)]',
      iconColor: 'text-[var(--color-accent-primary)]',
      iconSize: 'w-6 h-6',
      titleSize: 'text-base',
    },
    2: {
      card: 'px-3 py-2.5 bg-[var(--color-surface-tertiary)] border-[var(--color-border-default)] shadow-sm',
      iconBg: 'bg-[var(--color-surface-secondary)]',
      iconColor: 'text-[var(--color-accent-primary)]',
      iconSize: 'w-5 h-5',
      titleSize: 'text-sm',
    },
  };

  const style = levelStyles[agent.level as keyof typeof levelStyles] || levelStyles[2];

  return (
    <div
      className={`
        relative rounded-lg border transition-all duration-200
        hover:shadow-lg hover:border-[var(--color-accent-primary)]/30
        ${style.card}
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 rounded-lg p-2 ${style.iconBg}`}>
          <Icon className={`${style.iconSize} ${style.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-[var(--color-text-primary)] ${style.titleSize}`}>
            {agent.name}
          </h3>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            {agent.role}
          </p>
        </div>
      </div>
    </div>
  );
}

interface HierarchyNodeProps {
  agent: AgentNode;
  isRoot?: boolean;
  isLast?: boolean;
}

function HierarchyNode({ agent, isRoot = false, isLast = false }: HierarchyNodeProps) {
  const hasChildren = agent.children && agent.children.length > 0;

  return (
    <div className="relative">
      <AgentCard agent={agent} isRoot={isRoot} />

      {hasChildren && (
        <div className="relative mt-4 ml-8 space-y-4">
          {/* Vertical connector line */}
          <div
            className="absolute w-px bg-[var(--color-border-default)]"
            style={{ left: '-1.25rem', top: 0, bottom: '1rem' }}
          />

          {agent.children!.map((child, index) => (
            <div key={child.id} className="relative">
              {/* Horizontal connector line */}
              <div
                className="absolute h-px bg-[var(--color-border-default)]"
                style={{ left: '-1.25rem', top: '1.25rem', width: '1.25rem' }}
              />

              {/* Hide vertical line below last item */}
              {index === agent.children!.length - 1 && (
                <div
                  className="absolute w-px bg-[var(--color-surface-primary)]"
                  style={{
                    left: '-1.25rem',
                    top: '1.25rem',
                    bottom: 0,
                    width: '2px'
                  }}
                />
              )}

              <HierarchyNode
                agent={child}
                isLast={index === agent.children!.length - 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkflowTab() {
  const { webcontainer } = useWebContainer();
  const {
    isAnalyzing,
    isComplete,
    error,
    summary,
    progress,
    analyze,
  } = useProjectAnalysis({ webcontainer, mode: 'full' });

  return (
    <div className="h-full overflow-auto bg-[var(--color-surface-primary)]">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Orchestrator Actions */}
        <div className="mb-8 p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Orchestrator Actions</h3>
          </div>

          <button
            onClick={() => analyze()}
            disabled={isAnalyzing}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{progress.message}</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-5 h-5" />
                <span>Analyze Project</span>
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {isComplete && summary && (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-300 mb-3">Analysis Complete</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[var(--color-surface-tertiary)] rounded-lg">
                      <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Project</p>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{summary.name}</p>
                    </div>
                    <div className="p-3 bg-[var(--color-surface-tertiary)] rounded-lg">
                      <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Framework</p>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{summary.technology.framework}</p>
                    </div>
                    <div className="p-3 bg-[var(--color-surface-tertiary)] rounded-lg">
                      <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Files</p>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{summary.structure.totalFiles}</p>
                    </div>
                    <div className="p-3 bg-[var(--color-surface-tertiary)] rounded-lg">
                      <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Architecture</p>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{summary.architecture.pattern}</p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-purple-400" />
                    <p className="text-xs text-purple-300">Saved to docs/project-summary.json</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              AI Agent Pipeline
            </h2>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Preview
            </span>
          </div>
          <p className="text-[var(--color-text-tertiary)]">
            Hierarchical agent organization for automated web development workflow
          </p>
        </div>

        {/* Hierarchy Diagram */}
        <div className="bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border-default)] p-6">
          {agentHierarchy.map((rootAgent) => (
            <HierarchyNode
              key={rootAgent.id}
              agent={rootAgent}
              isRoot={true}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 p-6 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border-default)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
            Agent Roles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Crown className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">Orchestrator:</span>
                  <span className="text-[var(--color-text-tertiary)] ml-1">Coordinates entire workflow</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Layers className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">Architect:</span>
                  <span className="text-[var(--color-text-tertiary)] ml-1">Technical design & planning</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Monitor className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">Frontend:</span>
                  <span className="text-[var(--color-text-tertiary)] ml-1">UI implementation</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Server className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">Backend:</span>
                  <span className="text-[var(--color-text-tertiary)] ml-1">API & data layer</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">QA:</span>
                  <span className="text-[var(--color-text-tertiary)] ml-1">Quality assurance</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <BadgeCheck className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">Validator:</span>
                  <span className="text-[var(--color-text-tertiary)] ml-1">Compliance checks</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Search className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">Researcher:</span>
                  <span className="text-[var(--color-text-tertiary)] ml-1">Analysis & insights</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Rocket className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">Release:</span>
                  <span className="text-[var(--color-text-tertiary)] ml-1">Deployment management</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
