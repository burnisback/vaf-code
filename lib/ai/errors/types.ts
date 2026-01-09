/**
 * Error Types
 *
 * Custom error classes for the AI system.
 */

/**
 * Base error class for AI system
 */
export class AIError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    retryable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.retryable = retryable;
    this.context = context;

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Token limit exceeded error
 */
export class TokenLimitError extends AIError {
  public readonly tokensUsed: number;
  public readonly tokenLimit: number;

  constructor(tokensUsed: number, tokenLimit: number, context?: Record<string, unknown>) {
    super(
      `Token limit exceeded: ${tokensUsed} tokens used, limit is ${tokenLimit}`,
      'TOKEN_LIMIT_EXCEEDED',
      false, // Not retryable without modification
      context
    );
    this.name = 'TokenLimitError';
    this.tokensUsed = tokensUsed;
    this.tokenLimit = tokenLimit;
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AIError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, context?: Record<string, unknown>) {
    super(
      message,
      'RATE_LIMIT_EXCEEDED',
      true, // Retryable after waiting
      context
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Generation error (model failed to generate)
 */
export class GenerationError extends AIError {
  public readonly modelId?: string;
  public readonly prompt?: string;

  constructor(
    message: string,
    modelId?: string,
    prompt?: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'GENERATION_FAILED',
      true, // Often retryable
      context
    );
    this.name = 'GenerationError';
    this.modelId = modelId;
    this.prompt = prompt?.slice(0, 200); // Truncate for logging
  }
}

/**
 * Validation error (invalid input or output)
 */
export class ValidationError extends AIError {
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[], context?: Record<string, unknown>) {
    super(
      message,
      'VALIDATION_FAILED',
      false, // Not retryable without fixing input
      context
    );
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Tool execution error
 */
export class ToolExecutionError extends AIError {
  public readonly toolName: string;
  public readonly toolInput?: unknown;

  constructor(
    message: string,
    toolName: string,
    toolInput?: unknown,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'TOOL_EXECUTION_FAILED',
      true, // May be retryable
      context
    );
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.toolInput = toolInput;
  }
}

/**
 * Agent execution error
 */
export class AgentExecutionError extends AIError {
  public readonly agentName: string;
  public readonly stage?: string;

  constructor(
    message: string,
    agentName: string,
    stage?: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'AGENT_EXECUTION_FAILED',
      true,
      context
    );
    this.name = 'AgentExecutionError';
    this.agentName = agentName;
    this.stage = stage;
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends AIError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string, context?: Record<string, unknown>) {
    super(
      message,
      'CONFIGURATION_ERROR',
      false,
      context
    );
    this.name = 'ConfigurationError';
    this.configKey = configKey;
  }
}

/**
 * Network error
 */
export class NetworkError extends AIError {
  public readonly statusCode?: number;
  public readonly url?: string;

  constructor(
    message: string,
    statusCode?: number,
    url?: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'NETWORK_ERROR',
      true, // Network errors are typically retryable
      context
    );
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.url = url;
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends AIError {
  public readonly timeoutMs: number;
  public readonly operation?: string;

  constructor(
    timeoutMs: number,
    operation?: string,
    context?: Record<string, unknown>
  ) {
    super(
      `Operation timed out after ${timeoutMs}ms${operation ? `: ${operation}` : ''}`,
      'TIMEOUT',
      true,
      context
    );
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerOpenError extends AIError {
  public readonly breakerName: string;
  public readonly resetTime?: Date;

  constructor(
    breakerName: string,
    resetTime?: Date,
    context?: Record<string, unknown>
  ) {
    super(
      `Circuit breaker '${breakerName}' is open`,
      'CIRCUIT_BREAKER_OPEN',
      false, // Not retryable until circuit closes
      context
    );
    this.name = 'CircuitBreakerOpenError';
    this.breakerName = breakerName;
    this.resetTime = resetTime;
  }
}

/**
 * Error codes enumeration
 */
export const ErrorCodes = {
  TOKEN_LIMIT_EXCEEDED: 'TOKEN_LIMIT_EXCEEDED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  AGENT_EXECUTION_FAILED: 'AGENT_EXECUTION_FAILED',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AIError) {
    return error.retryable;
  }

  // Check for common retryable HTTP status codes
  if (error instanceof Error && 'statusCode' in error) {
    const statusCode = (error as { statusCode: number }).statusCode;
    return [408, 429, 500, 502, 503, 504].includes(statusCode);
  }

  return false;
}

/**
 * Convert unknown error to AIError
 */
export function toAIError(error: unknown): AIError {
  if (error instanceof AIError) {
    return error;
  }

  if (error instanceof Error) {
    return new AIError(
      error.message,
      'UNKNOWN',
      false,
      { originalError: error.name, stack: error.stack }
    );
  }

  return new AIError(
    String(error),
    'UNKNOWN',
    false
  );
}

/**
 * Get error code from error
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof AIError) {
    return error.code as ErrorCode;
  }
  return ErrorCodes.UNKNOWN;
}
