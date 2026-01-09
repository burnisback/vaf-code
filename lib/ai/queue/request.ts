/**
 * Request Queue
 *
 * Manages API request queuing with rate limiting and concurrency control.
 */

/**
 * Queue item
 */
interface QueueItem<T> {
  id: string;
  priority: number;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  addedAt: number;
  startedAt?: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  maxConcurrent: number;
  maxQueueSize: number;
  requestsPerMinute: number;
  requestsPerSecond: number;
  timeout: number;
  onQueueFull?: () => void;
  onRateLimited?: () => void;
}

/**
 * Default queue configuration
 */
const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 5,
  maxQueueSize: 100,
  requestsPerMinute: 60,
  requestsPerSecond: 10,
  timeout: 60000,
};

/**
 * Queue statistics
 */
export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  rateLimited: number;
  avgWaitTime: number;
  avgExecutionTime: number;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Request Queue class
 */
export class RequestQueue {
  private queue: QueueItem<unknown>[] = [];
  private running: Map<string, QueueItem<unknown>> = new Map();
  private config: QueueConfig;
  private requestTimestamps: number[] = [];
  private stats = {
    completed: 0,
    failed: 0,
    rateLimited: 0,
    totalWaitTime: 0,
    totalExecutionTime: 0,
  };
  private processing = false;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a request to the queue
   */
  enqueue<T>(
    execute: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Check queue size
      if (this.queue.length >= this.config.maxQueueSize) {
        this.config.onQueueFull?.();
        reject(new Error('Queue is full'));
        return;
      }

      const item: QueueItem<T> = {
        id: generateId(),
        priority,
        execute,
        resolve: resolve as (value: unknown) => void,
        reject,
        addedAt: Date.now(),
      };

      // Insert by priority (higher priority first)
      const insertIndex = this.queue.findIndex((i) => i.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(item as QueueItem<unknown>);
      } else {
        this.queue.splice(insertIndex, 0, item as QueueItem<unknown>);
      }

      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.canStartRequest()) {
      const item = this.queue.shift();
      if (!item) break;

      // Check rate limit
      if (!this.checkRateLimit()) {
        // Put item back and wait
        this.queue.unshift(item);
        this.stats.rateLimited++;
        this.config.onRateLimited?.();

        // Wait before trying again
        await this.waitForRateLimit();
        continue;
      }

      // Start execution
      this.executeItem(item);
    }

    this.processing = false;
  }

  /**
   * Execute a queue item
   */
  private async executeItem(item: QueueItem<unknown>): Promise<void> {
    item.startedAt = Date.now();
    this.running.set(item.id, item);
    this.recordRequest();

    const waitTime = item.startedAt - item.addedAt;
    this.stats.totalWaitTime += waitTime;

    try {
      // Execute with timeout
      const result = await this.withTimeout(item.execute(), this.config.timeout);

      const executionTime = Date.now() - item.startedAt;
      this.stats.totalExecutionTime += executionTime;
      this.stats.completed++;

      item.resolve(result);
    } catch (error) {
      this.stats.failed++;
      item.reject(error);
    } finally {
      this.running.delete(item.id);
      // Continue processing queue
      this.processQueue();
    }
  }

  /**
   * Check if we can start a new request
   */
  private canStartRequest(): boolean {
    return this.running.size < this.config.maxConcurrent;
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < 60000
    );

    // Check per-minute limit
    if (this.requestTimestamps.length >= this.config.requestsPerMinute) {
      return false;
    }

    // Check per-second limit
    const recentSecond = this.requestTimestamps.filter(
      (ts) => now - ts < 1000
    );
    if (recentSecond.length >= this.config.requestsPerSecond) {
      return false;
    }

    return true;
  }

  /**
   * Record a request timestamp
   */
  private recordRequest(): void {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Wait for rate limit to clear
   */
  private async waitForRateLimit(): Promise<void> {
    // Wait until we can make another request
    const now = Date.now();
    const oldestInSecond = this.requestTimestamps.find(
      (ts) => now - ts < 1000
    );

    if (oldestInSecond) {
      const waitTime = 1000 - (now - oldestInSecond) + 10;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Execute with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const totalCompleted = this.stats.completed + this.stats.failed;
    return {
      queued: this.queue.length,
      running: this.running.size,
      completed: this.stats.completed,
      failed: this.stats.failed,
      rateLimited: this.stats.rateLimited,
      avgWaitTime:
        totalCompleted > 0 ? this.stats.totalWaitTime / totalCompleted : 0,
      avgExecutionTime:
        totalCompleted > 0 ? this.stats.totalExecutionTime / totalCompleted : 0,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    // Reject all queued items
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  /**
   * Get queue size
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Get running count
   */
  get runningCount(): number {
    return this.running.size;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.length === 0 && this.running.size === 0;
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.processing = false;
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.processQueue();
  }
}

/**
 * Priority levels
 */
export const Priority = {
  LOW: 0,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 20,
} as const;

// Singleton instance for AI requests
export const aiRequestQueue = new RequestQueue({
  maxConcurrent: 3,
  requestsPerMinute: 30,
  requestsPerSecond: 5,
});

/**
 * Enqueue an AI request
 */
export function enqueueAIRequest<T>(
  execute: () => Promise<T>,
  priority: number = Priority.NORMAL
): Promise<T> {
  return aiRequestQueue.enqueue(execute, priority);
}
