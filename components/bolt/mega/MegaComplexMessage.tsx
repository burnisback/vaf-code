'use client';

/**
 * MegaComplexMessage
 *
 * Special message component for mega-complex project updates.
 * Displays research results, PRD summaries, architecture previews,
 * and approval requests with appropriate styling.
 */

import React, { useState } from 'react';

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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// =============================================================================
// TYPES
// =============================================================================

export type MegaComplexMessageType =
  | 'research'
  | 'prd'
  | 'architecture'
  | 'phase'
  | 'approval'
  | 'complete'
  | 'error';

interface MegaComplexMessageProps {
  /** Message type determines icon and styling */
  type: MegaComplexMessageType;

  /** Message title */
  title: string;

  /** Message content */
  content: string;

  /** Optional data payload for expansion */
  data?: unknown;

  /** Called when user wants to view details */
  onViewDetails?: () => void;

  /** Called when user approves (for approval type) */
  onApprove?: () => void;

  /** Called when user rejects (for approval type) */
  onReject?: () => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MegaComplexMessage({
  type,
  title,
  content,
  data,
  onViewDetails,
  onApprove,
  onReject,
}: MegaComplexMessageProps) {
  const [expanded, setExpanded] = useState(false);

  const { colorClass, bgClass, borderClass } = getTypeStyles(type);

  return (
    <div className={`border rounded-lg p-3 ${bgClass} ${borderClass}`}>
      <div className="flex items-center gap-2">
        {renderIcon(type, `w-4 h-4 ${colorClass}`)}
        <span className={`text-sm font-medium ${colorClass}`}>{title}</span>
      </div>

      <p className="text-xs mt-2 text-zinc-300">{content}</p>

      {data !== undefined && data !== null && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          {expanded ? (
            <ChevronDownIcon className="w-3 h-3" />
          ) : (
            <ChevronRightIcon className="w-3 h-3" />
          )}
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      )}

      {expanded && data !== undefined && data !== null && (
        <div className="mt-2 p-2 bg-black/30 rounded text-xs text-zinc-400 max-h-40 overflow-y-auto overflow-x-hidden scrollbar-thin font-mono">
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(data, null, 2).slice(0, 1000)}
            {JSON.stringify(data, null, 2).length > 1000 && '...'}
          </pre>
        </div>
      )}

      {type === 'approval' && (onApprove || onReject) && (
        <div className="flex items-center gap-2 mt-3">
          {onApprove && (
            <button
              onClick={onApprove}
              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded transition-colors"
            >
              Approve
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs rounded transition-colors"
            >
              Reject
            </button>
          )}
        </div>
      )}

      {onViewDetails && type !== 'approval' && (
        <button
          onClick={onViewDetails}
          className="mt-2 text-xs text-violet-400 hover:text-violet-300 hover:underline transition-colors"
        >
          View full {type}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

interface TypeStyles {
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

function getTypeStyles(type: MegaComplexMessageType): TypeStyles {
  switch (type) {
    case 'research':
      return {
        colorClass: 'text-blue-400',
        bgClass: 'bg-blue-500/10',
        borderClass: 'border-blue-500/30',
      };
    case 'prd':
      return {
        colorClass: 'text-yellow-400',
        bgClass: 'bg-yellow-500/10',
        borderClass: 'border-yellow-500/30',
      };
    case 'architecture':
      return {
        colorClass: 'text-orange-400',
        bgClass: 'bg-orange-500/10',
        borderClass: 'border-orange-500/30',
      };
    case 'phase':
      return {
        colorClass: 'text-violet-400',
        bgClass: 'bg-violet-500/10',
        borderClass: 'border-violet-500/30',
      };
    case 'approval':
      return {
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/30',
      };
    case 'complete':
      return {
        colorClass: 'text-emerald-400',
        bgClass: 'bg-emerald-500/10',
        borderClass: 'border-emerald-500/30',
      };
    case 'error':
      return {
        colorClass: 'text-red-400',
        bgClass: 'bg-red-500/10',
        borderClass: 'border-red-500/30',
      };
    default:
      return {
        colorClass: 'text-zinc-400',
        bgClass: 'bg-zinc-500/10',
        borderClass: 'border-zinc-500/30',
      };
  }
}

function renderIcon(type: MegaComplexMessageType, className: string): React.ReactElement {
  switch (type) {
    case 'research':
      return <SearchIcon className={className} />;
    case 'prd':
      return <FileTextIcon className={className} />;
    case 'architecture':
      return <GitBranchIcon className={className} />;
    case 'phase':
      return <ClockIcon className={className} />;
    case 'approval':
      return <AlertIcon className={className} />;
    case 'complete':
      return <CheckIcon className={className} />;
    case 'error':
      return <AlertIcon className={className} />;
    default:
      return <AlertIcon className={className} />;
  }
}

// =============================================================================
// COMPACT VARIANT
// =============================================================================

interface MegaComplexBadgeProps {
  type: MegaComplexMessageType;
  label: string;
  onClick?: () => void;
}

/**
 * Compact badge variant for inline use
 */
export function MegaComplexBadge({ type, label, onClick }: MegaComplexBadgeProps) {
  const { colorClass, bgClass, borderClass } = getTypeStyles(type);

  const baseClassName = `
    inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
    ${bgClass} ${borderClass} border ${colorClass}
  `;

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${baseClassName} hover:opacity-80 cursor-pointer transition-opacity`}
      >
        {renderIcon(type, 'w-3 h-3')}
        {label}
      </button>
    );
  }

  return (
    <span className={baseClassName}>
      {renderIcon(type, 'w-3 h-3')}
      {label}
    </span>
  );
}
