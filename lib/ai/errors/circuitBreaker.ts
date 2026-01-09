/**
 * Circuit Breaker
 *
 * Prevents cascade failures by temporarily disabling failing operations.
 */

import { CircuitBreakerOpenError } from './types';

/**
 * Circuit breaker states
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // Time in ms before attempting to close
  monitorInterval: number; // Time window for failure counting
  onStateChange?: (state: CircuitState, previousState: CircuitState) => void;
  onFailure?: (error: unknown) => void;
  onSuccess?: () => void;
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  monitorInterval: 60000,
};

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  openedAt?: Date;
  totalRequests: number;
  failedRequests: number;
  successfulRequests: number;
}

/**
 * Circuit Breaker class
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private openedAt?: Date;
  private totalRequests: number = 0;
  private failedRequests: number = 0;
  private successfulRequests: number = 0;
  private resetTimeout?: ReturnType<typeof setTimeout>;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      throw new CircuitBreakerOpenError(this.config.name, this.getResetTime());
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successfulRequests++;
    this.lastSuccessTime = new Date();
    this.config.onSuccess?.();

    if (this.state === 'HALF_OPEN') {
      this.successes++;

      if (this.successes >= this.config.successThreshold) {
        this.close();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    this.failedRequests++;
    this.lastFailureTime = new Date();
    this.config.onFailure?.(error);

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open state opens the circuit
      this.open();
    } else if (this.state === 'CLOSED') {
      this.failures++;

      // Check if we've exceeded the failure threshold
      if (this.failures >= this.config.failureThreshold) {
        this.open();
      }
    }
  }

  /**
   * Open the circuit
   */
  private open(): void {
    const previousState = this.state;
    this.state = 'OPEN';
    this.openedAt = new Date();
    this.successes = 0;

    console.log(
      `[CircuitBreaker] ${this.config.name}: OPEN (${this.failures} failures)`
    );

    this.config.onStateChange?.('OPEN', previousState);

    // Schedule transition to half-open
    this.scheduleReset();
  }

  /**
   * Close the circuit
   */
  private close(): void {
    const previousState = this.state;
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.openedAt = undefined;

    console.log(`[CircuitBreaker] ${this.config.name}: CLOSED`);

    this.config.onStateChange?.('CLOSED', previousState);

    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = undefined;
    }
  }

  /**
   * Transition to half-open state
   */
  private halfOpen(): void {
    const previousState = this.state;
    this.state = 'HALF_OPEN';
    this.successes = 0;

    console.log(`[CircuitBreaker] ${this.config.name}: HALF_OPEN`);

    this.config.onStateChange?.('HALF_OPEN', previousState);
  }

  /**
   * Schedule reset to half-open
   */
  private scheduleReset(): void {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }

    this.resetTimeout = setTimeout(() => {
      if (this.state === 'OPEN') {
        this.halfOpen();
      }
    }, this.config.timeout);
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get reset time (when circuit will transition to half-open)
   */
  getResetTime(): Date | undefined {
    if (this.state !== 'OPEN' || !this.openedAt) {
      return undefined;
    }
    return new Date(this.openedAt.getTime() + this.config.timeout);
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.config.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      successfulRequests: this.successfulRequests,
    };
  }

  /**
   * Check if circuit is available
   */
  isAvailable(): boolean {
    return this.state !== 'OPEN';
  }

  /**
   * Force reset the circuit
   */
  reset(): void {
    this.close();
    this.totalRequests = 0;
    this.failedRequests = 0;
    this.successfulRequests = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
  }

  /**
   * Force open the circuit (for testing or manual intervention)
   */
  forceOpen(): void {
    this.open();
  }

  /**
   * Get the circuit name
   */
  get name(): string {
    return this.config.name;
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  getOrCreate(
    name: string,
    config?: Partial<Omit<CircuitBreakerConfig, 'name'>>
  ): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker({ name, ...config });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  /**
   * Get a circuit breaker by name
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Get all circuit breakers
   */
  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Get all stats
   */
  getAllStats(): CircuitBreakerStats[] {
    return this.getAll().map((b) => b.getStats());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach((b) => b.reset());
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }
}

// Singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Create a circuit breaker for AI operations
 */
export function createAICircuitBreaker(
  name: string,
  overrides?: Partial<Omit<CircuitBreakerConfig, 'name'>>
): CircuitBreaker {
  return circuitBreakerRegistry.getOrCreate(name, {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000,
    ...overrides,
  });
}

/**
 * Decorator to wrap a method with circuit breaker
 */
export function WithCircuitBreaker(breakerName: string) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const breaker = circuitBreakerRegistry.getOrCreate(breakerName);
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
