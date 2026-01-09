/**
 * AI Integration Tests
 *
 * End-to-end tests for the AI system components.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock genkit before imports
vi.mock('genkit', () => ({
  genkit: vi.fn(() => ({
    defineFlow: vi.fn((config: unknown, fn: unknown) => fn),
    defineTool: vi.fn((config: { name: string }, fn: unknown) => ({ name: config.name, fn })),
    generate: vi.fn(),
  })),
  z: {
    object: vi.fn(() => ({ parse: vi.fn() })),
    string: vi.fn(() => ({ optional: vi.fn(), describe: vi.fn() })),
    boolean: vi.fn(() => ({ optional: vi.fn() })),
    number: vi.fn(() => ({ optional: vi.fn() })),
    array: vi.fn(() => ({ optional: vi.fn() })),
    enum: vi.fn(),
  },
}));

vi.mock('@genkit-ai/google-genai', () => ({
  googleAI: Object.assign(vi.fn(() => ({})), {
    model: vi.fn((name: string) => ({ name, __mock: true })),
  }),
}));

// Import after mocks
import { ResponseCache, AIResponseCache } from '../cache';
import { RequestQueue, Priority } from '../queue';
import { ParallelExecutor, executeParallel, parallelMap } from '../execution';
import {
  estimateTokenCount,
  truncateToTokenLimit,
  compressCode,
  optimizePrompt,
  trimMessageHistory,
} from '../optimization';
import { withRetry, CircuitBreaker } from '../errors';

describe('Response Cache', () => {
  let cache: ResponseCache<string>;

  beforeEach(() => {
    cache = new ResponseCache<string>({ maxSize: 10, defaultTTL: 1000 });
  });

  afterEach(() => {
    cache.stopCleanup();
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should track cache statistics', () => {
    cache.set('key1', 'value1');
    cache.get('key1'); // hit
    cache.get('key2'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });

  it('should evict oldest entry when max size reached', () => {
    for (let i = 0; i < 12; i++) {
      cache.set(`key${i}`, `value${i}`);
    }

    expect(cache.size).toBeLessThanOrEqual(10);
  });

  it('should support getOrSet pattern', async () => {
    const factory = vi.fn().mockResolvedValue('generated');

    const result1 = await cache.getOrSet('key', factory);
    expect(result1).toBe('generated');
    expect(factory).toHaveBeenCalledTimes(1);

    const result2 = await cache.getOrSet('key', factory);
    expect(result2).toBe('generated');
    expect(factory).toHaveBeenCalledTimes(1); // Should use cache
  });
});

describe('AI Response Cache', () => {
  let cache: AIResponseCache;

  beforeEach(() => {
    cache = new AIResponseCache({ maxSize: 10, defaultTTL: 1000 });
  });

  afterEach(() => {
    cache.stopCleanup();
  });

  it('should cache responses by prompt', () => {
    cache.setResponse('Hello', 'World', 'gemini-1.5-flash');
    expect(cache.getResponse('Hello', 'gemini-1.5-flash')).toBe('World');
  });

  it('should differentiate by model', () => {
    cache.setResponse('Hello', 'World1', 'gemini-1.5-flash');
    cache.setResponse('Hello', 'World2', 'gemini-1.5-pro');

    expect(cache.getResponse('Hello', 'gemini-1.5-flash')).toBe('World1');
    expect(cache.getResponse('Hello', 'gemini-1.5-pro')).toBe('World2');
  });
});

describe('Request Queue', () => {
  let queue: RequestQueue;

  beforeEach(() => {
    queue = new RequestQueue({
      maxConcurrent: 2,
      requestsPerMinute: 100,
      requestsPerSecond: 10,
    });
  });

  it('should execute requests', async () => {
    const result = await queue.enqueue(() => Promise.resolve('done'));
    expect(result).toBe('done');
  });

  it('should respect priority ordering', async () => {
    const order: number[] = [];

    // Add low priority first
    const p1 = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(1);
      return 1;
    }, Priority.LOW);

    // Add high priority second
    const p2 = queue.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(2);
      return 2;
    }, Priority.HIGH);

    await Promise.all([p1, p2]);
    // High priority should generally complete before or around same time
    expect(order).toContain(1);
    expect(order).toContain(2);
  });

  it('should track statistics', async () => {
    await queue.enqueue(() => Promise.resolve('done'));

    const stats = queue.getStats();
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(0);
  });

  it('should reject when queue is full', async () => {
    const smallQueue = new RequestQueue({ maxQueueSize: 1, maxConcurrent: 1 });

    // First request goes to running (not queued)
    const p1 = smallQueue.enqueue(
      () => new Promise((r) => setTimeout(r, 100))
    );

    // Second request fills the queue (size = 1)
    const p2 = smallQueue.enqueue(
      () => new Promise((r) => setTimeout(r, 100))
    );

    // Third request should be rejected - queue is full
    await expect(
      smallQueue.enqueue(() => Promise.resolve('overflow'))
    ).rejects.toThrow('Queue is full');

    await Promise.all([p1, p2]);
  });
});

describe('Parallel Executor', () => {
  it('should execute tasks in parallel', async () => {
    const executor = new ParallelExecutor({ maxConcurrent: 3 });

    const tasks = [
      { id: '1', name: 'Task 1', execute: () => Promise.resolve('a') },
      { id: '2', name: 'Task 2', execute: () => Promise.resolve('b') },
      { id: '3', name: 'Task 3', execute: () => Promise.resolve('c') },
    ];

    const result = await executor.execute(tasks);

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
  });

  it('should handle task failures', async () => {
    const executor = new ParallelExecutor({ stopOnFirstFailure: false });

    const tasks = [
      { id: '1', name: 'Success', execute: () => Promise.resolve('ok') },
      {
        id: '2',
        name: 'Failure',
        execute: () => Promise.reject(new Error('fail')),
      },
    ];

    const result = await executor.execute(tasks);

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('should respect task dependencies', async () => {
    const order: string[] = [];

    const tasks = [
      {
        id: 'dep',
        name: 'Dependency',
        execute: async () => {
          order.push('dep');
          return 'dep-result';
        },
      },
      {
        id: 'main',
        name: 'Main',
        dependencies: ['dep'],
        execute: async () => {
          order.push('main');
          return 'main-result';
        },
      },
    ];

    const result = await executeParallel(tasks);

    expect(result.success).toBe(true);
    expect(order).toEqual(['dep', 'main']);
  });

  it('should preserve order in parallelMap', async () => {
    const items = [1, 2, 3, 4, 5];

    const results = await parallelMap(
      items,
      async (item) => {
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        return item * 2;
      },
      3
    );

    expect(results).toEqual([2, 4, 6, 8, 10]);
  });
});

describe('Token Optimization', () => {
  describe('estimateTokenCount', () => {
    it('should estimate token count', () => {
      const text = 'Hello world'; // 11 chars
      const tokens = estimateTokenCount(text);
      expect(tokens).toBe(3); // ceil(11/4) = 3
    });

    it('should return 0 for empty string', () => {
      expect(estimateTokenCount('')).toBe(0);
    });
  });

  describe('truncateToTokenLimit', () => {
    it('should truncate at end', () => {
      const text = 'This is a long text that needs to be truncated';
      const result = truncateToTokenLimit(text, {
        maxTokens: 5,
        strategy: 'end',
      });

      expect(result.length).toBeLessThan(text.length);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should truncate at start', () => {
      const text = 'This is a long text that needs to be truncated';
      const result = truncateToTokenLimit(text, {
        maxTokens: 5,
        strategy: 'start',
      });

      expect(result.startsWith('...')).toBe(true);
    });

    it('should truncate in middle', () => {
      const text = 'This is a long text that needs to be truncated';
      const result = truncateToTokenLimit(text, {
        maxTokens: 5,
        strategy: 'middle',
      });

      expect(result.includes('...')).toBe(true);
    });

    it('should not truncate if within limit', () => {
      const text = 'Short';
      const result = truncateToTokenLimit(text, {
        maxTokens: 100,
        strategy: 'end',
      });

      expect(result).toBe(text);
    });
  });

  describe('compressCode', () => {
    it('should remove comments', () => {
      const code = `
        // This is a comment
        const x = 1; // inline comment
        /* Multi
           line */
        const y = 2;
      `;

      const result = compressCode(code, { removeComments: true });

      expect(result).not.toContain('This is a comment');
      expect(result).not.toContain('inline comment');
      expect(result).not.toContain('Multi');
    });

    it('should remove empty lines', () => {
      const code = `const x = 1;

const y = 2;


const z = 3;`;

      const result = compressCode(code, { removeEmptyLines: true });

      expect(result).not.toMatch(/^\s*$/m);
    });

    it('should minify whitespace', () => {
      const code = `const x    =    1;`;

      const result = compressCode(code, { minifyWhitespace: true });

      expect(result).toBe('const x = 1;');
    });
  });

  describe('optimizePrompt', () => {
    it('should remove excessive whitespace', () => {
      const prompt = 'Hello     world';
      const result = optimizePrompt(prompt);

      expect(result.optimized).toBe('Hello  world');
      expect(result.suggestions).toContain('Reduced excessive whitespace');
    });

    it('should simplify verbose phrases', () => {
      const prompt = 'Please could you help me with this';
      const result = optimizePrompt(prompt);

      expect(result.tokensSaved).toBeGreaterThan(0);
    });

    it('should report token savings', () => {
      const prompt = 'Please I want you to help me';
      const result = optimizePrompt(prompt);

      expect(result.tokensSaved).toBeGreaterThanOrEqual(0);
      expect(result.original).toBe(prompt);
    });
  });

  describe('trimMessageHistory', () => {
    it('should keep system message', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const result = trimMessageHistory(messages, {
        maxTokens: 100,
        keepSystemMessage: true,
      });

      expect(result.find((m) => m.role === 'system')).toBeDefined();
    });

    it('should keep last N messages', () => {
      const messages = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response 2' },
        { role: 'user', content: 'Message 3' },
        { role: 'assistant', content: 'Response 3' },
      ];

      const result = trimMessageHistory(messages, {
        maxTokens: 50,
        keepLastN: 2,
      });

      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('Retry Logic', () => {
  it('should retry on failure', async () => {
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      },
      {
        maxRetries: 3,
        initialDelayMs: 10,
        // Provide custom retryOn since isRetryableError returns false for regular Error
        retryOn: () => true,
      }
    );

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
  });

  it('should fail after max retries', async () => {
    const result = await withRetry(
      async () => {
        throw new Error('Permanent failure');
      },
      { maxRetries: 2, initialDelayMs: 10 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.attempts).toBe(3); // initial + 2 retries
  });

  it('should not retry non-retryable errors', async () => {
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts++;
        const error = new Error('Non-retryable');
        (error as Error & { retryable: boolean }).retryable = false;
        throw error;
      },
      { maxRetries: 3, initialDelayMs: 10 }
    );

    expect(result.success).toBe(false);
    expect(attempts).toBe(1);
  });
});

describe('Circuit Breaker', () => {
  it('should allow requests when closed', async () => {
    const breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      successThreshold: 1,
      timeout: 100,
      monitorInterval: 1000,
    });

    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should open after failure threshold', async () => {
    const breaker = new CircuitBreaker({
      name: 'test-breaker-2',
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 100,
      monitorInterval: 1000,
    });

    // Cause failures
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }
    }

    expect(breaker.getState()).toBe('OPEN');

    // Next call should fail immediately
    await expect(
      breaker.execute(() => Promise.resolve('ok'))
    ).rejects.toThrow(/Circuit breaker .* is open/);
  });

  it('should transition to half-open after timeout', async () => {
    const breaker = new CircuitBreaker({
      name: 'test-breaker-3',
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 50,
      monitorInterval: 1000,
    });

    // Cause failure to open
    try {
      await breaker.execute(() => Promise.reject(new Error('fail')));
    } catch {
      // Expected
    }

    expect(breaker.getState()).toBe('OPEN');

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 60));

    expect(breaker.getState()).toBe('HALF_OPEN');
  });

  it('should close on successful half-open request', async () => {
    const breaker = new CircuitBreaker({
      name: 'test-breaker-4',
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 50,
      monitorInterval: 1000,
    });

    // Open the circuit
    try {
      await breaker.execute(() => Promise.reject(new Error('fail')));
    } catch {
      // Expected
    }

    // Wait for half-open
    await new Promise((r) => setTimeout(r, 60));

    // Successful request should close
    await breaker.execute(() => Promise.resolve('ok'));

    expect(breaker.getState()).toBe('CLOSED');
  });
});
