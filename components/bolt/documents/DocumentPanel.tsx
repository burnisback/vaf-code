'use client';

/**
 * DocumentPanel
 *
 * UI for viewing and managing stored documents.
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Trash2,
  ExternalLink,
  Clock,
  Tag,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { StoredDocument, DocumentType } from '@/lib/bolt/documents/types';
import { getDocumentStore } from '@/lib/bolt/documents/store';

interface DocumentPanelProps {
  /** Current session ID (to highlight session docs) */
  sessionId?: string;

  /** Called when a document is selected */
  onSelect?: (document: StoredDocument) => void;

  /** Called when a document should be deleted */
  onDelete?: (id: string) => void;
}

export function DocumentPanel({
  sessionId,
  onSelect,
  onDelete,
}: DocumentPanelProps) {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load documents
  useEffect(() => {
    async function loadDocs() {
      setLoading(true);
      try {
        const store = getDocumentStore();
        const result = await store.search({
          query: searchQuery || undefined,
          types: selectedType === 'all' ? undefined : [selectedType],
          limit: 50,
        });
        setDocuments(result.documents);
      } finally {
        setLoading(false);
      }
    }
    loadDocs();
  }, [searchQuery, selectedType]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const store = getDocumentStore();
      const result = await store.search({
        query: searchQuery || undefined,
        types: selectedType === 'all' ? undefined : [selectedType],
        limit: 50,
      });
      setDocuments(result.documents);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const store = getDocumentStore();
    await store.delete(id);
    onDelete?.(id);
    loadDocuments();
  }

  const typeOptions: Array<{ value: DocumentType | 'all'; label: string }> = [
    { value: 'all', label: 'All Types' },
    { value: 'research-synthesis', label: 'Research' },
    { value: 'product-requirements', label: 'Requirements' },
    { value: 'architecture', label: 'Architecture' },
    { value: 'feature-list', label: 'Features' },
    { value: 'technical-spec', label: 'Technical Spec' },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <h2 className="text-sm font-medium text-white mb-3">Documents</h2>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Type filter */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as DocumentType | 'all')}
          className="w-full px-2 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-white focus:outline-none focus:border-violet-500"
        >
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {loading ? (
          <div className="p-4 text-center text-zinc-500 text-sm">
            Loading...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-sm">
            No documents found
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {documents.map((doc) => (
              <DocumentItem
                key={doc.id}
                document={doc}
                isCurrentSession={doc.sessionId === sessionId}
                isExpanded={expandedId === doc.id}
                onToggle={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                onSelect={() => onSelect?.(doc)}
                onDelete={() => handleDelete(doc.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function DocumentItem({
  document,
  isCurrentSession,
  isExpanded,
  onToggle,
  onSelect,
  onDelete,
}: {
  document: StoredDocument;
  isCurrentSession: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const typeColors: Record<DocumentType, string> = {
    'research-synthesis': 'text-violet-400',
    'competitor-analysis': 'text-blue-400',
    'feature-list': 'text-emerald-400',
    'product-requirements': 'text-yellow-400',
    'architecture': 'text-orange-400',
    'technical-spec': 'text-cyan-400',
    'user-stories': 'text-pink-400',
    'implementation-plan': 'text-red-400',
    'custom': 'text-zinc-400',
  };

  return (
    <div className={`${isCurrentSession ? 'bg-violet-500/5' : ''}`}>
      <div
        className="flex items-start gap-2 p-3 cursor-pointer hover:bg-zinc-800/50"
        onClick={onToggle}
      >
        {/* Expand/Collapse */}
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
        )}

        {/* Icon */}
        <FileText className={`w-4 h-4 shrink-0 mt-0.5 ${typeColors[document.type]}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium truncate">
              {document.title}
            </span>
            {isCurrentSession && (
              <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded">
                Current
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate mt-0.5">
            {document.description}
          </p>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(document.updatedAt)}
            </span>
            <span className="capitalize">{document.type.replace('-', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-9 pb-3 space-y-2">
          {/* Tags */}
          {document.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="w-3 h-3 text-zinc-600" />
              {document.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Preview */}
          <div className="text-xs text-zinc-400 bg-zinc-800/50 rounded p-2 max-h-32 overflow-y-auto overflow-x-hidden scrollbar-thin">
            {document.content.slice(0, 500)}
            {document.content.length > 500 && '...'}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSelect}
              className="flex items-center gap-1 px-2 py-1 text-xs text-violet-400 hover:bg-violet-500/10 rounded transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
