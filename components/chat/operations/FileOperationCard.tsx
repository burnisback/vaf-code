'use client';

import React, { useState } from 'react';
import {
  FilePlus,
  FileEdit,
  FileX,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink
} from 'lucide-react';
import type { FileOperationV2, WriteOperation, EditOperation, DeleteOperation } from '@/lib/ai/types';

/**
 * FileOperationCard Component
 *
 * Displays a file operation (write/edit/delete) with Bolt.new-style visuals.
 * Shows animated status transitions and expandable code preview.
 */

export type OperationStatus = 'pending' | 'executing' | 'success' | 'error';

interface FileOperationCardProps {
  operation: FileOperationV2;
  status: OperationStatus;
  error?: string;
  onRetry?: () => void;
  onOpenFile?: (path: string) => void;
}

export function FileOperationCard({
  operation,
  status,
  error,
  onRetry,
  onOpenFile
}: FileOperationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { icon: Icon, label, colorClass, bgClass } = getOperationMeta(operation.type);

  return (
    <div className={`rounded-lg border overflow-hidden transition-all duration-200 ${bgClass}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-black/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Operation Icon */}
        <div className={`flex-shrink-0 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Label & Path */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${colorClass}`}>{label}</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">•</span>
            <span className="text-xs font-mono text-[var(--color-text-secondary)] truncate">
              {operation.path}
            </span>
          </div>
          {operation.type !== 'delete' && 'description' in operation && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 truncate">
              {operation.description}
            </p>
          )}
        </div>

        {/* Status Indicator */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <StatusIndicator status={status} />
          {hasPreview(operation) && (
            <button className="p-1 hover:bg-black/10 rounded transition-colors">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {status === 'error' && error && (
        <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-red-400">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expandable Content */}
      {isExpanded && hasPreview(operation) && (
        <div className="border-t border-[var(--color-border-default)]">
          <OperationPreview
            operation={operation}
            onOpenFile={onOpenFile}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// STATUS INDICATOR
// ============================================

function StatusIndicator({ status }: { status: OperationStatus }) {
  switch (status) {
    case 'pending':
      return (
        <div className="w-5 h-5 rounded-full border-2 border-[var(--color-text-tertiary)] border-dashed" />
      );
    case 'executing':
      return (
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
      );
    case 'success':
      return (
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
          <Check className="w-3 h-3 text-white" />
        </div>
      );
    case 'error':
      return (
        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <X className="w-3 h-3 text-white" />
        </div>
      );
  }
}

// ============================================
// OPERATION PREVIEW
// ============================================

interface OperationPreviewProps {
  operation: FileOperationV2;
  onOpenFile?: (path: string) => void;
}

function OperationPreview({ operation, onOpenFile }: OperationPreviewProps) {
  const [copied, setCopied] = useState(false);

  const copyContent = () => {
    let content = '';
    if (operation.type === 'write') {
      content = operation.content;
    } else if (operation.type === 'edit') {
      content = operation.edits.map(e => e.newContent).join('\n');
    }

    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (operation.type === 'delete') {
    return (
      <div className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
        <span className="text-red-400">Reason:</span> {operation.reason}
      </div>
    );
  }

  if (operation.type === 'edit') {
    return (
      <div className="max-h-64 overflow-auto">
        {operation.edits.map((edit, index) => (
          <div key={index} className="border-b border-[var(--color-border-default)] last:border-0">
            {edit.context && (
              <div className="px-3 py-1 text-xs text-[var(--color-text-tertiary)] bg-[var(--color-surface-tertiary)]">
                {edit.context}
              </div>
            )}
            <div className="grid grid-cols-2 divide-x divide-[var(--color-border-default)]">
              {/* Old Content */}
              <div className="p-2 bg-red-500/5">
                <div className="text-[10px] text-red-400 mb-1 font-medium">REMOVE</div>
                <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap break-all">
                  {edit.oldContent}
                </pre>
              </div>
              {/* New Content */}
              <div className="p-2 bg-green-500/5">
                <div className="text-[10px] text-green-400 mb-1 font-medium">ADD</div>
                <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap break-all">
                  {edit.newContent}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Write operation
  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <button
          onClick={copyContent}
          className="p-1.5 rounded bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          title="Copy code"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-400" />
          ) : (
            <Copy className="w-3 h-3 text-[var(--color-text-tertiary)]" />
          )}
        </button>
        {onOpenFile && (
          <button
            onClick={() => onOpenFile(operation.path)}
            className="p-1.5 rounded bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            title="Open in editor"
          >
            <ExternalLink className="w-3 h-3 text-[var(--color-text-tertiary)]" />
          </button>
        )}
      </div>

      {/* Code Preview */}
      <pre className="p-3 max-h-64 overflow-auto bg-[#1e1e1e]">
        <code className="text-xs font-mono text-[#d4d4d4] whitespace-pre">
          {operation.content}
        </code>
      </pre>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function getOperationMeta(type: FileOperationV2['type']) {
  switch (type) {
    case 'write':
      return {
        icon: FilePlus,
        label: 'Creating file',
        colorClass: 'text-green-400',
        bgClass: 'bg-green-500/5 border-green-500/20'
      };
    case 'edit':
      return {
        icon: FileEdit,
        label: 'Editing file',
        colorClass: 'text-blue-400',
        bgClass: 'bg-blue-500/5 border-blue-500/20'
      };
    case 'delete':
      return {
        icon: FileX,
        label: 'Deleting file',
        colorClass: 'text-red-400',
        bgClass: 'bg-red-500/5 border-red-500/20'
      };
  }
}

function hasPreview(operation: FileOperationV2): boolean {
  return operation.type === 'write' || operation.type === 'edit' || operation.type === 'delete';
}

// ============================================
// ANIMATION KEYFRAMES (add to globals.css)
// ============================================
// @keyframes scale-in {
//   from { transform: scale(0); opacity: 0; }
//   to { transform: scale(1); opacity: 1; }
// }
// .animate-scale-in {
//   animation: scale-in 0.2s ease-out;
// }
