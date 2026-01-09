'use client';

/**
 * ResearchResults
 *
 * Displays research synthesis results in a readable format.
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Trophy,
  Lightbulb,
  Target,
  AlertTriangle,
} from 'lucide-react';
import type { ResearchSynthesis, CompetitorAnalysis, ResearchFinding } from '@/lib/bolt/research/types';

interface ResearchResultsProps {
  synthesis: ResearchSynthesis;
  onUseForPlanning?: () => void;
}

export function ResearchResults({
  synthesis,
  onUseForPlanning,
}: ResearchResultsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'recommendations'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Research Results</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              Confidence: {Math.round(synthesis.confidence * 100)}%
            </span>
            {onUseForPlanning && (
              <button
                onClick={onUseForPlanning}
                className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors"
              >
                Use for Planning
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-zinc-800">
        {/* Summary */}
        <CollapsibleSection
          title="Summary"
          icon={Lightbulb}
          isExpanded={expandedSections.has('summary')}
          onToggle={() => toggleSection('summary')}
        >
          <p className="text-sm text-zinc-300">{synthesis.summary}</p>
        </CollapsibleSection>

        {/* Key Findings */}
        {synthesis.findings.length > 0 && (
          <CollapsibleSection
            title={`Key Findings (${synthesis.findings.length})`}
            icon={Target}
            isExpanded={expandedSections.has('findings')}
            onToggle={() => toggleSection('findings')}
          >
            <div className="space-y-3">
              {synthesis.findings.map((finding, i) => (
                <FindingCard key={i} finding={finding} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Competitors */}
        {synthesis.competitors && synthesis.competitors.length > 0 && (
          <CollapsibleSection
            title={`Competitors (${synthesis.competitors.length})`}
            icon={Trophy}
            isExpanded={expandedSections.has('competitors')}
            onToggle={() => toggleSection('competitors')}
          >
            <div className="space-y-3">
              {synthesis.competitors.map((competitor, i) => (
                <CompetitorCard key={i} competitor={competitor} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Feature Matrix */}
        {synthesis.featureMatrix && synthesis.featureMatrix.features.length > 0 && (
          <CollapsibleSection
            title="Feature Comparison"
            icon={Target}
            isExpanded={expandedSections.has('matrix')}
            onToggle={() => toggleSection('matrix')}
          >
            <FeatureMatrixTable matrix={synthesis.featureMatrix} />
          </CollapsibleSection>
        )}

        {/* Recommendations */}
        {synthesis.recommendations.length > 0 && (
          <CollapsibleSection
            title="Recommendations"
            icon={AlertTriangle}
            isExpanded={expandedSections.has('recommendations')}
            onToggle={() => toggleSection('recommendations')}
          >
            <ul className="space-y-2">
              {synthesis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-violet-400 mt-1">-</span>
                  {rec}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* Sources */}
        {synthesis.sources.length > 0 && (
          <CollapsibleSection
            title={`Sources (${synthesis.sources.length})`}
            icon={ExternalLink}
            isExpanded={expandedSections.has('sources')}
            onToggle={() => toggleSection('sources')}
          >
            <div className="space-y-1">
              {synthesis.sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-zinc-400 hover:text-violet-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="truncate">{source.title || source.domain}</span>
                </a>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function CollapsibleSection({
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
      {isExpanded && (
        <div className="px-9 pb-4">{children}</div>
      )}
    </div>
  );
}

function FindingCard({ finding }: { finding: ResearchFinding }) {
  const importanceColors = {
    high: 'border-red-500/30 bg-red-500/5',
    medium: 'border-yellow-500/30 bg-yellow-500/5',
    low: 'border-zinc-500/30 bg-zinc-500/5',
  };

  return (
    <div className={`border rounded-lg p-3 ${importanceColors[finding.importance]}`}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-white">{finding.title}</h4>
        <span className="text-xs text-zinc-500 shrink-0">{finding.category}</span>
      </div>
      <p className="text-xs text-zinc-400 mt-1">{finding.description}</p>
      {finding.evidence.length > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">Evidence:</span>
          <ul className="mt-1 space-y-1">
            {finding.evidence.slice(0, 2).map((e, i) => (
              <li key={i} className="text-xs text-zinc-500 italic">&ldquo;{e}&rdquo;</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CompetitorCard({ competitor }: { competitor: CompetitorAnalysis }) {
  return (
    <div className="border border-zinc-700 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">{competitor.name}</h4>
        {competitor.url && (
          <a
            href={competitor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-400 hover:underline"
          >
            Visit
          </a>
        )}
      </div>
      <p className="text-xs text-zinc-400 mt-1">{competitor.description}</p>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <span className="text-xs text-emerald-400">Strengths</span>
          <ul className="mt-1">
            {competitor.strengths.slice(0, 3).map((s, i) => (
              <li key={i} className="text-xs text-zinc-400">+ {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <span className="text-xs text-red-400">Weaknesses</span>
          <ul className="mt-1">
            {competitor.weaknesses.slice(0, 3).map((w, i) => (
              <li key={i} className="text-xs text-zinc-400">- {w}</li>
            ))}
          </ul>
        </div>
      </div>

      {competitor.pricing && (
        <div className="mt-2 pt-2 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">Pricing: {competitor.pricing}</span>
        </div>
      )}
    </div>
  );
}

function FeatureMatrixTable({ matrix }: { matrix: NonNullable<ResearchSynthesis['featureMatrix']> }) {
  const supportColors: Record<string, string> = {
    full: 'text-emerald-400',
    partial: 'text-yellow-400',
    premium: 'text-violet-400',
    none: 'text-zinc-600',
    unknown: 'text-zinc-600',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left py-2 pr-4 text-zinc-400 font-medium">Feature</th>
            {matrix.products.map((product, i) => (
              <th key={i} className="text-center py-2 px-2 text-zinc-400 font-medium">
                {product}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.features.map((feature, i) => (
            <tr key={i} className="border-b border-zinc-800/50">
              <td className="py-2 pr-4 text-zinc-300">{feature}</td>
              {(matrix.matrix[i] || []).map((support, j) => (
                <td key={j} className={`text-center py-2 px-2 ${supportColors[support] || 'text-zinc-600'}`}>
                  {support === 'full' ? 'Yes' : support === 'partial' ? '~' : support === 'premium' ? '$' : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
