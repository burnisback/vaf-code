'use client';

/**
 * ArtifactCard Component
 *
 * Displays code artifacts as collapsible cards instead of inline code blocks.
 * Provides a cleaner chat interface with click-to-expand functionality.
 */

import React, { useState, useCallback } from 'react';
import {
  FileCode,
  FilePlus,
  FileEdit,
  FileX,
  Terminal,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Eye,
  Loader2,
  Package,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type ArtifactType = 'file' | 'shell' | 'diagram' | 'preview';
export type ArtifactStatus = 'pending' | 'creating' | 'success' | 'error';
export type FileOperation = 'create' | 'modify' | 'delete';

export interface ArtifactMetadata {
  language?: string;
  lineCount?: number;
  operation?: FileOperation;
  description?: string;
}

export interface ArtifactCardProps {
  type: ArtifactType;
  title: string;
  content?: string;
  metadata?: ArtifactMetadata;
  status?: ArtifactStatus;
  isSelected?: boolean;
  previewLines?: number;
  onSelect?: () => void;
  onOpenFile?: (path: string) => void;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getFileIcon(operation?: FileOperation) {
  switch (operation) {
    case 'create':
      return FilePlus;
    case 'modify':
      return FileEdit;
    case 'delete':
      return FileX;
    default:
      return FileCode;
  }
}

function getOperationColor(operation?: FileOperation) {
  switch (operation) {
    case 'create':
      return 'text-emerald-400';
    case 'modify':
      return 'text-blue-400';
    case 'delete':
      return 'text-red-400';
    default:
      return 'text-zinc-400';
  }
}

function getOperationBg(operation?: FileOperation) {
  switch (operation) {
    case 'create':
      return 'bg-emerald-500/5 border-emerald-500/20';
    case 'modify':
      return 'bg-blue-500/5 border-blue-500/20';
    case 'delete':
      return 'bg-red-500/5 border-red-500/20';
    default:
      return 'bg-zinc-800/50 border-zinc-700/50';
  }
}

function getStatusIndicator(status?: ArtifactStatus) {
  switch (status) {
    case 'pending':
      return (
        <div className="w-4 h-4 rounded-full border-2 border-zinc-600 border-dashed" />
      );
    case 'creating':
      return <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />;
    case 'success':
      return (
        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      );
    case 'error':
      return (
        <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">!</span>
        </div>
      );
    default:
      return null;
  }
}

function getLanguageLabel(language?: string): string {
  const labels: Record<string, string> = {
    typescript: 'TypeScript',
    tsx: 'React TSX',
    javascript: 'JavaScript',
    jsx: 'React JSX',
    css: 'CSS',
    html: 'HTML',
    json: 'JSON',
    markdown: 'Markdown',
    shell: 'Shell',
    bash: 'Bash',
  };
  return labels[language || ''] || language || 'Code';
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ArtifactCard({
  type,
  title,
  content,
  metadata,
  status,
  isSelected,
  previewLines = 3,
  onSelect,
  onOpenFile,
}: ArtifactCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const Icon = type === 'shell' ? Terminal : getFileIcon(metadata?.operation);
  const colorClass = type === 'shell' ? 'text-amber-400' : getOperationColor(metadata?.operation);
  const bgClass = type === 'shell' ? 'bg-amber-500/5 border-amber-500/20' : getOperationBg(metadata?.operation);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  const handleOpenFile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenFile?.(title);
  }, [onOpenFile, title]);

  const handleToggle = useCallback(() => {
    if (content) {
      setIsExpanded(!isExpanded);
    }
    onSelect?.();
  }, [content, isExpanded, onSelect]);

  // Get preview content (first few lines)
  const previewContent = content
    ? content.split('\n').slice(0, previewLines).join('\n')
    : '';

  return (
    <div
      className={`
        rounded-lg border overflow-hidden transition-all duration-200
        ${bgClass}
        ${isSelected ? 'ring-2 ring-violet-500/50' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-black/10 transition-colors"
        onClick={handleToggle}
      >
        {/* Icon */}
        <div className={`flex-shrink-0 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Title & Metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-zinc-200 truncate">
              {title}
            </span>
            {isSelected && (
              <span className="text-[10px] text-violet-400 bg-violet-500/20 px-1.5 py-0.5 rounded">
                viewing
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {metadata?.language && (
              <span className="text-xs text-zinc-500">
                {getLanguageLabel(metadata.language)}
              </span>
            )}
            {metadata?.lineCount && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="text-xs text-zinc-500">
                  {metadata.lineCount} lines
                </span>
              </>
            )}
            {metadata?.description && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="text-xs text-zinc-500 truncate max-w-[150px]">
                  {metadata.description}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status indicator */}
          {status && getStatusIndicator(status)}

          {/* Hover actions */}
          {isHovered && content && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-zinc-700/50 transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                )}
              </button>
              {onOpenFile && type === 'file' && (
                <button
                  onClick={handleOpenFile}
                  className="p-1 rounded hover:bg-zinc-700/50 transition-colors"
                  title="Open in editor"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                </button>
              )}
            </div>
          )}

          {/* Expand indicator */}
          {content && (
            <button className="p-0.5 rounded">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Preview on hover (when not expanded) */}
      {isHovered && !isExpanded && content && previewContent && (
        <div className="px-3 pb-2 border-t border-zinc-700/30">
          <pre className="text-xs font-mono text-zinc-500 mt-2 overflow-hidden">
            <code>{previewContent}</code>
          </pre>
          {content.split('\n').length > previewLines && (
            <div className="text-[10px] text-zinc-600 mt-1">
              +{content.split('\n').length - previewLines} more lines
            </div>
          )}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && content && (
        <div className="border-t border-zinc-700/30">
          <div className="relative">
            {/* Code toolbar */}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-400" />
                )}
              </button>
            </div>

            {/* Code content */}
            <pre className="p-3 max-h-64 overflow-auto bg-[#1e1e1e]">
              <code className="text-xs font-mono text-[#d4d4d4] whitespace-pre">
                {content}
              </code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ARTIFACT GROUP (for multiple files)
// =============================================================================

interface ArtifactGroupProps {
  artifacts: ArtifactCardProps[];
  onOpenFile?: (path: string) => void;
}

export function ArtifactGroup({ artifacts, onOpenFile }: ArtifactGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (artifacts.length === 1) {
    return <ArtifactCard {...artifacts[0]} onOpenFile={onOpenFile} />;
  }

  const createdCount = artifacts.filter(a => a.metadata?.operation === 'create').length;
  const modifiedCount = artifacts.filter(a => a.metadata?.operation === 'modify').length;
  const deletedCount = artifacts.filter(a => a.metadata?.operation === 'delete').length;

  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 overflow-hidden">
      {/* Group Header */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-black/10 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Package className="w-4 h-4 text-violet-400" />
        <div className="flex-1">
          <span className="text-sm text-zinc-200">
            {artifacts.length} files
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            {createdCount > 0 && (
              <span className="text-xs text-emerald-400">+{createdCount} created</span>
            )}
            {modifiedCount > 0 && (
              <span className="text-xs text-blue-400">{modifiedCount} modified</span>
            )}
            {deletedCount > 0 && (
              <span className="text-xs text-red-400">-{deletedCount} deleted</span>
            )}
          </div>
        </div>
        <button className="p-0.5 rounded">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
        </button>
      </div>

      {/* Collapsed file list */}
      {!isExpanded && (
        <div className="px-3 pb-2 text-xs text-zinc-500 font-mono truncate">
          {artifacts.map(a => a.title).join(', ')}
        </div>
      )}

      {/* Expanded file cards */}
      {isExpanded && (
        <div className="p-2 space-y-2 border-t border-zinc-700/30">
          {artifacts.map((artifact, index) => (
            <ArtifactCard
              key={`${artifact.title}-${index}`}
              {...artifact}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SHELL COMMAND CARD
// =============================================================================

interface ShellCommandCardProps {
  command: string;
  status?: ArtifactStatus;
  output?: string;
}

export function ShellCommandCard({ command, status, output }: ShellCommandCardProps) {
  const [showOutput, setShowOutput] = useState(false);

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-black/10 transition-colors"
        onClick={() => output && setShowOutput(!showOutput)}
      >
        <Terminal className="w-4 h-4 text-amber-400" />
        <code className="flex-1 text-sm font-mono text-amber-200 truncate">
          {command}
        </code>
        {status && getStatusIndicator(status)}
        {output && (
          <button className="p-0.5 rounded">
            {showOutput ? (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            )}
          </button>
        )}
      </div>

      {showOutput && output && (
        <div className="border-t border-amber-500/20">
          <pre className="p-3 max-h-32 overflow-auto bg-[#1e1e1e] text-xs font-mono text-zinc-400">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
