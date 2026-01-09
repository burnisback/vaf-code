'use client';

/**
 * EnhancedChatMessage Component
 *
 * A rich chat message component that replaces inline code with beautiful artifact cards,
 * renders markdown content with diagrams and tables, and shows execution progress.
 */

import React, { useState, useMemo, memo } from 'react';
import {
  User,
  Bot,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { RichMarkdownRenderer } from './markdown';
import {
  ArtifactCard,
  ArtifactGroup,
  ShellCommandCard,
  type ArtifactCardProps,
} from './messages';
import {
  ExecutionProgress,
  ThinkingSkeleton,
  PlanningSkeleton,
  type ExecutionPhase,
  type ExecutionTask,
} from './progress';
import type { BoltChatMessage, BoltAction } from '@/lib/bolt/types';

// =============================================================================
// TYPES
// =============================================================================

interface EnhancedChatMessageProps {
  message: BoltChatMessage;
  isStreaming?: boolean;
  executionPhase?: ExecutionPhase;
  executionTasks?: ExecutionTask[];
  onOpenFile?: (path: string) => void;
  showAvatar?: boolean;
}

interface ParsedContent {
  textContent: string;
  artifacts: ArtifactCardProps[];
  shellCommands: { command: string; output?: string }[];
  /** True if there's an incomplete artifact tag being streamed */
  hasIncompleteArtifact: boolean;
  /** Title of the artifact being generated (if detectable) */
  incompleteArtifactTitle?: string;
}

// =============================================================================
// CONTENT PARSER
// =============================================================================

/**
 * Parse VAF artifact XML tags from content
 * Handles: <vafArtifact>, <vafAction type="file">, <vafAction type="shell">
 * Also detects incomplete artifact tags during streaming
 */
function parseVafArtifacts(content: string): {
  artifacts: ArtifactCardProps[];
  shellCommands: { command: string; output?: string }[];
  cleanedContent: string;
  hasIncompleteArtifact: boolean;
  incompleteArtifactTitle?: string;
} {
  const artifacts: ArtifactCardProps[] = [];
  const shellCommands: { command: string; output?: string }[] = [];
  let cleanedContent = content;
  let hasIncompleteArtifact = false;
  let incompleteArtifactTitle: string | undefined;

  // Match entire vafArtifact blocks (complete tags only)
  const artifactRegex = /<vafArtifact[^>]*>[\s\S]*?<\/vafArtifact>/gi;
  const artifactMatches = content.match(artifactRegex) || [];

  artifactMatches.forEach((artifactBlock) => {
    // Extract artifact title
    const titleMatch = artifactBlock.match(/title="([^"]+)"/);
    const artifactTitle = titleMatch ? titleMatch[1] : 'Artifact';

    // Parse file actions
    const fileActionRegex = /<vafAction\s+type="file"\s+filePath="([^"]+)"[^>]*>([\s\S]*?)<\/vafAction>/gi;
    let fileMatch;
    while ((fileMatch = fileActionRegex.exec(artifactBlock)) !== null) {
      const [, filePath, code] = fileMatch;
      const cleanCode = code.trim();
      const extension = filePath.split('.').pop()?.toLowerCase() || '';

      artifacts.push({
        type: 'file',
        title: filePath,
        content: cleanCode,
        metadata: {
          language: getLanguageFromExtension(extension),
          lineCount: cleanCode.split('\n').length,
          operation: 'create',
          description: artifactTitle,
        },
        status: 'success',
      });
    }

    // Parse shell actions
    const shellActionRegex = /<vafAction\s+type="shell"[^>]*>([\s\S]*?)<\/vafAction>/gi;
    let shellMatch;
    while ((shellMatch = shellActionRegex.exec(artifactBlock)) !== null) {
      const [, command] = shellMatch;
      shellCommands.push({ command: command.trim() });
    }

    // Remove the entire artifact block from content
    cleanedContent = cleanedContent.replace(artifactBlock, '');
  });

  // Check for INCOMPLETE artifact tags (streaming case)
  // This handles cases where we have <vafArtifact...> but no closing </vafArtifact>
  const incompleteArtifactMatch = cleanedContent.match(/<vafArtifact[^>]*(?:>[\s\S]*)?$/i);
  if (incompleteArtifactMatch) {
    hasIncompleteArtifact = true;

    // Try to extract the title from the incomplete tag
    const titleMatch = incompleteArtifactMatch[0].match(/title="([^"]+)"/);
    incompleteArtifactTitle = titleMatch ? titleMatch[1] : 'Generating files...';

    // Remove everything from the start of the incomplete tag
    const incompleteTagStart = cleanedContent.indexOf(incompleteArtifactMatch[0]);
    if (incompleteTagStart !== -1) {
      cleanedContent = cleanedContent.substring(0, incompleteTagStart).trim();
    }
  }

  return { artifacts, shellCommands, cleanedContent, hasIncompleteArtifact, incompleteArtifactTitle };
}

/**
 * Get language name from file extension
 */
function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    css: 'css',
    html: 'html',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bash: 'bash',
  };
  return languageMap[ext] || ext;
}

/**
 * Parse message content to extract code blocks and convert them to artifacts
 */
function parseMessageContent(content: string, actions?: BoltAction[]): ParsedContent {
  const artifacts: ArtifactCardProps[] = [];
  const shellCommands: { command: string; output?: string }[] = [];

  // First, parse VAF artifact XML tags
  const {
    artifacts: vafArtifacts,
    shellCommands: vafShellCommands,
    cleanedContent: contentAfterVaf,
    hasIncompleteArtifact,
    incompleteArtifactTitle,
  } = parseVafArtifacts(content);

  artifacts.push(...vafArtifacts);
  shellCommands.push(...vafShellCommands);

  let textContent = contentAfterVaf;

  // Then parse standard markdown fenced code blocks
  // Matches: ```language:filepath or ```language
  const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;

  let match;
  const codeBlocksToReplace: { full: string; language: string; filePath?: string; code: string }[] = [];

  while ((match = codeBlockRegex.exec(textContent)) !== null) {
    const [fullMatch, language = '', filePath, code] = match;
    codeBlocksToReplace.push({
      full: fullMatch,
      language: language.toLowerCase(),
      filePath: filePath?.trim(),
      code: code.trim(),
    });
  }

  // Create artifacts from code blocks
  codeBlocksToReplace.forEach((block, index) => {
    const { language, filePath, code } = block;

    // Skip mermaid diagrams - they'll be rendered inline
    if (language === 'mermaid') {
      return;
    }

    // Check if this is a shell command
    if (language === 'bash' || language === 'shell' || language === 'sh') {
      shellCommands.push({ command: code });
      // Remove the code block from text content for shell commands
      textContent = textContent.replace(block.full, '');
      return;
    }

    // Determine operation type from actions if available
    let operation: 'create' | 'modify' | 'delete' | undefined;
    if (actions && filePath) {
      const action = actions.find((a) => a.filePath === filePath);
      if (action) {
        operation = action.operation;
      }
    }

    // Add as artifact
    artifacts.push({
      type: 'file',
      title: filePath || `code-${index + 1}.${getExtension(language)}`,
      content: code,
      metadata: {
        language,
        lineCount: code.split('\n').length,
        operation,
      },
      status: 'success',
    });

    // Replace the code block with a placeholder marker
    textContent = textContent.replace(block.full, '');
  });

  // Add shell commands from actions
  if (actions) {
    actions
      .filter((a) => a.type === 'shell')
      .forEach((action) => {
        const existingCmd = shellCommands.find((c) => c.command === action.content);
        if (!existingCmd) {
          shellCommands.push({
            command: action.content,
            output: action.output,
          });
        }
      });
  }

  // Clean up excessive whitespace and any leftover XML-like tags
  textContent = textContent
    .replace(/<[^>]+>/g, '') // Remove any remaining XML tags
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { textContent, artifacts, shellCommands, hasIncompleteArtifact, incompleteArtifactTitle };
}

function getExtension(language: string): string {
  const extensions: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    tsx: 'tsx',
    jsx: 'jsx',
    python: 'py',
    css: 'css',
    html: 'html',
    json: 'json',
    markdown: 'md',
    yaml: 'yaml',
    yml: 'yml',
  };
  return extensions[language] || language || 'txt';
}

// =============================================================================
// USER MESSAGE COMPONENT
// =============================================================================

const UserMessage = memo(function UserMessage({
  content,
  showAvatar,
}: {
  content: string;
  showAvatar: boolean;
}) {
  return (
    <div className="flex gap-3 justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-violet-500/20 border border-violet-500/20">
        <p className="text-sm text-violet-100 whitespace-pre-wrap break-words">
          {content}
        </p>
      </div>
      {showAvatar && (
        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-violet-400" />
        </div>
      )}
    </div>
  );
});

// =============================================================================
// GENERATING ARTIFACT SKELETON
// =============================================================================

function GeneratingArtifactSkeleton({ title }: { title?: string }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-4 h-4 rounded bg-emerald-500/30 animate-pulse" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-emerald-300">
              {title || 'Generating files...'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
            <span className="text-xs text-emerald-400/70">Writing code...</span>
          </div>
        </div>
      </div>
      {/* Shimmer effect for file content */}
      <div className="px-3 pb-3 space-y-2">
        <div className="h-2 bg-emerald-500/10 rounded animate-shimmer" style={{ width: '90%' }} />
        <div className="h-2 bg-emerald-500/10 rounded animate-shimmer" style={{ width: '75%', animationDelay: '100ms' }} />
        <div className="h-2 bg-emerald-500/10 rounded animate-shimmer" style={{ width: '60%', animationDelay: '200ms' }} />
        <div className="h-2 bg-emerald-500/10 rounded animate-shimmer" style={{ width: '80%', animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

// =============================================================================
// ASSISTANT MESSAGE COMPONENT
// =============================================================================

const AssistantMessage = memo(function AssistantMessage({
  message,
  isStreaming,
  executionPhase,
  executionTasks,
  onOpenFile,
  showAvatar,
}: EnhancedChatMessageProps & { showAvatar: boolean }) {
  const [showAllArtifacts, setShowAllArtifacts] = useState(false);

  // Parse content to extract artifacts
  const { textContent, artifacts, shellCommands, hasIncompleteArtifact, incompleteArtifactTitle } = useMemo(
    () => parseMessageContent(message.content || '', message.actions),
    [message.content, message.actions]
  );

  const isError = message.status === 'error';

  // Show thinking skeleton for empty streaming messages
  if (isStreaming && !message.content && executionPhase === 'thinking') {
    return (
      <div className="flex gap-3">
        {showAvatar && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="flex-1 max-w-[85%]">
          <ThinkingSkeleton />
        </div>
      </div>
    );
  }

  // Show planning skeleton
  if (isStreaming && executionPhase === 'planning' && executionTasks?.length === 0) {
    return (
      <div className="flex gap-3">
        {showAvatar && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="flex-1 max-w-[85%]">
          <PlanningSkeleton />
        </div>
      </div>
    );
  }

  // Visible artifacts (limit to 3 when collapsed)
  const visibleArtifacts = showAllArtifacts ? artifacts : artifacts.slice(0, 3);
  const hasMoreArtifacts = artifacts.length > 3;

  return (
    <div className="flex gap-3">
      {showAvatar && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div className="flex-1 max-w-[85%] space-y-3">
        {/* Error state */}
        {isError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>An error occurred while processing your request</span>
          </div>
        )}

        {/* Execution Progress (when executing) */}
        {executionPhase && executionTasks && executionTasks.length > 0 && (
          <ExecutionProgress
            phase={executionPhase}
            tasks={executionTasks}
            startTime={Date.now()}
          />
        )}

        {/* Rich Markdown Content */}
        {textContent && (
          <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-zinc-800/50 border border-zinc-700/30">
            <RichMarkdownRenderer content={textContent} />

            {/* Streaming indicator - only show if NOT generating artifact (artifact has its own indicator) */}
            {isStreaming && !hasIncompleteArtifact && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-700/30">
                <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                <span className="text-xs text-zinc-500">Generating...</span>
              </div>
            )}
          </div>
        )}

        {/* Shell Commands */}
        {shellCommands.length > 0 && (
          <div className="space-y-2">
            {shellCommands.map((cmd, i) => (
              <ShellCommandCard
                key={`shell-${i}`}
                command={cmd.command}
                output={cmd.output}
                status="success"
              />
            ))}
          </div>
        )}

        {/* Artifacts (Code Files) */}
        {artifacts.length > 0 && (
          <div className="space-y-2">
            {artifacts.length === 1 ? (
              <ArtifactCard {...artifacts[0]} onOpenFile={onOpenFile} />
            ) : (
              <>
                <ArtifactGroup
                  artifacts={visibleArtifacts}
                  onOpenFile={onOpenFile}
                />
                {hasMoreArtifacts && !showAllArtifacts && (
                  <button
                    onClick={() => setShowAllArtifacts(true)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <ChevronDown className="w-3 h-3" />
                    Show {artifacts.length - 3} more files
                  </button>
                )}
                {hasMoreArtifacts && showAllArtifacts && (
                  <button
                    onClick={() => setShowAllArtifacts(false)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <ChevronRight className="w-3 h-3" />
                    Show less
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Generating Artifact Skeleton (shown during streaming when incomplete artifact detected) */}
        {hasIncompleteArtifact && (
          <GeneratingArtifactSkeleton title={incompleteArtifactTitle} />
        )}
      </div>
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EnhancedChatMessage({
  message,
  isStreaming = false,
  executionPhase,
  executionTasks,
  onOpenFile,
  showAvatar = true,
}: EnhancedChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <UserMessage
        content={message.content || ''}
        showAvatar={showAvatar}
      />
    );
  }

  return (
    <AssistantMessage
      message={message}
      isStreaming={isStreaming || message.status === 'streaming'}
      executionPhase={executionPhase}
      executionTasks={executionTasks}
      onOpenFile={onOpenFile}
      showAvatar={showAvatar}
    />
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { parseMessageContent };
export type { EnhancedChatMessageProps, ParsedContent };
