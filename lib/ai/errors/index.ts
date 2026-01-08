/**
 * Errors Module Index
 *
 * Central export for error handling components.
 */

// Error types
export {
  AIError,
  TokenLimitError,
  RateLimitError,
  GenerationError,
  ValidationError,
  ToolExecutionError,
  AgentExecutionError,
  ConfigurationError,
  NetworkError,
  TimeoutError,
  CircuitBreakerOpenError,
  ErrorCodes,
  isRetryableError,
  toAIError,
  getErrorCode,
  type ErrorCode,
} from './types';

// Retry logic
export {
  withRetry,
  withRetryAndTimeout,
  calculateDelay,
  Retryable,
  makeRetryable,
  retryOnErrorTypes,
  apiRetryConfig,
  aiGenerationRetryConfig,
  type RetryConfig,
  type RetryResult,
} from './retry';

// Circuit breaker
export {
  CircuitBreaker,
  circuitBreakerRegistry,
  createAICircuitBreaker,
  WithCircuitBreaker,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
} from './circuitBreaker';

// Error handler
export {
  ErrorHandler,
  errorHandler,
  handleError,
  safeExecute,
  type ErrorClassification,
  type ErrorStrategy,
  type ErrorHandlerConfig,
} from './handler';
