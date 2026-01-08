/**
 * Genkit Mock Provider
 *
 * Mock implementation for testing AI functionality without API calls.
 */

import { vi } from 'vitest';

/**
 * Mock tool call
 */
export interface MockToolCall {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Mock generation response
 */
export interface MockGenerationResponse {
  text: string;
  toolCalls?: MockToolCall[];
}

/**
 * Mock configuration
 */
export interface MockConfig {
  responses?: Map<string, MockGenerationResponse>;
  defaultResponse?: MockGenerationResponse;
  shouldFail?: boolean;
  failureError?: Error;
  latency?: number;
}

/**
 * Global mock state
 */
let mockConfig: MockConfig = {
  defaultResponse: {
    text: 'Mock AI response',
  },
};

/**
 * Configure mock behavior
 */
export function configureMock(config: Partial<MockConfig>): void {
  mockConfig = { ...mockConfig, ...config };
}

/**
 * Reset mock to defaults
 */
export function resetMock(): void {
  mockConfig = {
    defaultResponse: {
      text: 'Mock AI response',
    },
  };
}

/**
 * Add a canned response for a specific prompt pattern
 */
export function addMockResponse(
  promptPattern: string,
  response: MockGenerationResponse
): void {
  if (!mockConfig.responses) {
    mockConfig.responses = new Map();
  }
  mockConfig.responses.set(promptPattern, response);
}

/**
 * Mock generate function
 */
export const mockGenerate = vi.fn(
  async (options: {
    model: unknown;
    prompt: string;
    tools?: unknown[];
    config?: unknown;
  }): Promise<{
    text: string;
    toolRequests?: Array<{ name: string; input: unknown }>;
  }> => {
    // Simulate latency
    if (mockConfig.latency) {
      await new Promise((resolve) => setTimeout(resolve, mockConfig.latency));
    }

    // Check for configured failure
    if (mockConfig.shouldFail) {
      throw mockConfig.failureError || new Error('Mock AI failure');
    }

    // Check for specific response
    if (mockConfig.responses) {
      for (const [pattern, response] of mockConfig.responses) {
        if (options.prompt.includes(pattern)) {
          return {
            text: response.text,
            toolRequests: response.toolCalls?.map((tc) => ({
              name: tc.name,
              input: tc.input,
            })),
          };
        }
      }
    }

    // Return default response
    return {
      text: mockConfig.defaultResponse?.text || 'Mock response',
      toolRequests: mockConfig.defaultResponse?.toolCalls?.map((tc) => ({
        name: tc.name,
        input: tc.input,
      })),
    };
  }
);

/**
 * Mock streaming generate function
 */
export const mockGenerateStream = vi.fn(
  async function* (options: {
    model: unknown;
    prompt: string;
    tools?: unknown[];
  }): AsyncGenerator<{ text: string }> {
    // Simulate latency
    if (mockConfig.latency) {
      await new Promise((resolve) => setTimeout(resolve, mockConfig.latency));
    }

    // Check for configured failure
    if (mockConfig.shouldFail) {
      throw mockConfig.failureError || new Error('Mock AI failure');
    }

    // Get response text
    let responseText = mockConfig.defaultResponse?.text || 'Mock response';

    if (mockConfig.responses) {
      for (const [pattern, response] of mockConfig.responses) {
        if (options.prompt.includes(pattern)) {
          responseText = response.text;
          break;
        }
      }
    }

    // Stream word by word
    const words = responseText.split(' ');
    for (const word of words) {
      yield { text: word + ' ' };
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
);

/**
 * Mock defineFlow function
 */
export const mockDefineFlow = vi.fn(
  <I, O>(
    config: { name: string; inputSchema?: unknown; outputSchema?: unknown },
    fn: (input: I) => Promise<O>
  ) => {
    return async (input: I): Promise<O> => {
      return fn(input);
    };
  }
);

/**
 * Mock defineTool function
 */
export const mockDefineTool = vi.fn(
  <I, O>(
    config: {
      name: string;
      description: string;
      inputSchema: unknown;
      outputSchema: unknown;
    },
    fn: (input: I) => Promise<O>
  ) => {
    return {
      name: config.name,
      description: config.description,
      execute: fn,
    };
  }
);

/**
 * Mock Zod-like schema builders
 */
export const mockZ = {
  object: vi.fn((schema: Record<string, unknown>) => ({
    _type: 'object',
    schema,
    parse: vi.fn((data: unknown) => data),
    safeParse: vi.fn((data: unknown) => ({ success: true, data })),
    optional: vi.fn(() => mockZ.object(schema)),
    describe: vi.fn(() => mockZ.object(schema)),
  })),
  string: vi.fn(() => ({
    _type: 'string',
    parse: vi.fn((data: unknown) => data),
    optional: vi.fn(() => mockZ.string()),
    describe: vi.fn(() => mockZ.string()),
  })),
  number: vi.fn(() => ({
    _type: 'number',
    parse: vi.fn((data: unknown) => data),
    optional: vi.fn(() => mockZ.number()),
    describe: vi.fn(() => mockZ.number()),
  })),
  boolean: vi.fn(() => ({
    _type: 'boolean',
    parse: vi.fn((data: unknown) => data),
    optional: vi.fn(() => mockZ.boolean()),
    describe: vi.fn(() => mockZ.boolean()),
  })),
  array: vi.fn((itemSchema: unknown) => ({
    _type: 'array',
    itemSchema,
    parse: vi.fn((data: unknown) => data),
    optional: vi.fn(() => mockZ.array(itemSchema)),
    describe: vi.fn(() => mockZ.array(itemSchema)),
  })),
  enum: vi.fn((values: string[]) => ({
    _type: 'enum',
    values,
    parse: vi.fn((data: unknown) => data),
    optional: vi.fn(() => mockZ.enum(values)),
    describe: vi.fn(() => mockZ.enum(values)),
  })),
  union: vi.fn((schemas: unknown[]) => ({
    _type: 'union',
    schemas,
    parse: vi.fn((data: unknown) => data),
  })),
  literal: vi.fn((value: unknown) => ({
    _type: 'literal',
    value,
    parse: vi.fn(() => value),
  })),
};

/**
 * Mock genkit instance
 */
export const mockGenkit = vi.fn(() => ({
  generate: mockGenerate,
  generateStream: mockGenerateStream,
  defineFlow: mockDefineFlow,
  defineTool: mockDefineTool,
}));

/**
 * Default export for module replacement
 */
export default {
  genkit: mockGenkit,
  z: mockZ,
};

/**
 * Export for named imports
 */
export const genkit = mockGenkit;
export const z = mockZ;
