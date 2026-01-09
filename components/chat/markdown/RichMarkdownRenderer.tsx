'use client';

/**
 * RichMarkdownRenderer Component
 *
 * Renders markdown content with enhanced features:
 * - Syntax-highlighted code blocks
 * - Mermaid diagram rendering
 * - Styled tables
 * - Collapsible sections
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Maximize2,
  ExternalLink,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface RichMarkdownRendererProps {
  content: string;
  className?: string;
  onCodeBlockFound?: (code: string, language: string, path?: string) => void;
}

// =============================================================================
// MERMAID DIAGRAM COMPONENT
// =============================================================================

const MermaidDiagram = memo(function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const renderDiagram = async () => {
      try {
        // Dynamically import mermaid to avoid SSR issues
        const mermaid = (await import('mermaid')).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#8b5cf6',
            primaryTextColor: '#fff',
            primaryBorderColor: '#7c3aed',
            lineColor: '#6b7280',
            secondaryColor: '#374151',
            tertiaryColor: '#1f2937',
            background: '#0a0a0a',
            mainBkg: '#1f2937',
            nodeBorder: '#4b5563',
            clusterBkg: '#1f2937',
            edgeLabelBackground: '#374151',
          },
          fontFamily: 'ui-monospace, monospace',
          fontSize: 14,
        });

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);

        if (mounted) {
          setSvg(renderedSvg);
          setError('');
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setSvg('');
        }
      }
    };

    renderDiagram();

    return () => {
      mounted = false;
    };
  }, [code]);

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
        <p className="font-medium mb-1">Diagram Error</p>
        <p className="text-xs opacity-80">{error}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 animate-pulse">
        <div className="h-32 bg-zinc-700/30 rounded" />
      </div>
    );
  }

  return (
    <div className="relative group rounded-lg bg-zinc-900/50 border border-zinc-700/50 overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => setIsFullscreen(true)}
          className="p-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 transition-colors"
          title="Fullscreen"
        >
          <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>

      {/* Diagram */}
      <div
        ref={containerRef}
        className="p-4 overflow-auto max-h-80 flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="max-w-full max-h-full overflow-auto bg-zinc-900 rounded-xl p-6 border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      )}
    </div>
  );
});

// =============================================================================
// CODE BLOCK COMPONENT
// =============================================================================

interface CodeBlockProps {
  language: string;
  code: string;
  onOpenFile?: (path: string) => void;
}

const CodeBlock = memo(function CodeBlock({ language, code, onOpenFile }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // Check if it's a mermaid diagram
  if (language === 'mermaid') {
    return <MermaidDiagram code={code} />;
  }

  // Check if it looks like a file path in the language (e.g., ```tsx:src/components/Button.tsx)
  const [lang, filePath] = language.includes(':') ? language.split(':') : [language, undefined];

  return (
    <div className="rounded-lg overflow-hidden bg-[#1e1e1e] border border-zinc-700/50 my-3">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/80 border-b border-zinc-700/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono">
            {lang || 'code'}
          </span>
          {filePath && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="text-xs text-zinc-500 font-mono">{filePath}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {filePath && onOpenFile && (
            <button
              onClick={() => onOpenFile(filePath)}
              className="p-1 rounded hover:bg-zinc-700 transition-colors"
              title="Open in editor"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-zinc-700 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      <pre className="p-3 overflow-x-auto max-h-96">
        <code className="text-sm font-mono text-[#d4d4d4] leading-relaxed whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
});

// =============================================================================
// INLINE CODE COMPONENT
// =============================================================================

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-violet-300 text-sm font-mono">
      {children}
    </code>
  );
}

// =============================================================================
// TABLE COMPONENT
// =============================================================================

function Table(props: any) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-zinc-700/50">
      <table className="w-full text-sm">
        {props.children}
      </table>
    </div>
  );
}

function TableHead(props: any) {
  return (
    <thead className="bg-zinc-800/50 border-b border-zinc-700/50">
      {props.children}
    </thead>
  );
}

function TableBody(props: any) {
  return <tbody className="divide-y divide-zinc-700/30">{props.children}</tbody>;
}

function TableRow(props: any) {
  return <tr className="hover:bg-zinc-800/30 transition-colors">{props.children}</tr>;
}

function TableHeader(props: any) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">
      {props.children}
    </th>
  );
}

function TableCell(props: any) {
  return (
    <td className="px-4 py-2.5 text-zinc-300">
      {props.children}
    </td>
  );
}

// =============================================================================
// COLLAPSIBLE SECTION
// =============================================================================

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="my-3 rounded-lg border border-zinc-700/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors text-left"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        )}
        <span className="text-sm font-medium text-zinc-300">{title}</span>
      </button>
      {isOpen && (
        <div className="px-3 py-2 border-t border-zinc-700/50 text-sm text-zinc-400">
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function RichMarkdownRenderer({
  content,
  className = '',
  onCodeBlockFound,
}: RichMarkdownRendererProps) {
  // Custom components for react-markdown
  const components = {
    // Code blocks (fenced)
    code({ node, inline, className: codeClassName, children, ...props }: any) {
      const match = /language-(\S+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';
      const code = String(children).replace(/\n$/, '');

      if (!inline && language) {
        // Notify parent about code block
        onCodeBlockFound?.(code, language);
        return <CodeBlock language={language} code={code} />;
      }

      // Inline code
      return <InlineCode>{children}</InlineCode>;
    },

    // Pre tag (wrapper for code blocks)
    pre({ children }: any) {
      return <>{children}</>;
    },

    // Tables
    table: Table,
    thead: TableHead,
    tbody: TableBody,
    tr: TableRow,
    th: TableHeader,
    td: TableCell,

    // Links
    a({ href, children }: any) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
        >
          {children}
        </a>
      );
    },

    // Headings
    h1({ children }: any) {
      return <h1 className="text-xl font-bold text-white mt-6 mb-3">{children}</h1>;
    },
    h2({ children }: any) {
      return <h2 className="text-lg font-semibold text-white mt-5 mb-2">{children}</h2>;
    },
    h3({ children }: any) {
      return <h3 className="text-base font-semibold text-zinc-200 mt-4 mb-2">{children}</h3>;
    },
    h4({ children }: any) {
      return <h4 className="text-sm font-semibold text-zinc-300 mt-3 mb-1">{children}</h4>;
    },

    // Paragraphs
    p({ children }: any) {
      return <p className="text-zinc-300 leading-relaxed mb-3 last:mb-0">{children}</p>;
    },

    // Lists
    ul({ children }: any) {
      return <ul className="list-disc list-inside space-y-1 mb-3 text-zinc-300">{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className="list-decimal list-inside space-y-1 mb-3 text-zinc-300">{children}</ol>;
    },
    li({ children }: any) {
      return <li className="text-zinc-300">{children}</li>;
    },

    // Blockquotes
    blockquote({ children }: any) {
      return (
        <blockquote className="border-l-4 border-violet-500/50 pl-4 py-1 my-3 text-zinc-400 italic">
          {children}
        </blockquote>
      );
    },

    // Horizontal rule
    hr() {
      return <hr className="border-zinc-700/50 my-4" />;
    },

    // Strong/Bold
    strong({ children }: any) {
      return <strong className="font-semibold text-zinc-200">{children}</strong>;
    },

    // Emphasis/Italic
    em({ children }: any) {
      return <em className="italic text-zinc-300">{children}</em>;
    },
  };

  return (
    <div className={`rich-markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { MermaidDiagram, CodeBlock, CollapsibleSection };
