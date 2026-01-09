'use client';

/**
 * ApprovalDialog Component
 *
 * Displays approval requests and allows users to approve or reject.
 * Integrates with the approval manager from Phase 5.
 */

import React from 'react';
import type {
  ApprovalRequest,
  ApprovalType,
} from '@/lib/bolt/orchestration/approvalManager';
import {
  getApprovalTypeTitle,
  getApprovalTypeDescription,
  formatDecisionTime,
} from '@/lib/bolt/orchestration/approvalManager';
import { formatCost } from '@/lib/bolt/orchestration/costTracker';

// =============================================================================
// ICONS
// =============================================================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
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

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

// =============================================================================
// TYPES
// =============================================================================

interface ApprovalDialogProps {
  /** The approval request to display */
  request: ApprovalRequest;
  /** Called when user approves */
  onApprove: () => void;
  /** Called when user rejects */
  onReject: (reason?: string) => void;
  /** Called when user wants to close without action */
  onClose?: () => void;
  /** Whether the dialog is visible */
  open?: boolean;
}

// =============================================================================
// TYPE ICON COMPONENT
// =============================================================================

function TypeIcon({ type, className }: { type: ApprovalType; className?: string }) {
  switch (type) {
    case 'research':
      return <SearchIcon className={className} />;
    case 'prd':
      return <DocumentIcon className={className} />;
    case 'architecture':
      return <LayersIcon className={className} />;
    case 'phase':
      return <CodeIcon className={className} />;
    case 'fix':
      return <WrenchIcon className={className} />;
    default:
      return <DocumentIcon className={className} />;
  }
}

// =============================================================================
// TYPE COLORS
// =============================================================================

function getTypeColors(type: ApprovalType): { bg: string; border: string; text: string; icon: string } {
  switch (type) {
    case 'research':
      return {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        icon: 'text-blue-400',
      };
    case 'prd':
      return {
        bg: 'bg-violet-500/10',
        border: 'border-violet-500/30',
        text: 'text-violet-400',
        icon: 'text-violet-400',
      };
    case 'architecture':
      return {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        icon: 'text-amber-400',
      };
    case 'phase':
      return {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        icon: 'text-emerald-400',
      };
    case 'fix':
      return {
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        text: 'text-rose-400',
        icon: 'text-rose-400',
      };
    default:
      return {
        bg: 'bg-zinc-500/10',
        border: 'border-zinc-500/30',
        text: 'text-zinc-400',
        icon: 'text-zinc-400',
      };
  }
}

// =============================================================================
// FORMAT TIME
// =============================================================================

function formatEstimatedTime(ms: number): string {
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ApprovalDialog({
  request,
  onApprove,
  onReject,
  onClose,
  open = true,
}: ApprovalDialogProps) {
  const [rejectionReason, setRejectionReason] = React.useState('');
  const [showRejectInput, setShowRejectInput] = React.useState(false);
  const colors = getTypeColors(request.type);

  // Calculate time elapsed
  const elapsed = Date.now() - request.createdAt;
  const timeRemaining = request.expiresAt
    ? Math.max(0, request.expiresAt - Date.now())
    : null;

  const handleReject = () => {
    if (showRejectInput && rejectionReason.trim()) {
      onReject(rejectionReason.trim());
    } else if (!showRejectInput) {
      setShowRejectInput(true);
    } else {
      onReject();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`px-4 py-3 ${colors.bg} border-b ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TypeIcon type={request.type} className={`w-5 h-5 ${colors.icon}`} />
              <div>
                <h2 className="font-medium text-white">
                  {getApprovalTypeTitle(request.type)}
                </h2>
                <p className={`text-xs ${colors.text}`}>
                  {getApprovalTypeDescription(request.type)}
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <XIcon className="w-4 h-4 text-zinc-400" />
              </button>
            )}
          </div>
        </div>

        {/* Title and Description */}
        <div className="px-4 py-3 border-b border-zinc-800/50">
          <h3 className="text-lg font-semibold text-white mb-1">
            {request.title}
          </h3>
          <p className="text-sm text-zinc-400">
            {request.description}
          </p>
        </div>

        {/* Metadata */}
        <div className="px-4 py-2 border-b border-zinc-800/50 flex items-center gap-4 text-xs">
          {/* Estimated Cost */}
          {request.estimatedCost !== undefined && request.estimatedCost > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <DollarIcon className="w-3.5 h-3.5" />
              <span>Est. {formatCost(request.estimatedCost)}</span>
            </div>
          )}

          {/* Estimated Time */}
          {request.estimatedTime !== undefined && request.estimatedTime > 0 && (
            <div className="flex items-center gap-1.5 text-blue-400">
              <ClockIcon className="w-3.5 h-3.5" />
              <span>Est. {formatEstimatedTime(request.estimatedTime)}</span>
            </div>
          )}

          {/* Time Elapsed */}
          <div className="flex items-center gap-1.5 text-zinc-500">
            <ClockIcon className="w-3.5 h-3.5" />
            <span>Waiting {formatDecisionTime(elapsed)}</span>
          </div>

          {/* Time Remaining */}
          {timeRemaining !== null && (
            <div className={`flex items-center gap-1.5 ${
              timeRemaining < 30000 ? 'text-red-400' : 'text-amber-400'
            }`}>
              <ClockIcon className="w-3.5 h-3.5" />
              <span>
                {timeRemaining > 0
                  ? `Expires in ${formatEstimatedTime(timeRemaining)}`
                  : 'Expired'}
              </span>
            </div>
          )}
        </div>

        {/* Content Preview */}
        <div className="px-4 py-3 max-h-64 overflow-y-auto scrollbar-thin">
          <ContentPreview content={request.content} type={request.type} />
        </div>

        {/* Rejection Input */}
        {showRejectInput && (
          <div className="px-4 py-3 border-t border-zinc-800/50 bg-zinc-800/30">
            <label className="block text-sm text-zinc-400 mb-2">
              Rejection reason (optional):
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide feedback on what should be changed..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 resize-none"
              rows={3}
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 border-t border-zinc-800/50 flex items-center justify-end gap-3 bg-zinc-900/50">
          {showRejectInput && (
            <button
              onClick={() => {
                setShowRejectInput(false);
                setRejectionReason('');
              }}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleReject}
            className="px-4 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2"
          >
            <XIcon className="w-4 h-4" />
            {showRejectInput ? 'Submit Rejection' : 'Reject'}
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-2 text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
          >
            <CheckIcon className="w-4 h-4" />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CONTENT PREVIEW COMPONENT
// =============================================================================

interface ContentPreviewProps {
  content: unknown;
  type: ApprovalType;
}

function ContentPreview({ content, type }: ContentPreviewProps) {
  // Handle null/undefined
  if (content === null || content === undefined) {
    return (
      <p className="text-sm text-zinc-500 italic">No content preview available</p>
    );
  }

  // Handle string content
  if (typeof content === 'string') {
    return (
      <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-800/50 rounded p-3">
        {content}
      </pre>
    );
  }

  // Handle array content
  if (Array.isArray(content)) {
    return (
      <div className="space-y-2">
        {content.slice(0, 10).map((item, index) => (
          <div key={index} className="text-sm text-zinc-300 bg-zinc-800/50 rounded p-2">
            {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
          </div>
        ))}
        {content.length > 10 && (
          <p className="text-xs text-zinc-500">
            ...and {content.length - 10} more items
          </p>
        )}
      </div>
    );
  }

  // Handle object content based on type
  if (typeof content === 'object') {
    return <ObjectContentPreview content={content as Record<string, unknown>} type={type} />;
  }

  // Fallback for other types
  return (
    <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-800/50 rounded p-3">
      {String(content)}
    </pre>
  );
}

// =============================================================================
// OBJECT CONTENT PREVIEW
// =============================================================================

function ObjectContentPreview({
  content,
  type,
}: {
  content: Record<string, unknown>;
  type: ApprovalType;
}) {
  // Type-specific rendering
  switch (type) {
    case 'research':
      return <ResearchPreview content={content} />;
    case 'prd':
      return <PRDPreview content={content} />;
    case 'architecture':
      return <ArchitecturePreview content={content} />;
    case 'phase':
      return <PhasePreview content={content} />;
    case 'fix':
      return <FixPreview content={content} />;
    default:
      return (
        <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-800/50 rounded p-3 overflow-x-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
  }
}

// =============================================================================
// TYPE-SPECIFIC PREVIEWS
// =============================================================================

function ResearchPreview({ content }: { content: Record<string, unknown> }) {
  const findings = (content.findings || content.results || []) as Array<{
    title?: string;
    content?: string;
    source?: string;
  }>;

  return (
    <div className="space-y-3">
      {content.summary ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Summary</h4>
          <p className="text-sm text-zinc-300">{String(content.summary)}</p>
        </div>
      ) : null}
      {findings.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-2">Findings</h4>
          <div className="space-y-2">
            {findings.slice(0, 5).map((finding, i) => (
              <div key={i} className="bg-zinc-800/50 rounded p-2">
                {finding.title && (
                  <p className="text-sm font-medium text-white">{finding.title}</p>
                )}
                {finding.content && (
                  <p className="text-sm text-zinc-400">{finding.content}</p>
                )}
                {finding.source && (
                  <p className="text-xs text-zinc-500 mt-1">{finding.source}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PRDPreview({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      {content.title ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Title</h4>
          <p className="text-sm text-white font-medium">{String(content.title)}</p>
        </div>
      ) : null}
      {content.overview ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Overview</h4>
          <p className="text-sm text-zinc-300">{String(content.overview)}</p>
        </div>
      ) : null}
      {Array.isArray(content.goals) && content.goals.length > 0 ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Goals</h4>
          <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
            {(content.goals as string[]).slice(0, 5).map((goal, i) => (
              <li key={i}>{goal}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {Array.isArray(content.features) && content.features.length > 0 ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Features</h4>
          <div className="text-sm text-zinc-300">
            {(content.features as Array<{ name?: string; description?: string }>).slice(0, 5).map((feature, i) => (
              <div key={i} className="py-1 border-b border-zinc-800 last:border-0">
                <span className="text-white">{feature.name || `Feature ${i + 1}`}</span>
                {feature.description && (
                  <span className="text-zinc-400"> - {feature.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ArchitecturePreview({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      {content.overview ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Overview</h4>
          <p className="text-sm text-zinc-300">{String(content.overview)}</p>
        </div>
      ) : null}
      {Array.isArray(content.components) && content.components.length > 0 ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Components</h4>
          <div className="flex flex-wrap gap-2">
            {(content.components as Array<{ name?: string } | string>).slice(0, 10).map((comp, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs bg-amber-500/10 text-amber-400 rounded"
              >
                {typeof comp === 'string' ? comp : comp.name || `Component ${i + 1}`}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {content.techStack && typeof content.techStack === 'object' ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Tech Stack</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(content.techStack as Record<string, string>).map(([key, value]) => (
              <span
                key={key}
                className="px-2 py-1 text-xs bg-violet-500/10 text-violet-400 rounded"
              >
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhasePreview({ content }: { content: Record<string, unknown> }) {
  const tasks = (content.tasks || content.steps || []) as Array<{
    name?: string;
    title?: string;
    description?: string;
  }>;

  return (
    <div className="space-y-3">
      {content.name ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Phase</h4>
          <p className="text-sm text-white font-medium">{String(content.name)}</p>
        </div>
      ) : null}
      {content.description ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Description</h4>
          <p className="text-sm text-zinc-300">{String(content.description)}</p>
        </div>
      ) : null}
      {tasks.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-2">Tasks</h4>
          <div className="space-y-1">
            {tasks.slice(0, 8).map((task, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-emerald-400">{i + 1}.</span>
                <span className="text-zinc-300">
                  {task.name || task.title || task.description || `Task ${i + 1}`}
                </span>
              </div>
            ))}
            {tasks.length > 8 && (
              <p className="text-xs text-zinc-500 ml-4">
                ...and {tasks.length - 8} more tasks
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FixPreview({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      {content.error ? (
        <div>
          <h4 className="text-xs font-medium text-red-400 uppercase mb-1">Error</h4>
          <pre className="text-sm text-red-300 bg-red-500/10 rounded p-2 overflow-x-auto">
            {String(content.error)}
          </pre>
        </div>
      ) : null}
      {content.diagnosis ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Diagnosis</h4>
          <p className="text-sm text-zinc-300">{String(content.diagnosis)}</p>
        </div>
      ) : null}
      {content.fix ? (
        <div>
          <h4 className="text-xs font-medium text-emerald-400 uppercase mb-1">Proposed Fix</h4>
          <pre className="text-sm text-emerald-300 bg-emerald-500/10 rounded p-2 overflow-x-auto">
            {typeof content.fix === 'string' ? content.fix : JSON.stringify(content.fix, null, 2)}
          </pre>
        </div>
      ) : null}
      {Array.isArray(content.changes) && content.changes.length > 0 ? (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase mb-1">Changes</h4>
          <div className="space-y-1">
            {(content.changes as Array<{ file?: string; change?: string }>).map((change, i) => (
              <div key={i} className="text-sm bg-zinc-800/50 rounded p-2">
                {change.file && <span className="text-violet-400">{change.file}</span>}
                {change.change && <p className="text-zinc-300">{change.change}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// =============================================================================
// APPROVAL STATUS BADGE
// =============================================================================

interface ApprovalStatusBadgeProps {
  status: ApprovalRequest['status'];
  size?: 'sm' | 'md';
}

export function ApprovalStatusBadge({ status, size = 'sm' }: ApprovalStatusBadgeProps) {
  const config = {
    pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Pending' },
    approved: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Approved' },
    rejected: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Rejected' },
    expired: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Expired' },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${config.bg} ${config.text} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {status === 'pending' && <ClockIcon className="w-3 h-3" />}
      {status === 'approved' && <CheckIcon className="w-3 h-3" />}
      {status === 'rejected' && <XIcon className="w-3 h-3" />}
      {config.label}
    </span>
  );
}

// =============================================================================
// COMPACT APPROVAL CARD
// =============================================================================

interface ApprovalCardProps {
  request: ApprovalRequest;
  onSelect?: () => void;
}

export function ApprovalCard({ request, onSelect }: ApprovalCardProps) {
  const colors = getTypeColors(request.type);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border ${colors.border} ${colors.bg} hover:bg-opacity-80 transition-colors`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <TypeIcon type={request.type} className={`w-4 h-4 ${colors.icon}`} />
          <div>
            <p className="text-sm font-medium text-white">{request.title}</p>
            <p className="text-xs text-zinc-400">{getApprovalTypeTitle(request.type)}</p>
          </div>
        </div>
        <ApprovalStatusBadge status={request.status} />
      </div>
      {request.description && (
        <p className="mt-2 text-xs text-zinc-400 line-clamp-2">
          {request.description}
        </p>
      )}
    </button>
  );
}

// =============================================================================
// APPROVAL LIST
// =============================================================================

interface ApprovalListProps {
  requests: ApprovalRequest[];
  onSelectRequest?: (request: ApprovalRequest) => void;
  emptyMessage?: string;
}

export function ApprovalList({
  requests,
  onSelectRequest,
  emptyMessage = 'No approval requests',
}: ApprovalListProps) {
  if (requests.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-4">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <ApprovalCard
          key={request.id}
          request={request}
          onSelect={() => onSelectRequest?.(request)}
        />
      ))}
    </div>
  );
}
