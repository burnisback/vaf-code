/**
 * Error Handler
 *
 * Central error handling with classification, logging, and recovery.
 */

import {
  AIError,
  TokenLimitError,
  RateLimitError,
  GenerationError,
  ValidationError,
  ToolExecutionError,
  AgentExecutionError,
  NetworkError,
  TimeoutError,
  CircuitBreakerOpenError,
  toAIError,
  isRetryableError,
  ErrorCodes,
  type ErrorCode,
} from './types';
import { withRetry, type RetryConfig } from './retry';
import { CircuitBreaker, circuitBreakerRegistry } from './circuitBreaker';

/**
 * Error classification
 */
export type ErrorClassification =
  | 'transient'
  | 'client'
  | 'server'
  | 'configuration'
  | 'unknown';

/**
 * Error handling strategy
 */
export type ErrorStrategy = 'retry' | 'fallback' | 'propagate' | 'ignore';

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableMetrics: boolean;
  defaultStrategy: ErrorStrategy;
  retryConfig?: Partial<RetryConfig>;
  fallbackValue?: unknown;
  onError?: (error: AIError, context?: Record<string, unknown>) => void;
}

/**
 * Default error handler configuration
 */
const DEFAULT_CONFIG: ErrorHandlerConfig = {
  enableLogging: true,
  enableMetrics: true,
  defaultStrategy: 'propagate',
};

/**
 * Error metrics
 */
interface ErrorMetrics {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsByClassification: Record<ErrorClassification, number>;
  lastError?: AIError;
  lastErrorTime?: Date;
}

/**
 * Error Handler class
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private metrics: ErrorMetrics;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      totalErrors: 0,
      errorsByCode: {},
      errorsByClassification: {
        transient: 0,
        client: 0,
        server: 0,
        configuration: 0,
        unknown: 0,
      },
    };
  }

  /**
   * Handle an error
   */
  handle(
    error: unknown,
    context?: Record<string, unknown>
  ): AIError {
    const aiError = toAIError(error);

    // Update metrics
    this.recordError(aiError);

    // Log error
    if (this.config.enableLogging) {
      this.logError(aiError, context);
    }

    // Call custom handler
    this.config.onError?.(aiError, context);

    return aiError;
  }

  /**
   * Handle error with strategy
   */
  async handleWithStrategy<T>(
    error: unknown,
    strategy?: ErrorStrategy,
    options?: {
      fallback?: () => T | Promise<T>;
      context?: Record<string, unknown>;
    }
  ): Promise<T | undefined> {
    const aiError = this.handle(error, options?.context);
    const effectiveStrategy = strategy ?? this.getRecommendedStrategy(aiError);

    switch (effectiveStrategy) {
      case 'ignore':
        return undefined;

      case 'fallback':
        if (options?.fallback) {
          return options.fallback();
        }
        return this.config.fallbackValue as T;

      case 'retry':
        // Retry is handled at call site
        throw aiError;

      case 'propagate':
      default:
        throw aiError;
    }
  }

  /**
   * Wrap a function with error handling
   */
  wrap<T>(
    fn: () => Promise<T>,
    options?: {
      strategy?: ErrorStrategy;
      fallback?: () => T | Promise<T>;
      context?: Record<string, unknown>;
      circuitBreaker?: string;
    }
  ): Promise<T> {
    return this.execute(fn, options);
  }

  /**
   * Execute with full error handling (retry + circuit breaker)
   */
  async execute<T>(
    fn: () => Promise<T>,
    options?: {
      strategy?: ErrorStrategy;
      fallback?: () => T | Promise<T>;
      context?: Record<string, unknown>;
      circuitBreaker?: string;
      retry?: Partial<RetryConfig>;
    }
  ): Promise<T> {
    // Get circuit breaker if specified
    const breaker = options?.circuitBreaker
      ? circuitBreakerRegistry.getOrCreate(options.circuitBreaker)
      : undefined;

    // Build execution function with circuit breaker
    const executeFn = breaker
      ? () => breaker.execute(fn)
      : fn;

    // Execute with retry if needed
    const strategy = options?.strategy ?? this.config.defaultStrategy;

    if (strategy === 'retry') {
      const retryConfig = {
        ...this.config.retryConfig,
        ...options?.retry,
        onRetry: (error: unknown, attempt: number) => {
          this.handle(error, {
            ...options?.context,
            retryAttempt: attempt,
          });
        },
      };

      const result = await withRetry(executeFn, retryConfig);

      if (result.success) {
        return result.result as T;
      }

      // Handle final failure
      return this.handleWithStrategy<T>(result.error, 'propagate', options) as Promise<T>;
    }

    // Execute without retry
    try {
      return await executeFn();
    } catch (error) {
      const handledResult = await this.handleWithStrategy<T>(error, strategy, options);
      if (handledResult !== undefined) {
        return handledResult;
      }
      throw error;
    }
  }

  /**
   * Classify an error
   */
  classify(error: AIError): ErrorClassification {
    switch (error.code) {
      case ErrorCodes.RATE_LIMIT_EXCEEDED:
      case ErrorCodes.NETWORK_ERROR:
      case ErrorCodes.TIMEOUT:
        return 'transient';

      case ErrorCodes.VALIDATION_FAILED:
      case ErrorCodes.TOKEN_LIMIT_EXCEEDED:
        return 'client';

      case ErrorCodes.GENERATION_FAILED:
      case ErrorCodes.TOOL_EXECUTION_FAILED:
      case ErrorCodes.AGENT_EXECUTION_FAILED:
        return 'server';

      case ErrorCodes.CONFIGURATION_ERROR:
        return 'configuration';

      default:
        return 'unknown';
    }
  }

  /**
   * Get recommended strategy for an error
   */
  getRecommendedStrategy(error: AIError): ErrorStrategy {
    const classification = this.classify(error);

    switch (classification) {
      case 'transient':
        return 'retry';
      case 'client':
        return 'propagate';
      case 'server':
        return error.retryable ? 'retry' : 'propagate';
      case 'configuration':
        return 'propagate';
      default:
        return 'propagate';
    }
  }

  /**
   * Record error metrics
   */
  private recordError(error: AIError): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalErrors++;
    this.metrics.errorsByCode[error.code] =
      (this.metrics.errorsByCode[error.code] ?? 0) + 1;

    const classification = this.classify(error);
    this.metrics.errorsByClassification[classification]++;

    this.metrics.lastError = error;
    this.metrics.lastErrorTime = new Date();
  }

  /**
   * Log error
   */
  private logError(error: AIError, context?: Record<string, unknown>): void {
    const classification = this.classify(error);
    const logLevel = classification === 'transient' ? 'warn' : 'error';

    const logData = {
      code: error.code,
      message: error.message,
      classification,
      retryable: error.retryable,
      context: { ...error.context, ...context },
    };

    if (logLevel === 'warn') {
      console.warn(`[ErrorHandler] ${error.name}:`, logData);
    } else {
      console.error(`[ErrorHandler] ${error.name}:`, logData);
    }
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByCode: {},
      errorsByClassification: {
        transient: 0,
        client: 0,
        server: 0,
        configuration: 0,
        unknown: 0,
      },
    };
  }

  /**
   * Create error report
   */
  createReport(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    lines.push('Error Report');
    lines.push('============');
    lines.push(`Total Errors: ${metrics.totalErrors}`);
    lines.push('');
    lines.push('By Classification:');
    Object.entries(metrics.errorsByClassification).forEach(([key, value]) => {
      if (value > 0) {
        lines.push(`  ${key}: ${value}`);
      }
    });
    lines.push('');
    lines.push('By Code:');
    Object.entries(metrics.errorsByCode).forEach(([key, value]) => {
      lines.push(`  ${key}: ${value}`);
    });

    if (metrics.lastError) {
      lines.push('');
      lines.push(`Last Error: ${metrics.lastError.message}`);
      lines.push(`  Code: ${metrics.lastError.code}`);
      lines.push(`  Time: ${metrics.lastErrorTime?.toISOString()}`);
    }

    return lines.join('\n');
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Quick error handling helper
 */
export function handleError(
  error: unknown,
  context?: Record<string, unknown>
): AIError {
  return errorHandler.handle(error, context);
}

/**
 * Safe execution wrapper
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    errorHandler.handle(error);
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}
