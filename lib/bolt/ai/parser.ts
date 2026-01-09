/**
 * Bolt Artifact Parser
 *
 * Parses vafArtifact/vafAction XML tags from AI responses.
 * Supports streaming and complete response parsing.
 */

import type { BoltArtifact, BoltAction } from '../types';

// =============================================================================
// PARSER TYPES
// =============================================================================

export interface ParsedAction {
  type: 'file' | 'shell';
  filePath?: string;
  content: string;
}

export interface ParsedArtifact {
  id: string;
  title: string;
  actions: ParsedAction[];
}

export interface StreamingParseResult {
  /** Text content outside of artifacts */
  text: string;
  /** Completely parsed artifacts */
  artifacts: ParsedArtifact[];
  /** Whether we're currently inside an artifact */
  inArtifact: boolean;
  /** Partial artifact content (for streaming) */
  partialArtifact?: string;
}

// =============================================================================
// REGEX PATTERNS
// =============================================================================

// Match complete artifacts
const ARTIFACT_REGEX = /<vafArtifact\s+id="([^"]+)"\s+title="([^"]*)">([\s\S]*?)<\/vafArtifact>/g;

// Match actions within artifacts (greedy but respects nesting)
const ACTION_REGEX = /<vafAction\s+type="(file|shell)"(?:\s+filePath="([^"]*)")?\s*>([\s\S]*?)<\/vafAction>/g;

// For detecting partial artifacts in streaming
const PARTIAL_ARTIFACT_START = /<vafArtifact\s+id="[^"]*"\s+title="[^"]*">/;
const ARTIFACT_END = /<\/vafArtifact>/;

// =============================================================================
// MAIN PARSER
// =============================================================================

/**
 * Strip markdown code blocks from text
 */
function stripCodeBlocks(text: string): string {
  // Remove ```xml ... ``` and similar code blocks
  return text.replace(/```(?:xml|html)?\n?([\s\S]*?)```/g, '$1');
}

/**
 * Parse complete AI response for artifacts
 */
export function parseArtifacts(text: string): ParsedArtifact[] {
  const artifacts: ParsedArtifact[] = [];

  // Strip any markdown code blocks first
  const cleanedText = stripCodeBlocks(text);

  // Reset regex lastIndex
  ARTIFACT_REGEX.lastIndex = 0;

  let match;
  while ((match = ARTIFACT_REGEX.exec(cleanedText)) !== null) {
    const [, id, title, content] = match;
    const actions = parseActions(content);

    artifacts.push({
      id,
      title,
      actions,
    });
  }

  return artifacts;
}

/**
 * Parse actions from artifact content
 */
function parseActions(content: string): ParsedAction[] {
  const actions: ParsedAction[] = [];

  // Reset regex lastIndex
  ACTION_REGEX.lastIndex = 0;

  let match;
  while ((match = ACTION_REGEX.exec(content)) !== null) {
    const [, type, filePath, actionContent] = match;

    actions.push({
      type: type as 'file' | 'shell',
      filePath: filePath || undefined,
      content: cleanContent(actionContent),
    });
  }

  return actions;
}

/**
 * Clean content by trimming and normalizing whitespace
 */
function cleanContent(content: string): string {
  // Trim leading/trailing whitespace
  let cleaned = content.trim();

  // Remove common leading whitespace from all lines (dedent)
  const lines = cleaned.split('\n');
  if (lines.length > 1) {
    // Find minimum indentation (excluding empty lines)
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    if (nonEmptyLines.length > 0) {
      const minIndent = Math.min(
        ...nonEmptyLines.map(line => {
          const match = line.match(/^(\s*)/);
          return match ? match[1].length : 0;
        })
      );

      // Remove common indentation
      if (minIndent > 0) {
        cleaned = lines
          .map(line => line.slice(minIndent))
          .join('\n');
      }
    }
  }

  return cleaned;
}

// =============================================================================
// STREAMING PARSER
// =============================================================================

/**
 * Parser state for incremental/streaming parsing
 */
export class StreamingParser {
  private buffer: string = '';
  private parsedArtifacts: ParsedArtifact[] = [];
  private textContent: string = '';

  /**
   * Add a chunk of text and parse any complete artifacts
   */
  append(chunk: string): {
    newText: string;
    newArtifacts: ParsedArtifact[];
    actions: ParsedAction[];
  } {
    // Strip code blocks from the chunk before adding to buffer
    const cleanedChunk = stripCodeBlocks(chunk);
    this.buffer += cleanedChunk;

    const result = {
      newText: '',
      newArtifacts: [] as ParsedArtifact[],
      actions: [] as ParsedAction[],
    };

    // Try to extract complete artifacts
    let match;
    let lastEnd = 0;

    ARTIFACT_REGEX.lastIndex = 0;
    while ((match = ARTIFACT_REGEX.exec(this.buffer)) !== null) {
      const fullMatch = match[0];
      const matchStart = match.index;
      const matchEnd = matchStart + fullMatch.length;

      // Text before this artifact
      const textBefore = this.buffer.slice(lastEnd, matchStart);
      if (textBefore.trim()) {
        result.newText += textBefore;
        this.textContent += textBefore;
      }

      // Parse the artifact
      const [, id, title, content] = match;
      const actions = parseActions(content);

      const artifact: ParsedArtifact = { id, title, actions };
      this.parsedArtifacts.push(artifact);
      result.newArtifacts.push(artifact);
      result.actions.push(...actions);

      lastEnd = matchEnd;
    }

    // Keep unmatched content in buffer (might be partial artifact)
    if (lastEnd > 0) {
      const remaining = this.buffer.slice(lastEnd);

      // Check if remaining content starts with artifact
      if (PARTIAL_ARTIFACT_START.test(remaining)) {
        // Keep partial artifact in buffer
        this.buffer = remaining;
      } else {
        // Extract text and reset buffer
        result.newText += remaining;
        this.textContent += remaining;
        this.buffer = '';
      }
    } else {
      // No complete artifacts found, check for partial
      const partialMatch = this.buffer.match(PARTIAL_ARTIFACT_START);
      if (partialMatch) {
        // Extract text before partial artifact
        const textBefore = this.buffer.slice(0, partialMatch.index);
        if (textBefore.trim()) {
          result.newText += textBefore;
          this.textContent += textBefore;
        }
        // Keep partial artifact in buffer
        this.buffer = this.buffer.slice(partialMatch.index);
      } else {
        // No artifacts, all text
        result.newText += this.buffer;
        this.textContent += this.buffer;
        this.buffer = '';
      }
    }

    return result;
  }

  /**
   * Finalize parsing - handle any remaining content
   */
  finalize(): {
    text: string;
    artifacts: ParsedArtifact[];
  } {
    // Any remaining buffer is text (incomplete artifact is discarded)
    if (this.buffer.trim()) {
      this.textContent += this.buffer;
    }

    return {
      text: this.textContent.trim(),
      artifacts: this.parsedArtifacts,
    };
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.buffer = '';
    this.parsedArtifacts = [];
    this.textContent = '';
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract just the text content (no artifacts) from a response
 */
export function extractTextContent(text: string): string {
  // Remove all artifact tags and their content
  return text
    .replace(ARTIFACT_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if text contains any artifacts
 */
export function hasArtifacts(text: string): boolean {
  ARTIFACT_REGEX.lastIndex = 0;
  return ARTIFACT_REGEX.test(text);
}

/**
 * Convert parsed artifacts to Bolt types
 */
export function toBoltArtifacts(parsed: ParsedArtifact[]): BoltArtifact[] {
  return parsed.map(artifact => ({
    id: artifact.id,
    title: artifact.title,
    actions: artifact.actions.map(action => ({
      type: action.type,
      filePath: action.filePath,
      content: action.content,
      status: 'pending' as const,
    })),
  }));
}

/**
 * Validate artifact structure
 */
export function validateArtifact(artifact: ParsedArtifact): string[] {
  const errors: string[] = [];

  if (!artifact.id) {
    errors.push('Artifact missing id');
  }

  if (!artifact.title) {
    errors.push('Artifact missing title');
  }

  for (let i = 0; i < artifact.actions.length; i++) {
    const action = artifact.actions[i];

    if (action.type === 'file' && !action.filePath) {
      errors.push(`Action ${i + 1}: File action missing filePath`);
    }

    if (!action.content || action.content.trim().length === 0) {
      errors.push(`Action ${i + 1}: Action has empty content`);
    }
  }

  return errors;
}
