/**
 * Optimization Module Index
 *
 * Central export for token and performance optimization.
 */

export {
  // Token estimation
  estimateTokenCount,
  estimateMessagesTokens,
  MODEL_TOKEN_LIMITS,

  // Truncation
  truncateToTokenLimit,
  type TruncateOptions,

  // Compression
  compressCode,
  compressMarkdown,
  type CompressionOptions,

  // Message history
  trimMessageHistory,
  type HistoryOptions,

  // Prompt optimization
  optimizePrompt,
  type PromptOptimization,

  // Model recommendations
  fitsModelLimit,
  recommendModel,
} from './tokens';
