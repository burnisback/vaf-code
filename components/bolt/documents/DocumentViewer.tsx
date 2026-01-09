'use client';

/**
 * DocumentViewer
 *
 * Full view of a stored document with actions.
 */

import React from 'react';
import { X, Download, Copy, FileText, ExternalLink } from 'lucide-react';
import type { StoredDocument } from '@/lib/bolt/documents/types';

interface DocumentViewerProps {
  document: StoredDocument;
  onClose: () => void;
  onUseInChat?: () => void;
}

export function DocumentViewer({
  document,
  onClose,
  onUseInChat,
}: DocumentViewerProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(document.content);
  };

  const handleDownload = () => {
    const blob = new Blob([document.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-sm font-medium text-white">{document.title}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {document.type.replace('-', ' ')} - v{document.version}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin p-4">
          <div className="prose prose-invert prose-sm max-w-none">
            {/* Simple markdown-ish rendering */}
            {document.content.split('\n').map((line, i) => {
              if (line.startsWith('# ')) {
                return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
              }
              if (line.startsWith('## ')) {
                return <h2 key={i} className="text-lg font-semibold mt-3 mb-2">{line.slice(3)}</h2>;
              }
              if (line.startsWith('### ')) {
                return <h3 key={i} className="text-base font-medium mt-2 mb-1">{line.slice(4)}</h3>;
              }
              if (line.startsWith('- ')) {
                return <li key={i} className="ml-4">{line.slice(2)}</li>;
              }
              if (line.startsWith('*') && line.endsWith('*')) {
                return <p key={i} className="text-zinc-400 italic">{line.slice(1, -1)}</p>;
              }
              if (line.trim() === '') {
                return <br key={i} />;
              }
              return <p key={i}>{line}</p>;
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            {document.metadata.sources && document.metadata.sources.length > 0 && (
              <span className="text-xs text-zinc-500">
                {document.metadata.sources.length} sources
              </span>
            )}
            {document.metadata.confidence && (
              <span className="text-xs text-zinc-500">
                {Math.round(document.metadata.confidence * 100)}% confidence
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            {onUseInChat && (
              <button
                onClick={onUseInChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Use in Chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
