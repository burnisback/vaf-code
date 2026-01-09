/**
 * ModeBadge Component
 *
 * Displays the classification mode for user requests.
 * Uses color-coded badges to indicate complexity level.
 */

import * as React from 'react';
import type { RequestMode, ClassificationResult } from '@/lib/bolt/ai/classifier';
import { getModeLabel, getModeColor, getModeDescription } from '@/lib/bolt/ai/classifier';

// =============================================================================
// TYPES
// =============================================================================

interface ModeBadgeProps {
  mode: RequestMode;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface ClassificationBadgeProps {
  classification: ClassificationResult | null;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// =============================================================================
// STYLES
// =============================================================================

const modeColors: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  green: 'bg-green-500/10 text-green-500 border-green-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  gray: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * ModeBadge - Display a single mode badge
 */
export function ModeBadge({
  mode,
  showTooltip = true,
  size = 'md',
  className = '',
}: ModeBadgeProps) {
  const label = getModeLabel(mode);
  const color = getModeColor(mode);
  const description = getModeDescription(mode);
  const colorClass = modeColors[color] || modeColors.gray;

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${colorClass} ${sizeClasses[size]} ${className}`}
      title={showTooltip ? description : undefined}
    >
      {label}
    </span>
  );
}

/**
 * ClassificationBadge - Display classification with confidence indicator
 */
export function ClassificationBadge({
  classification,
  showTooltip = true,
  size = 'md',
  className = '',
}: ClassificationBadgeProps) {
  if (!classification) {
    return null;
  }

  const { mode, confidence, domains, reasoning } = classification;
  const label = getModeLabel(mode);
  const color = getModeColor(mode);
  const colorClass = modeColors[color] || modeColors.gray;

  // Build tooltip content
  const tooltipContent = showTooltip
    ? [
        `Mode: ${label}`,
        `Confidence: ${Math.round(confidence * 100)}%`,
        domains.length > 0 ? `Domains: ${domains.join(', ')}` : null,
        `Reason: ${reasoning}`,
      ]
        .filter(Boolean)
        .join('\n')
    : undefined;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${colorClass} ${sizeClasses[size]} ${className}`}
      title={tooltipContent}
    >
      <span>{label}</span>
      {/* Confidence indicator dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          confidence >= 0.8
            ? 'bg-green-500'
            : confidence >= 0.6
              ? 'bg-yellow-500'
              : 'bg-orange-500'
        }`}
        title={`${Math.round(confidence * 100)}% confidence`}
      />
    </span>
  );
}

/**
 * ModeIndicator - Compact mode indicator for inline use
 */
export function ModeIndicator({
  mode,
  className = '',
}: {
  mode: RequestMode;
  className?: string;
}) {
  const color = getModeColor(mode);
  const colorClass = modeColors[color] || modeColors.gray;

  // Mode icons/symbols
  const modeIcons: Record<RequestMode, string> = {
    question: '?',
    simple: '1',
    moderate: '2',
    complex: '3',
    'mega-complex': '*',
  };

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${colorClass} ${className}`}
      title={getModeDescription(mode)}
    >
      {modeIcons[mode]}
    </span>
  );
}

/**
 * DomainTags - Display detected domains as small tags
 */
export function DomainTags({
  domains,
  maxVisible = 3,
  className = '',
}: {
  domains: string[];
  maxVisible?: number;
  className?: string;
}) {
  if (!domains || domains.length === 0) {
    return null;
  }

  const visible = domains.slice(0, maxVisible);
  const remaining = domains.length - maxVisible;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visible.map((domain) => (
        <span
          key={domain}
          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
        >
          {domain}
        </span>
      ))}
      {remaining > 0 && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--color-surface-raised)] text-[var(--color-text-tertiary)]"
          title={domains.slice(maxVisible).join(', ')}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
