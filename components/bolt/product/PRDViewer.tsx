'use client';

/**
 * PRDViewer
 *
 * Interactive viewer for Product Requirements Documents.
 */

import React, { useState } from 'react';
import {
  FileText,
  Users,
  Target,
  CheckSquare,
  BarChart,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  Copy,
  AlertCircle,
  Zap,
} from 'lucide-react';
import type { ProductRequirementsDocument, FeatureSpecification } from '@/lib/bolt/product/types';
import { exportPRDToMarkdown, getPRDFeatureStats, getPRDCompleteness } from '@/lib/bolt/product/utils';

interface PRDViewerProps {
  prd: ProductRequirementsDocument;
  onEdit?: () => void;
  onProceedToArchitecture?: () => void;
}

export function PRDViewer({
  prd,
  onEdit,
  onProceedToArchitecture,
}: PRDViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'features'])
  );
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
    const markdown = exportPRDToMarkdown(prd);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prd.name.replace(/\s+/g, '_')}_PRD.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const markdown = exportPRDToMarkdown(prd);
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Feature statistics
  const featureStats = getPRDFeatureStats(prd);
  const completeness = getPRDCompleteness(prd);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-800/50">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{prd.name}</h2>
            <p className="text-sm text-zinc-400 mt-0.5">{prd.tagline}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
              <span>v{prd.version}</span>
              <span className={`capitalize ${
                prd.status === 'approved' ? 'text-emerald-400' :
                prd.status === 'review' ? 'text-yellow-400' :
                'text-zinc-400'
              }`}>{prd.status}</span>
              <span>{prd.features.length} features</span>
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
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 hover:bg-zinc-700 rounded transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4 text-zinc-400" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-zinc-700">
          <Stat label="Must Have" value={featureStats.must} color="text-red-400" />
          <Stat label="Should Have" value={featureStats.should} color="text-yellow-400" />
          <Stat label="Could Have" value={featureStats.could} color="text-blue-400" />
          <Stat label="MVP Scope" value={featureStats.mvp} color="text-emerald-400" />
        </div>

        {/* Completeness Issues */}
        {completeness.issues.length > 0 && (
          <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <div className="flex items-center gap-2 text-yellow-400 text-xs font-medium mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Improvement Suggestions
            </div>
            <ul className="text-xs text-yellow-300/80 space-y-0.5">
              {completeness.issues.slice(0, 3).map((issue, i) => (
                <li key={i}>- {issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="divide-y divide-zinc-800">
        {/* Summary */}
        <Section
          title="Executive Summary"
          icon={FileText}
          isExpanded={expandedSections.has('summary')}
          onToggle={() => toggleSection('summary')}
        >
          <p className="text-sm text-zinc-300">{prd.summary}</p>
        </Section>

        {/* Problem */}
        <Section
          title="Problem Statement"
          icon={AlertTriangle}
          isExpanded={expandedSections.has('problem')}
          onToggle={() => toggleSection('problem')}
        >
          <p className="text-sm text-zinc-300 mb-3">{prd.problem.statement}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-1">Pain Points</h4>
              <ul className="space-y-1">
                {prd.problem.painPoints.map((pain, i) => (
                  <li key={i} className="text-xs text-zinc-400">- {pain}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-1">Market Gap</h4>
              <p className="text-xs text-zinc-400">{prd.problem.marketGap}</p>
            </div>
          </div>
        </Section>

        {/* Audience */}
        <Section
          title={`Target Audience (${prd.audience.length})`}
          icon={Users}
          isExpanded={expandedSections.has('audience')}
          onToggle={() => toggleSection('audience')}
        >
          <div className="space-y-3">
            {prd.audience.map((aud, i) => (
              <div key={i} className="bg-zinc-800/50 rounded p-3">
                <h4 className="text-sm font-medium text-white">{aud.name}</h4>
                <p className="text-xs text-zinc-400 mt-1">{aud.description}</p>
                <div className="mt-2">
                  <span className="text-xs text-emerald-400">{aud.value}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Goals */}
        <Section
          title={`Goals (${prd.goals.length})`}
          icon={Target}
          isExpanded={expandedSections.has('goals')}
          onToggle={() => toggleSection('goals')}
        >
          <div className="space-y-2">
            {prd.goals.map((goal, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  goal.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                  goal.priority === 'high' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {goal.priority}
                </span>
                <div>
                  <p className="text-sm text-zinc-300">{goal.description}</p>
                  <span className="text-xs text-zinc-500">{goal.type} - {goal.timeframe}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Features */}
        <Section
          title={`Features (${prd.features.length})`}
          icon={CheckSquare}
          isExpanded={expandedSections.has('features')}
          onToggle={() => toggleSection('features')}
        >
          <FeatureList features={prd.features} />
        </Section>

        {/* Metrics */}
        <Section
          title={`Success Metrics (${prd.metrics.length})`}
          icon={BarChart}
          isExpanded={expandedSections.has('metrics')}
          onToggle={() => toggleSection('metrics')}
        >
          <div className="space-y-2">
            {prd.metrics.map((metric, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded">
                <div>
                  <span className="text-sm text-white">{metric.name}</span>
                  {metric.priority === 'primary' && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded">
                      Primary
                    </span>
                  )}
                  <p className="text-xs text-zinc-500">{metric.description}</p>
                </div>
                <span className="text-sm text-violet-400">{metric.target}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Footer Actions */}
      {onProceedToArchitecture && (
        <div className="p-4 border-t border-zinc-800 bg-zinc-800/30">
          <button
            onClick={onProceedToArchitecture}
            className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded transition-colors"
          >
            Proceed to Architecture
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <span className={`text-lg font-semibold ${color}`}>{value}</span>
      <p className="text-xs text-zinc-500">{label}</p>
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

function FeatureList({ features }: { features: FeatureSpecification[] }) {
  const [filter, setFilter] = useState<'all' | 'mvp' | 'v1'>('all');

  const filtered = filter === 'all'
    ? features
    : features.filter(f => f.releaseTarget === filter);

  const priorityColors: Record<string, string> = {
    must: 'border-red-500 bg-red-500/10',
    should: 'border-yellow-500 bg-yellow-500/10',
    could: 'border-blue-500 bg-blue-500/10',
    wont: 'border-zinc-500 bg-zinc-500/10',
  };

  return (
    <div>
      {/* Filter */}
      <div className="flex gap-2 mb-3">
        {(['all', 'mvp', 'v1'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filter === f
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Features */}
      <div className="space-y-2">
        {filtered.map(feature => (
          <FeatureItem key={feature.id} feature={feature} priorityColors={priorityColors} />
        ))}
      </div>
    </div>
  );
}

function FeatureItem({
  feature,
  priorityColors
}: {
  feature: FeatureSpecification;
  priorityColors: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border-l-2 rounded-r ${priorityColors[feature.priority]}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">{feature.name}</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">{feature.category}</span>
            <span className="text-xs px-1.5 py-0.5 bg-zinc-700 rounded">
              {feature.priority}
            </span>
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-500" />
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-1">{feature.description}</p>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-xs text-emerald-400">
            <strong>Benefit:</strong> {feature.benefit}
          </div>

          {feature.userStories.length > 0 && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">User Stories:</div>
              <ul className="space-y-1">
                {feature.userStories.map((story, i) => (
                  <li key={i} className="text-xs text-zinc-400 pl-2 border-l border-zinc-700">
                    As a <span className="text-violet-400">{story.role}</span>,
                    I want to <span className="text-blue-400">{story.action}</span>,
                    so that <span className="text-emerald-400">{story.benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feature.acceptanceCriteria.length > 0 && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">Acceptance Criteria:</div>
              <ul className="space-y-0.5">
                {feature.acceptanceCriteria.map((ac, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex items-start gap-1">
                    <span className="text-zinc-600">-</span>
                    {ac}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feature.technicalNotes && (
            <div className="text-xs text-orange-400/80 bg-orange-500/10 p-2 rounded">
              <strong>Technical:</strong> {feature.technicalNotes}
            </div>
          )}

          <div className="flex items-center gap-4 text-[10px] text-zinc-600 pt-2 border-t border-zinc-800">
            <span>Complexity: {feature.complexity}/5</span>
            <span>Release: {feature.releaseTarget}</span>
            {feature.dependencies.length > 0 && (
              <span>Depends on: {feature.dependencies.join(', ')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
