/**
 * Token Optimizer
 *
 * Optimizes token usage through context compression and prompt optimization.
 */

/**
 * Token estimation (approximate)
 * Gemini uses ~4 characters per token for English text
 */
const CHARS_PER_TOKEN = 4;

/**
 * Token limits by model
 */
export const MODEL_TOKEN_LIMITS = {
  'gemini-1.5-flash': 1000000,
  'gemini-1.5-flash-8b': 1000000,
  'gemini-1.5-pro': 2000000,
} as const;

/**
 * Estimate token count from text
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a message array
 */
export function estimateMessagesTokens(
  messages: { role: string; content: string }[]
): number {
  return messages.reduce((total, msg) => {
    // Add overhead for role and formatting
    return total + estimateTokenCount(msg.content) + 4;
  }, 0);
}

/**
 * Truncation options
 */
export interface TruncateOptions {
  maxTokens: number;
  strategy: 'start' | 'end' | 'middle';
  ellipsis?: string;
  preserveLines?: boolean;
}

/**
 * Truncate text to fit token limit
 */
export function truncateToTokenLimit(
  text: string,
  options: TruncateOptions
): string {
  const { maxTokens, strategy, ellipsis = '...', preserveLines = false } = options;
  const currentTokens = estimateTokenCount(text);

  if (currentTokens <= maxTokens) {
    return text;
  }

  const targetChars = maxTokens * CHARS_PER_TOKEN - ellipsis.length;

  if (preserveLines) {
    return truncateByLines(text, targetChars, strategy, ellipsis);
  }

  switch (strategy) {
    case 'start':
      return ellipsis + text.slice(-targetChars);
    case 'end':
      return text.slice(0, targetChars) + ellipsis;
    case 'middle':
      const halfTarget = Math.floor(targetChars / 2);
      return text.slice(0, halfTarget) + ellipsis + text.slice(-halfTarget);
    default:
      return text.slice(0, targetChars) + ellipsis;
  }
}

/**
 * Truncate by lines
 */
function truncateByLines(
  text: string,
  targetChars: number,
  strategy: 'start' | 'end' | 'middle',
  ellipsis: string
): string {
  const lines = text.split('\n');
  let result: string[] = [];
  let currentChars = 0;

  if (strategy === 'end') {
    for (const line of lines) {
      if (currentChars + line.length + 1 > targetChars) break;
      result.push(line);
      currentChars += line.length + 1;
    }
    if (result.length < lines.length) {
      result.push(ellipsis);
    }
  } else if (strategy === 'start') {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentChars + lines[i].length + 1 > targetChars) break;
      result.unshift(lines[i]);
      currentChars += lines[i].length + 1;
    }
    if (result.length < lines.length) {
      result.unshift(ellipsis);
    }
  } else {
    // Middle - keep start and end
    const halfTarget = targetChars / 2;
    let startChars = 0;
    let endChars = 0;
    const startLines: string[] = [];
    const endLines: string[] = [];

    for (const line of lines) {
      if (startChars + line.length + 1 > halfTarget) break;
      startLines.push(line);
      startChars += line.length + 1;
    }

    for (let i = lines.length - 1; i >= 0; i--) {
      if (endChars + lines[i].length + 1 > halfTarget) break;
      endLines.unshift(lines[i]);
      endChars += lines[i].length + 1;
    }

    result = [...startLines, ellipsis, ...endLines];
  }

  return result.join('\n');
}

/**
 * Context compression options
 */
export interface CompressionOptions {
  removeComments?: boolean;
  removeEmptyLines?: boolean;
  minifyWhitespace?: boolean;
  summarizeThreshold?: number;
}

/**
 * Compress code content to reduce tokens
 */
export function compressCode(
  code: string,
  options: CompressionOptions = {}
): string {
  let result = code;

  // Remove comments
  if (options.removeComments) {
    // Remove single-line comments
    result = result.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  // Remove empty lines
  if (options.removeEmptyLines) {
    result = result.replace(/^\s*[\r\n]/gm, '');
  }

  // Minify whitespace (but preserve structure)
  if (options.minifyWhitespace) {
    // Reduce multiple spaces to single space
    result = result.replace(/  +/g, ' ');
    // Remove trailing whitespace
    result = result.replace(/[ \t]+$/gm, '');
  }

  return result;
}

/**
 * Compress markdown content
 */
export function compressMarkdown(md: string): string {
  let result = md;

  // Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // Simplify multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Remove trailing whitespace
  result = result.replace(/[ \t]+$/gm, '');

  return result;
}

/**
 * Message history options
 */
export interface HistoryOptions {
  maxTokens: number;
  keepSystemMessage?: boolean;
  keepLastN?: number;
  summarizeOld?: boolean;
}

/**
 * Trim message history to fit token limit
 */
export function trimMessageHistory(
  messages: { role: string; content: string }[],
  options: HistoryOptions
): { role: string; content: string }[] {
  const { maxTokens, keepSystemMessage = true, keepLastN = 2 } = options;

  // Separate system message and conversation
  const systemMessage = keepSystemMessage
    ? messages.find((m) => m.role === 'system')
    : undefined;
  const conversation = messages.filter((m) => m.role !== 'system');

  // Always keep the last N messages
  const lastMessages = conversation.slice(-keepLastN);
  const olderMessages = conversation.slice(0, -keepLastN);

  // Calculate available tokens
  let usedTokens = systemMessage
    ? estimateTokenCount(systemMessage.content) + 4
    : 0;
  usedTokens += estimateMessagesTokens(lastMessages);

  const availableTokens = maxTokens - usedTokens;

  // Add older messages from most recent
  const includedOlder: { role: string; content: string }[] = [];
  for (let i = olderMessages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokenCount(olderMessages[i].content) + 4;
    if (usedTokens + msgTokens > maxTokens) break;
    includedOlder.unshift(olderMessages[i]);
    usedTokens += msgTokens;
  }

  // Build result
  const result: { role: string; content: string }[] = [];
  if (systemMessage) {
    result.push(systemMessage);
  }
  result.push(...includedOlder);
  result.push(...lastMessages);

  return result;
}

/**
 * Prompt optimization suggestions
 */
export interface PromptOptimization {
  original: string;
  optimized: string;
  tokensSaved: number;
  suggestions: string[];
}

/**
 * Optimize a prompt for token efficiency
 */
export function optimizePrompt(prompt: string): PromptOptimization {
  const originalTokens = estimateTokenCount(prompt);
  const suggestions: string[] = [];
  let optimized = prompt;

  // Remove excessive whitespace
  if (/\s{3,}/.test(optimized)) {
    optimized = optimized.replace(/\s{3,}/g, '  ');
    suggestions.push('Reduced excessive whitespace');
  }

  // Simplify repetitive phrases
  const repetitivePatterns = [
    { pattern: /please\s+/gi, replacement: '', desc: 'Removed "please"' },
    { pattern: /I want you to\s+/gi, replacement: '', desc: 'Simplified "I want you to"' },
    { pattern: /could you\s+/gi, replacement: '', desc: 'Simplified "could you"' },
    { pattern: /make sure to\s+/gi, replacement: '', desc: 'Simplified "make sure to"' },
  ];

  for (const { pattern, replacement, desc } of repetitivePatterns) {
    if (pattern.test(optimized)) {
      optimized = optimized.replace(pattern, replacement);
      suggestions.push(desc);
    }
  }

  // Remove trailing whitespace
  optimized = optimized.trim();

  const optimizedTokens = estimateTokenCount(optimized);

  return {
    original: prompt,
    optimized,
    tokensSaved: originalTokens - optimizedTokens,
    suggestions,
  };
}

/**
 * Check if content fits within model limits
 */
export function fitsModelLimit(
  content: string,
  model: keyof typeof MODEL_TOKEN_LIMITS,
  reserveForResponse: number = 8000
): boolean {
  const contentTokens = estimateTokenCount(content);
  const limit = MODEL_TOKEN_LIMITS[model] - reserveForResponse;
  return contentTokens <= limit;
}

/**
 * Get recommended model based on content size
 */
export function recommendModel(
  contentTokens: number,
  preferCheaper: boolean = true
): keyof typeof MODEL_TOKEN_LIMITS {
  // Add buffer for response
  const totalNeeded = contentTokens + 8000;

  if (preferCheaper) {
    // Prefer cheaper models when possible
    if (totalNeeded < 30000) return 'gemini-1.5-flash-8b';
    if (totalNeeded < 200000) return 'gemini-1.5-flash';
    return 'gemini-1.5-pro';
  } else {
    // Prefer capability
    if (totalNeeded < 500000) return 'gemini-1.5-flash';
    return 'gemini-1.5-pro';
  }
}
