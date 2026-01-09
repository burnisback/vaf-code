/**
 * EvidenceLog Component
 *
 * Displays investigation results showing what files the AI read
 * and what findings were discovered before making changes.
 *
 * Enforces transparency in the "read-before-edit" principle.
 */

'use client';

import React, { useState } from 'react';
import type { InvestigationResult, InvestigationFinding, FileToRead } from '@/lib/bolt/investigation';

// =============================================================================
// TYPES
// =============================================================================

export interface EvidenceLogProps {
  /** Investigation result from the API */
  investigation: InvestigationResult | null;

  /** Whether investigation is in progress */
  isInvestigating?: boolean;

  /** Optional className for styling */
  className?: string;

  /** Whether to show expanded view by default */
  defaultExpanded?: boolean;

  /** Callback when user wants to see a file */
  onViewFile?: (filePath: string) => void;
}

export interface EvidenceItemProps {
  /** Finding to display */
  finding: InvestigationFinding;

  /** Callback when user clicks on a file */
  onViewFile?: (filePath: string) => void;
}

export interface MiniEvidenceLogProps {
  /** Investigation result */
  investigation: InvestigationResult | null;

  /** Whether investigating */
  isInvestigating?: boolean;

  /** Click handler to expand */
  onClick?: () => void;
}

// =============================================================================
// FINDING TYPE ICONS
// =============================================================================

const FINDING_ICONS: Record<InvestigationFinding['type'], string> = {
  pattern: '🔍',
  dependency: '🔗',
  conflict: '⚠️',
  opportunity: '💡',
  warning: '⚡',
};

const FINDING_COLORS: Record<InvestigationFinding['type'], string> = {
  pattern: 'text-blue-400',
  dependency: 'text-purple-400',
  conflict: 'text-yellow-400',
  opportunity: 'text-green-400',
  warning: 'text-orange-400',
};

// =============================================================================
// EVIDENCE ITEM COMPONENT
// =============================================================================

export function EvidenceItem({ finding, onViewFile }: EvidenceItemProps): React.ReactElement {
  const icon = FINDING_ICONS[finding.type];
  const colorClass = FINDING_COLORS[finding.type];

  return (
    <div className="bg-bolt-elements-background-depth-2 rounded-lg p-3 border border-bolt-elements-borderColor">
      <div className="flex items-start gap-2">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${colorClass} capitalize text-sm`}>
            {finding.type}
            <span className="text-bolt-elements-textTertiary ml-2 text-xs">
              ({Math.round(finding.confidence * 100)}% confidence)
            </span>
          </div>
          <p className="text-bolt-elements-textSecondary text-sm mt-1">
            {finding.description}
          </p>
          {finding.suggestion && (
            <p className="text-bolt-elements-textTertiary text-xs mt-1 italic">
              Suggestion: {finding.suggestion}
            </p>
          )}
          {finding.files.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {finding.files.map((file) => (
                <button
                  key={file}
                  onClick={() => onViewFile?.(file)}
                  className="text-xs px-2 py-0.5 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-4 transition-colors"
                >
                  {file}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FILE LIST COMPONENT
// =============================================================================

interface FileListProps {
  files: FileToRead[];
  title: string;
  emptyText: string;
  onViewFile?: (filePath: string) => void;
}

function FileList({ files, title, emptyText, onViewFile }: FileListProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayFiles = isExpanded ? files : files.slice(0, 3);
  const hasMore = files.length > 3;

  return (
    <div className="mb-3">
      <h4 className="text-xs font-medium text-bolt-elements-textTertiary uppercase tracking-wide mb-2">
        {title} ({files.length})
      </h4>
      {files.length === 0 ? (
        <p className="text-xs text-bolt-elements-textTertiary italic">{emptyText}</p>
      ) : (
        <>
          <div className="space-y-1">
            {displayFiles.map((file) => (
              <div
                key={file.filePath}
                className="flex items-center gap-2 text-sm bg-bolt-elements-background-depth-2 rounded px-2 py-1.5 group"
              >
                <span className="text-bolt-elements-textSecondary">📄</span>
                <button
                  onClick={() => onViewFile?.(file.filePath)}
                  className="flex-1 text-left text-bolt-elements-textPrimary hover:text-bolt-elements-item-contentAccent truncate"
                >
                  {file.filePath}
                </button>
                <span className="text-xs text-bolt-elements-textTertiary hidden group-hover:block">
                  P{file.priority}
                </span>
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-bolt-elements-item-contentAccent mt-1 hover:underline"
            >
              {isExpanded ? 'Show less' : `+${files.length - 3} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// MINI EVIDENCE LOG (COMPACT)
// =============================================================================

export function MiniEvidenceLog({
  investigation,
  isInvestigating,
  onClick,
}: MiniEvidenceLogProps): React.ReactElement {
  if (isInvestigating) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-sm animate-pulse"
      >
        <span className="text-yellow-400">🔍</span>
        <span className="text-bolt-elements-textSecondary">Investigating...</span>
      </button>
    );
  }

  if (!investigation) {
    return <></>;
  }

  const filesCount = investigation.filesToRead.required.length + investigation.filesToRead.optional.length;
  const findingsCount = investigation.findings.length;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-sm hover:bg-bolt-elements-background-depth-3 transition-colors"
    >
      <span className="text-blue-400">🔍</span>
      <span className="text-bolt-elements-textSecondary">
        {filesCount} files, {findingsCount} findings
      </span>
      {investigation.success && (
        <span className="text-green-400">✓</span>
      )}
    </button>
  );
}

// =============================================================================
// MAIN EVIDENCE LOG COMPONENT
// =============================================================================

export function EvidenceLog({
  investigation,
  isInvestigating,
  className = '',
  defaultExpanded = false,
  onViewFile,
}: EvidenceLogProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Loading state
  if (isInvestigating) {
    return (
      <div className={`bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-bolt-elements-item-contentAccent border-t-transparent rounded-full" />
          <div>
            <h3 className="text-sm font-medium text-bolt-elements-textPrimary">
              Investigating Codebase
            </h3>
            <p className="text-xs text-bolt-elements-textTertiary">
              Analyzing files before making changes...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No investigation
  if (!investigation) {
    return <></>;
  }

  const { filesToRead, findings, suggestedApproach, success, duration } = investigation;
  const totalFiles = filesToRead.required.length + filesToRead.optional.length;

  return (
    <div className={`bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bolt-elements-background-depth-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={success ? 'text-green-400' : 'text-yellow-400'}>
            {success ? '✓' : '⚠'}
          </span>
          <h3 className="text-sm font-medium text-bolt-elements-textPrimary">
            Investigation Results
          </h3>
          <span className="text-xs text-bolt-elements-textTertiary">
            ({totalFiles} files, {findings.length} findings, {duration}ms)
          </span>
        </div>
        <span className="text-bolt-elements-textTertiary">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-bolt-elements-borderColor">
          {/* Suggested Approach */}
          {suggestedApproach && (
            <div className="mb-4 p-3 bg-bolt-elements-background-depth-2 rounded-lg">
              <h4 className="text-xs font-medium text-bolt-elements-textTertiary uppercase tracking-wide mb-1">
                Suggested Approach
              </h4>
              <p className="text-sm text-bolt-elements-textSecondary">
                {suggestedApproach}
              </p>
            </div>
          )}

          {/* File Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FileList
              files={filesToRead.required}
              title="Files to Read"
              emptyText="No required files identified"
              onViewFile={onViewFile}
            />
            <FileList
              files={filesToRead.optional}
              title="Optional Files"
              emptyText="No optional files"
              onViewFile={onViewFile}
            />
          </div>

          {/* Findings */}
          {findings.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-bolt-elements-textTertiary uppercase tracking-wide mb-2">
                Findings ({findings.length})
              </h4>
              <div className="space-y-2">
                {findings.map((finding, index) => (
                  <EvidenceItem
                    key={`${finding.type}-${index}`}
                    finding={finding}
                    onViewFile={onViewFile}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          {filesToRead.reasoning && (
            <div className="mt-4 p-3 bg-bolt-elements-background-depth-2 rounded-lg">
              <h4 className="text-xs font-medium text-bolt-elements-textTertiary uppercase tracking-wide mb-1">
                Investigation Reasoning
              </h4>
              <p className="text-xs text-bolt-elements-textTertiary">
                {filesToRead.reasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Default export
export default EvidenceLog;
