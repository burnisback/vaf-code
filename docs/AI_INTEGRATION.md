# AI Integration Documentation

> Comprehensive guide to the VAF Agentic Factory AI system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Agent System](#agent-system)
4. [Governance Pipeline](#governance-pipeline)
5. [Quality Gates](#quality-gates)
6. [Error Handling](#error-handling)
7. [Performance Optimization](#performance-optimization)
8. [API Reference](#api-reference)
9. [Configuration](#configuration)
10. [Testing](#testing)

---

## Architecture Overview

The VAF AI system is a multi-agent architecture built on Firebase AI Logic (Genkit) with Gemini models. It implements a full software development lifecycle with AI-driven governance.

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Request                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Prompt Router                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Classifier │  │  Complexity │  │    Chain Builder        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Governance Pipeline                            │
│  INTAKE → PLANNING → ARCHITECTURE → DESIGN → IMPLEMENTATION     │
│          → VERIFICATION → RELEASE → COMPLETED                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Execution                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │  vaf-pm  │  │vaf-arch  │  │vaf-front │  │  vaf-backend     ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Quality Gates                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │   Lint   │  │TypeCheck │  │  Tests   │  │    Security      ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### Genkit Configuration

```typescript
// src/lib/ai/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
});
```

### Available Models

| Model | Use Case | Context Window |
|-------|----------|----------------|
| `gemini-1.5-flash` | Fast responses, general tasks | 1M tokens |
| `gemini-1.5-flash-8b` | Quick research, simple tasks | 1M tokens |
| `gemini-1.5-pro` | Complex reasoning, architecture | 2M tokens |

---

## Agent System

### Agent Hierarchy

```
                    vaf-orchestrator (CEO)
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    PLANNING          ENGINEERING        QUALITY
         │                 │                 │
    ┌────┴────┐    ┌───────┼───────┐   ┌────┴────┐
    │         │    │       │       │   │         │
  vaf-pm  vaf-arch vaf-   vaf-   vaf-  vaf-qa  vaf-e2e
              │    front  back   ui
           vaf-ux                        vaf-security
```

### Creating an Agent

```typescript
import { ai } from '@/lib/ai/genkit';
import { gemini15Flash } from '@genkit-ai/googleai';
import { z } from 'genkit';

export const myAgentFlow = ai.defineFlow(
  {
    name: 'my-agent',
    inputSchema: z.object({
      task: z.string(),
      context: z.string().optional(),
    }),
    outputSchema: z.object({
      result: z.string(),
      artifacts: z.array(z.string()),
    }),
  },
  async (input) => {
    const response = await ai.generate({
      model: gemini15Flash,
      prompt: `You are an AI agent. Task: ${input.task}`,
    });

    return {
      result: response.text,
      artifacts: [],
    };
  }
);
```

### Agent Registry

```typescript
import { agentRegistry } from '@/lib/ai/agents/registry';

// Register an agent
agentRegistry.register('my-agent', myAgentFlow);

// Get an agent
const agent = agentRegistry.get('my-agent');

// List all agents
const agents = agentRegistry.list();
```

---

## Governance Pipeline

### Pipeline Stages

| Stage | Owner | Artifacts | Reviews | Approvals |
|-------|-------|-----------|---------|-----------|
| INTAKE | vaf-pm | requirements.md | vaf-architect | vaf-pm |
| PLANNING | vaf-pm | prd.md, architecture.md | vaf-architect, vaf-ux | vaf-pm, vaf-architect |
| ARCHITECTURE | vaf-architect | tech-spec.md | vaf-pm, vaf-security | vaf-architect |
| DESIGN | vaf-ux | design-spec.md | vaf-frontend, vaf-ui | vaf-ux |
| IMPLEMENTATION | vaf-architect | code, tests | vaf-architect, vaf-security | vaf-architect, vaf-pm |
| VERIFICATION | vaf-qa | verification-report.md | vaf-pm, vaf-ux | vaf-qa, vaf-pm |
| RELEASE | vaf-devops | release-notes.md | vaf-qa | vaf-devops, vaf-orchestrator |

### Running the Pipeline

```typescript
import { runPipeline } from '@/lib/ai/governance';

const result = await runPipeline(
  'Add user authentication',
  'Implement OAuth2 login with Google provider',
  {
    skipDesign: false,
    fastTrack: false,
  }
);
```

### Decision Objects

All reviews and approvals generate Decision Objects:

```typescript
interface DecisionObject {
  workItemId: string;
  stage: Stage;
  decisionType: 'REVIEW' | 'APPROVAL' | 'SIGNOFF' | 'ESCALATION';
  decision: 'APPROVED' | 'CHANGES_REQUIRED' | 'REJECTED' | 'APPROVED_WITH_RISKS';
  reviewerAgent: string;
  timestamp: string;
  domain: string;
  notes: string;
  requiredChanges: string[];
  artifactsReviewed: string[];
  blocksTransition: boolean;
}
```

---

## Quality Gates

### Available Gates

| Gate | Function | Description |
|------|----------|-------------|
| Lint | `runLintGate()` | ESLint code quality |
| TypeCheck | `runTypeCheckGate()` | TypeScript validation |
| Test | `runTestGate()` | Unit/integration tests |

### Running Quality Gates

```typescript
import { QualityGateRunner } from '@/lib/ai/quality';

const runner = new QualityGateRunner();
const result = await runner.runAll(
  ['src/components/Button.tsx'],
  ['src/components/__tests__/Button.test.tsx']
);

if (!result.passed) {
  console.error('Quality gates failed:', result.summary);
}
```

### Quick Quality Check

```typescript
import { runQuickQualityCheck } from '@/lib/ai/quality';

const result = await runQuickQualityCheck([
  { path: 'src/app.tsx', content: '...' }
]);
```

---

## Error Handling

### Error Types

| Error | Code | Retryable |
|-------|------|-----------|
| `TokenLimitError` | TOKEN_LIMIT | No |
| `RateLimitError` | RATE_LIMIT | Yes |
| `GenerationError` | GENERATION_FAILED | Yes |
| `ValidationError` | VALIDATION_ERROR | No |
| `TimeoutError` | TIMEOUT | Yes |
| `CircuitBreakerOpenError` | CIRCUIT_BREAKER_OPEN | No |

### Retry with Backoff

```typescript
import { withRetry } from '@/lib/ai/errors';

const result = await withRetry(
  async () => {
    return await ai.generate({ ... });
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  }
);

if (result.success) {
  console.log('Result:', result.result);
} else {
  console.error('Failed after', result.attempts, 'attempts');
}
```

### Circuit Breaker

```typescript
import { CircuitBreaker, circuitBreakerRegistry } from '@/lib/ai/errors';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenRequests: 3,
});

// Or use registry
const aiBreaker = circuitBreakerRegistry.get('ai-generation');

try {
  const result = await breaker.execute(async () => {
    return await ai.generate({ ... });
  });
} catch (error) {
  if (error.code === 'CIRCUIT_BREAKER_OPEN') {
    // Service is unavailable, use fallback
  }
}
```

### Error Handler

```typescript
import { errorHandler, safeExecute } from '@/lib/ai/errors';

// Manual handling
const aiError = errorHandler.handle(error, { operation: 'generate' });

// Safe execution with automatic handling
const result = await safeExecute(
  async () => ai.generate({ ... }),
  {
    operation: 'generate',
    useCircuitBreaker: true,
    useRetry: true,
  }
);
```

---

## Performance Optimization

### Response Caching

```typescript
import { aiResponseCache } from '@/lib/ai/cache';

// Check cache first
const cached = aiResponseCache.getResponse(prompt, model);
if (cached) {
  return cached;
}

// Generate and cache
const response = await ai.generate({ ... });
aiResponseCache.setResponse(prompt, response.text, model, 15 * 60 * 1000);
```

### Request Queuing

```typescript
import { enqueueAIRequest, Priority } from '@/lib/ai/queue';

// Queue with priority
const result = await enqueueAIRequest(
  () => ai.generate({ ... }),
  Priority.HIGH
);
```

### Parallel Execution

```typescript
import { executeParallel, parallelMap } from '@/lib/ai/execution';

// Execute multiple tasks
const result = await executeParallel([
  { id: '1', name: 'Task 1', execute: () => agentA.run() },
  { id: '2', name: 'Task 2', execute: () => agentB.run() },
  { id: '3', name: 'Task 3', execute: () => agentC.run(), dependencies: ['1'] },
]);

// Map with concurrency control
const results = await parallelMap(
  items,
  async (item) => processItem(item),
  5 // max concurrent
);
```

### Token Optimization

```typescript
import {
  estimateTokenCount,
  truncateToTokenLimit,
  compressCode,
  trimMessageHistory,
  optimizePrompt,
} from '@/lib/ai/optimization';

// Estimate tokens
const tokens = estimateTokenCount(text);

// Truncate to fit limit
const truncated = truncateToTokenLimit(text, {
  maxTokens: 1000,
  strategy: 'middle',
  preserveLines: true,
});

// Compress code
const compressed = compressCode(code, {
  removeComments: true,
  removeEmptyLines: true,
});

// Trim message history
const trimmed = trimMessageHistory(messages, {
  maxTokens: 4000,
  keepSystemMessage: true,
  keepLastN: 4,
});

// Optimize prompt
const optimized = optimizePrompt(prompt);
console.log('Saved', optimized.tokensSaved, 'tokens');
```

---

## API Reference

### Tools

| Tool | Input | Output |
|------|-------|--------|
| `fileWriteTool` | `{ path, content }` | `{ success, error? }` |
| `fileReadTool` | `{ path }` | `{ content, exists }` |
| `shellCommandTool` | `{ command }` | `{ output, exitCode }` |
| `directoryListTool` | `{ path }` | `{ entries: [{name, type}] }` |

### Agents

| Agent | Input | Output |
|-------|-------|--------|
| `pmAgentFlow` | `{ request, context }` | `{ requirements, prd }` |
| `architectAgentFlow` | `{ requirements }` | `{ techSpec, components }` |
| `frontendAgentFlow` | `{ techSpec, designSpec }` | `{ files, tests }` |
| `orchestratorAgentFlow` | `{ workItem, stage }` | `{ decision, delegations }` |

### Router

```typescript
import { routeToAgent, classifyIntent, analyzeComplexity } from '@/lib/ai/router';

// Full routing
const chain = await routeToAgent(message, context);

// Just classification
const intent = await classifyIntent(message);
// Returns: NEW_FEATURE | BUG_FIX | MODIFICATION | QUESTION | DEPLOYMENT

// Just complexity
const complexity = analyzeComplexity(message, context);
// Returns: simple | medium | complex
```

---

## Configuration

### Environment Variables

```bash
# Required
GEMINI_API_KEY=your-api-key

# Optional
AI_MAX_RETRIES=3
AI_TIMEOUT=60000
AI_CACHE_TTL=300000
```

### Runtime Configuration

```typescript
// Configure error handler
import { ErrorHandler } from '@/lib/ai/errors';

const handler = new ErrorHandler({
  maxRetries: 5,
  retryDelay: 2000,
  circuitBreakerThreshold: 10,
});

// Configure queue
import { RequestQueue } from '@/lib/ai/queue';

const queue = new RequestQueue({
  maxConcurrent: 3,
  maxQueueSize: 50,
  requestsPerMinute: 30,
  requestsPerSecond: 5,
});

// Configure cache
import { ResponseCache } from '@/lib/ai/cache';

const cache = new ResponseCache({
  maxSize: 100,
  defaultTTL: 5 * 60 * 1000,
});
```

---

## Testing

### Using Mock Providers

```typescript
import { vi } from 'vitest';
import { configureMock, addMockResponse, resetMock } from '@/lib/ai/__mocks__';

// Configure mock behavior
configureMock({
  defaultResponse: { text: 'Mock response' },
  latency: 100,
});

// Add specific responses
addMockResponse('create a button', {
  text: 'Here is a button component...',
  toolCalls: [
    { name: 'fileWrite', input: { path: 'Button.tsx', content: '...' } }
  ],
});

// Reset after tests
afterEach(() => resetMock());
```

### Mock Module Setup

```typescript
// vitest.setup.ts
vi.mock('genkit', () => import('@/lib/ai/__mocks__/genkit'));
vi.mock('@genkit-ai/googleai', () => import('@/lib/ai/__mocks__/googleai'));
```

### Integration Testing

```typescript
import { describe, it, expect } from 'vitest';
import { runPipeline } from '@/lib/ai/governance';

describe('Pipeline Integration', () => {
  it('should complete full pipeline', async () => {
    const result = await runPipeline(
      'Test feature',
      'Create a test feature',
      { fastTrack: true }
    );

    expect(result.success).toBe(true);
    expect(result.stages.length).toBe(7);
  });
});
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Rate limit errors | Too many requests | Use request queue with appropriate limits |
| Token limit exceeded | Input too large | Use token optimization functions |
| Circuit breaker open | Service degradation | Wait for reset or use fallback |
| Slow responses | Large context | Compress code, trim history |

### Debugging

```typescript
// Enable verbose logging
process.env.AI_DEBUG = 'true';

// Check circuit breaker state
import { circuitBreakerRegistry } from '@/lib/ai/errors';
console.log('State:', circuitBreakerRegistry.get('ai').getState());

// Check queue stats
import { aiRequestQueue } from '@/lib/ai/queue';
console.log('Queue:', aiRequestQueue.getStats());

// Check cache stats
import { aiResponseCache } from '@/lib/ai/cache';
console.log('Cache:', aiResponseCache.getStats());
```

---

## Best Practices

1. **Always use the governance pipeline** for production changes
2. **Cache aggressively** for repeated prompts
3. **Use appropriate models** - flash-8b for simple tasks, pro for complex
4. **Implement retry logic** for all AI calls
5. **Monitor circuit breaker state** to detect service issues
6. **Optimize tokens** before sending large contexts
7. **Run quality gates** before committing generated code
8. **Test with mocks** to avoid API costs during development
