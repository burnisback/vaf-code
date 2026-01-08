/**
 * Retry Logic
 *
 * Exponential backoff retry mechanism with jitter.
 */

import { isRetryableError, RateLimitError, TimeoutError } from './types';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryOn?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  // Exponential backoff
  const exponentialDelay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter (random variation)
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  let totalDelayMs = 0;

  for (let attempt = 1; attempt <= mergedConfig.maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = mergedConfig.retryOn
        ? mergedConfig.retryOn(error)
        : isRetryableError(error);

      // If not retryable or max retries reached, stop
      if (!shouldRetry || attempt > mergedConfig.maxRetries) {
        break;
      }

      // Calculate delay
      let delayMs = calculateDelay(attempt, mergedConfig);

      // Check for rate limit retry-after header
      if (error instanceof RateLimitError && error.retryAfter) {
        delayMs = Math.max(delayMs, error.retryAfter * 1000);
      }

      // Notify callback
      mergedConfig.onRetry?.(error, attempt, delayMs);

      // Log retry
      console.log(
        `[Retry] Attempt ${attempt}/${mergedConfig.maxRetries} failed, ` +
          `retrying in ${delayMs}ms...`
      );

      // Wait before retry
      await sleep(delayMs);
      totalDelayMs += delayMs;
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: mergedConfig.maxRetries + 1,
    totalDelayMs,
  };
}

/**
 * Retry decorator for class methods
 */
export function Retryable(config: Partial<RetryConfig> = {}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const result = await withRetry(
        () => originalMethod.apply(this, args),
        config
      );

      if (!result.success) {
        throw result.error;
      }

      return result.result;
    };

    return descriptor;
  };
}

/**
 * Create a retryable version of a function
 */
export function makeRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): (...args: Parameters<T>) => Promise<RetryResult<Awaited<ReturnType<T>>>> {
  return async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args) as Promise<Awaited<ReturnType<T>>>, config);
  };
}

/**
 * Retry with timeout
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(timeoutMs, 'withRetryAndTimeout')), timeoutMs);
  });

  try {
    const result = await Promise.race([
      withRetry(fn, config),
      timeoutPromise,
    ]);
    return result;
  } catch (error) {
    return {
      success: false,
      error,
      attempts: 0,
      totalDelayMs: 0,
    };
  }
}

/**
 * Retry specific error types
 */
export function retryOnErrorTypes(errorTypes: (new (...args: unknown[]) => Error)[]) {
  return (error: unknown): boolean => {
    return errorTypes.some((ErrorType) => error instanceof ErrorType);
  };
}

/**
 * Create retry config for API calls
 */
export function apiRetryConfig(overrides: Partial<RetryConfig> = {}): RetryConfig {
  return {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    ...overrides,
  };
}

/**
 * Create retry config for AI generation
 */
export function aiGenerationRetryConfig(overrides: Partial<RetryConfig> = {}): RetryConfig {
  return {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 2,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 3,
    ...overrides,
  };
}
