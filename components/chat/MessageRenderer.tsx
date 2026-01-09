'use client';

import React, { useMemo } from 'react';
import { Bot, User, Code, FileCode, AlertCircle } from 'lucide-react';

/**
 * MessageRenderer Component
 *
 * Renders AI chat messages with markdown parsing, code highlighting,
 * and file operation indicators.
 */

interface MessageRendererProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

export function MessageRenderer({
  role,
  content,
  isStreaming = false,
}: MessageRendererProps) {
  const isUser = role === 'user';

  // Parse content for code blocks
  const parsedContent = useMemo(() => {
    return parseMarkdown(content);
  }, [content]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-[var(--color-accent-primary)] text-white'
            : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)]'
        }`}
      >
        {/* Message header for assistant */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-2 text-xs text-[var(--color-text-tertiary)]">
            <Bot className="w-3 h-3" />
            <span>VAF Code</span>
          </div>
        )}

        {/* Rendered content */}
        <div className="text-sm leading-relaxed space-y-3">
          {parsedContent.map((block, index) => (
            <ContentBlock key={index} block={block} isUser={isUser} />
          ))}
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
        )}
      </div>
    </div>
  );
}

// Content block types
type ContentBlockType =
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; content: string }
  | { type: 'file'; path: string; operation: string };

// Parse markdown content into blocks
function parseMarkdown(content: string): ContentBlockType[] {
  const blocks: ContentBlockType[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        blocks.push({ type: 'text', content: textContent });
      }
    }

    // Add the code block
    blocks.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      blocks.push({ type: 'text', content: textContent });
    }
  }

  // If no blocks were created, add the whole content as text
  if (blocks.length === 0 && content.trim()) {
    blocks.push({ type: 'text', content: content.trim() });
  }

  return blocks;
}

// Render individual content blocks
function ContentBlock({
  block,
  isUser,
}: {
  block: ContentBlockType;
  isUser: boolean;
}) {
  switch (block.type) {
    case 'text':
      return <TextBlock content={block.content} isUser={isUser} />;
    case 'code':
      return <CodeBlock language={block.language} content={block.content} />;
    case 'file':
      return <FileBlock path={block.path} operation={block.operation} />;
    default:
      return null;
  }
}

// Text block with basic markdown
function TextBlock({ content, isUser }: { content: string; isUser: boolean }) {
  // Simple inline code highlighting
  const parts = content.split(/(`[^`]+`)/g);

  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                isUser
                  ? 'bg-white/20'
                  : 'bg-[var(--color-surface-tertiary)] text-[var(--color-accent-primary)]'
              }`}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

// Code block with syntax highlighting placeholder
function CodeBlock({
  language,
  content,
}: {
  language: string;
  content: string;
}) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="rounded-lg overflow-hidden bg-[#1e1e1e] border border-[var(--color-border-default)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d] border-b border-[var(--color-border-default)]">
        <div className="flex items-center gap-2">
          <Code className="w-3 h-3 text-[var(--color-text-tertiary)]" />
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {language || 'code'}
          </span>
        </div>
        <button
          onClick={copyToClipboard}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          Copy
        </button>
      </div>

      {/* Code content */}
      <pre className="p-3 overflow-x-auto">
        <code className="text-xs font-mono text-[#d4d4d4] leading-relaxed">
          {content}
        </code>
      </pre>
    </div>
  );
}

// File operation indicator
function FileBlock({
  path,
  operation,
}: {
  path: string;
  operation: string;
}) {
  const operationColors = {
    create: 'text-green-400 bg-green-400/10',
    update: 'text-blue-400 bg-blue-400/10',
    delete: 'text-red-400 bg-red-400/10',
  };

  const colorClass =
    operationColors[operation as keyof typeof operationColors] ||
    'text-gray-400 bg-gray-400/10';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorClass}`}
    >
      <FileCode className="w-4 h-4" />
      <span className="text-xs font-medium uppercase">{operation}</span>
      <span className="text-xs font-mono">{path}</span>
    </div>
  );
}

// Loading message component
export function LoadingMessage() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)]">
        <div className="flex items-center gap-2 mb-2 text-xs text-[var(--color-text-tertiary)]">
          <Bot className="w-3 h-3" />
          <span>VAF Code</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-[var(--color-accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-[var(--color-accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-[var(--color-accent-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-[var(--color-text-tertiary)]">
            Thinking...
          </span>
        </div>
      </div>
    </div>
  );
}

// Error message component
export function ErrorMessage({ error }: { error: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl px-4 py-3 bg-red-500/10 border border-red-500/30">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    </div>
  );
}
