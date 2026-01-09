'use client';

/**
 * VerificationStatus
 *
 * Displays build verification results with error categorization.
 * Provides fix and retry actions when errors are detected.
 */

import React, { useState } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCode,
  Wrench,
  RefreshCw,
  Loader2,
  Package,
  Bug,
} from 'lucide-react';
import type { VerificationResult, VerificationError } from '@/lib/bolt/execution/verifier';

// =============================================================================
// TYPES
// =============================================================================

interface VerificationStatusProps {
  result: VerificationResult;
  onFix?: () => void;
  onRetry?: () => void;
  isFixing?: boolean;
}

// =============================================================================
// ERROR LIST
// =============================================================================

interface ErrorListProps {
  errors: VerificationError[];
  title: string;
  icon: React.ReactNode;
  defaultExpanded?: boolean;
}

function ErrorList({ errors, title, icon, defaultExpanded = false }: ErrorListProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || errors.length <= 3);

  if (errors.length === 0) return null;

  return (
    <div className="border border-zinc-800/50 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {icon}
        <span className="flex-1 text-left text-sm font-medium text-zinc-300">
          {title}
        </span>
        <span className="text-xs text-zinc-500">
          {errors.length} error{errors.length !== 1 ? 's' : ''}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="p-2 space-y-1 max-h-48 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {errors.map((error, index) => (
            <div
              key={index}
              className="flex items-start gap-2 px-2 py-1.5 bg-zinc-900/30 rounded text-sm"
            >
              <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-zinc-300 break-words">{error.message}</p>
                {(error.file || error.code) && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {error.file && <span className="font-mono">{error.file}</span>}
                    {error.line && <span>:{error.line}</span>}
                    {error.code && <span className="ml-2 text-violet-400">({error.code})</span>}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VerificationStatus({
  result,
  onFix,
  onRetry,
  isFixing = false,
}: VerificationStatusProps) {
  const totalErrors =
    result.typeErrors.length +
    result.moduleErrors.length +
    result.runtimeErrors.length;

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        result.success
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-red-500/5 border-red-500/20'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50">
        {result.success ? (
          <div className="flex items-center gap-2 text-emerald-400">
            <Check className="w-5 h-5" />
            <span className="font-medium">Build Verified</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">
              {totalErrors} Error{totalErrors !== 1 ? 's' : ''} Found
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Actions */}
        {!result.success && (
          <div className="flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={isFixing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800/50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
            {onFix && (
              <button
                onClick={onFix}
                disabled={isFixing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 rounded-lg transition-colors disabled:opacity-50"
              >
                {isFixing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wrench className="w-3.5 h-3.5" />
                )}
                Fix Errors
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error Lists */}
      {!result.success && (
        <div className="p-3 space-y-2">
          <ErrorList
            errors={result.typeErrors}
            title="Type Errors"
            icon={<FileCode className="w-4 h-4 text-blue-400" />}
            defaultExpanded={result.typeErrors.length > 0}
          />
          <ErrorList
            errors={result.moduleErrors}
            title="Module Errors"
            icon={<Package className="w-4 h-4 text-amber-400" />}
          />
          <ErrorList
            errors={result.runtimeErrors}
            title="Runtime Errors"
            icon={<Bug className="w-4 h-4 text-red-400" />}
          />
          {result.lintErrors.length > 0 && (
            <ErrorList
              errors={result.lintErrors}
              title="Lint Warnings"
              icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />}
            />
          )}
        </div>
      )}

      {/* Success State */}
      {result.success && (
        <div className="px-4 py-3">
          <p className="text-sm text-emerald-300/70">
            All code compiled successfully with no errors.
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COMPACT VERSION (Badge)
// =============================================================================

interface VerificationBadgeProps {
  result: VerificationResult;
  onClick?: () => void;
}

export function VerificationBadge({ result, onClick }: VerificationBadgeProps) {
  if (result.success) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs hover:bg-emerald-500/20 transition-colors"
      >
        <Check className="w-3 h-3" />
        <span>Verified</span>
      </button>
    );
  }

  const totalErrors =
    result.typeErrors.length +
    result.moduleErrors.length +
    result.runtimeErrors.length;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-400 rounded-full text-xs hover:bg-red-500/20 transition-colors"
    >
      <AlertTriangle className="w-3 h-3" />
      <span>{totalErrors} error{totalErrors !== 1 ? 's' : ''}</span>
    </button>
  );
}

// =============================================================================
// INLINE VERIFICATION INDICATOR
// =============================================================================

interface VerificationIndicatorProps {
  isVerifying: boolean;
  result: VerificationResult | null;
}

export function VerificationIndicator({ isVerifying, result }: VerificationIndicatorProps) {
  if (isVerifying) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Verifying build...</span>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  if (result.success) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-400">
        <Check className="w-3 h-3" />
        <span>Build verified</span>
      </div>
    );
  }

  const totalErrors =
    result.typeErrors.length +
    result.moduleErrors.length +
    result.runtimeErrors.length;

  return (
    <div className="flex items-center gap-2 text-xs text-red-400">
      <AlertTriangle className="w-3 h-3" />
      <span>{totalErrors} error{totalErrors !== 1 ? 's' : ''} found</span>
    </div>
  );
}
