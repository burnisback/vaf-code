# VAF Agentic Factory Strategy

> A comprehensive strategy for building an AI-powered code generation system using Firebase AI Logic (Gemini API) integrated with the VAF playground.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Platform Analysis](#platform-analysis)
3. [Proposed Architecture](#proposed-architecture)
4. [Implementation Strategy](#implementation-strategy)
5. [Firebase AI Logic Integration](#firebase-ai-logic-integration)
6. [Agent System Design](#agent-system-design)
7. [Expansion Considerations](#expansion-considerations)
8. [Technical Specifications](#technical-specifications)
9. [Risks & Mitigations](#risks--mitigations)
10. [Roadmap](#roadmap)

---

## Executive Summary

### Vision
Build a **production-ready Agentic Factory** that transforms natural language prompts into fully functional web applications, with room for expansion to other app types, scripts, and functions.

### Key Differentiators
| Feature | Bolt.new | Claude Code | VAF (Our System) |
|---------|----------|-------------|------------------|
| Runtime | WebContainer (browser) | Local terminal | WebContainer (browser) |
| AI Model | Claude API | Claude API | **Firebase AI Logic (Gemini)** |
| Governance | None | Minimal | **Full AI-only governance pipeline** |
| Multi-agent | Single agent | Single agent | **Hierarchical multi-agent** |
| Expandability | Web apps only | Any code | **Modular (web, scripts, functions)** |

### Core Innovation
Unlike Bolt.new (single AI agent) or Claude Code (terminal-based), VAF implements a **governed multi-agent hierarchy** where specialized AI agents collaborate through a structured pipeline with reviews, approvals, and quality gates.

---

## Platform Analysis

### Bolt.new Architecture

**Source**: [Bolt.new GitHub](https://github.com/stackblitz/bolt.new) | [Latent Space Analysis](https://www.latent.space/p/bolt)

**How it works:**
```
User Prompt → Claude AI → Structured Artifacts → ActionRunner → WebContainer
                              ↓
                     [File operations]
                     [Shell commands]
                     [Server starts]
```

**Key Technical Components:**
1. **WebContainer Runtime**: In-browser Node.js environment (StackBlitz technology)
2. **Artifact System**: LLM outputs structured file operations and shell commands
3. **ActionRunner**: Executes AI-generated actions sequentially
4. **State Management**: Nanostores for reactive state across the app
5. **Persistence**: IndexedDB for conversation storage with fork/rewind support
6. **File Locking**: Prevents conflicts during AI code generation

**Strengths:**
- Full environment control in browser
- Instant preview without server infrastructure
- npm install, dev server, all client-side

**Limitations:**
- Single-agent architecture
- No structured governance or quality gates
- Limited to web applications

---

### Claude Code Architecture

**Source**: [Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-best-practices) | [Claude Code GitHub](https://github.com/anthropics/claude-code)

**How it works:**
```
User Command → Context Gathering → Action → Verification → Repeat
                    ↓
            [File search]
            [Read/Write files]
            [Run commands]
            [Lint/Test]
```

**Key Design Principles:**
1. **Minimal Abstraction**: Near-raw Claude API access
2. **Tool-based**: Uses same tools programmers use (grep, find, file operations)
3. **Feedback Loop**: Gather context → Take action → Verify → Repeat
4. **Editor-agnostic**: Terminal-based, works with any IDE
5. **Agentic Search**: Automatically finds relevant files without manual selection

**Autonomy Level**: Level 4 (Autonomous Agent)
- Executes multi-step plans with minimal supervision
- Iterates on failures
- Completes entire features
- Humans review outcomes, not every action

**Strengths:**
- Deep codebase understanding via CLAUDE.md
- Flexible, scriptable, customizable
- Works across entire file system

**Limitations:**
- Local execution only
- No browser-based preview
- No multi-agent collaboration

---

### Firebase AI Logic (Genkit)

**Source**: [Firebase Genkit Docs](https://firebase.google.com/docs/genkit/nextjs) | [Firebase Blog](https://firebase.blog/posts/2025/02/announcing-genkit/)

**Key Features:**
1. **Unified Model Interface**: Google, OpenAI, Anthropic, Ollama
2. **Structured Outputs**: Type-safe AI responses
3. **Tool Calling**: Native function calling support
4. **Multi-Agent Systems**: Multi-model orchestration (beta)
5. **RAG Support**: Retrieval augmented generation
6. **MCP Support**: Model Context Protocol integration

**Next.js Integration:**
```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const ai = genkit({ plugins: [googleAI()] });

const { text } = await ai.generate({
  model: googleAI.model('gemini-2.5-flash'),
  prompt: 'Build a landing page...',
  tools: [fileWriteTool, shellCommandTool],
});
```

**Advantages for VAF:**
- Firebase ecosystem integration (already using Firebase hosting/auth)
- Native Next.js support
- Cost-effective compared to Claude API
- Multi-modal support (images, drawings → code)
- Built-in streaming

---

## Proposed Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VAF AGENTIC FACTORY                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌──────────────────┐     ┌───────────────────────┐   │
│  │   FRONTEND  │     │   AI ORCHESTRATOR │     │    RUNTIME ENGINE     │   │
│  │             │     │                  │     │                       │   │
│  │ ┌─────────┐ │     │  ┌────────────┐  │     │  ┌─────────────────┐  │   │
│  │ │ Chat UI │ │────▶│  │ Prompt     │  │────▶│  │ WebContainer    │  │   │
│  │ └─────────┘ │     │  │ Router     │  │     │  │ (File System)   │  │   │
│  │             │     │  └────────────┘  │     │  └─────────────────┘  │   │
│  │ ┌─────────┐ │     │        │         │     │           │          │   │
│  │ │ Editor  │ │     │        ▼         │     │           ▼          │   │
│  │ └─────────┘ │     │  ┌────────────┐  │     │  ┌─────────────────┐  │   │
│  │             │     │  │ Agent      │  │     │  │ Dev Server      │  │   │
│  │ ┌─────────┐ │     │  │ Dispatcher │  │     │  │ (Preview)       │  │   │
│  │ │ Preview │ │◀────│  └────────────┘  │◀────│  └─────────────────┘  │   │
│  │ └─────────┘ │     │        │         │     │           │          │   │
│  │             │     │        ▼         │     │           ▼          │   │
│  │ ┌─────────┐ │     │  ┌────────────┐  │     │  ┌─────────────────┐  │   │
│  │ │Terminal │ │◀────│  │ Governance │  │────▶│  │ Quality Gates   │  │   │
│  │ └─────────┘ │     │  │ Pipeline   │  │     │  │ (Lint/Test)     │  │   │
│  └─────────────┘     │  └────────────┘  │     │  └─────────────────┘  │   │
│                      └──────────────────┘     └───────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        FIREBASE BACKEND                              │   │
│  │  ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌─────────────────┐   │   │
│  │  │ Auth     │  │ Firestore   │  │ AI Logic │  │ Cloud Functions │   │   │
│  │  │ (Users)  │  │ (Projects)  │  │ (Gemini) │  │ (Long-running)  │   │   │
│  │  └──────────┘  └─────────────┘  └──────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Hierarchy

```
                        ┌─────────────────────┐
                        │   vaf-orchestrator  │  ← Executive (Gemini Pro)
                        │   (Factory CEO)     │
                        └──────────┬──────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────────┐
        │                          │                              │
 ┌──────▼──────┐           ┌───────▼───────┐             ┌───────▼───────┐
 │   PLANNING  │           │  ENGINEERING  │             │   QUALITY     │
 └──────┬──────┘           └───────┬───────┘             └───────┬───────┘
        │                          │                              │
  ┌─────┴─────┐           ┌────────┼────────┐            ┌────────┼────────┐
  │           │           │        │        │            │        │        │
┌─▼──┐    ┌───▼───┐   ┌───▼───┐ ┌──▼──┐ ┌───▼───┐   ┌────▼───┐ ┌──▼──┐ ┌───▼────┐
│ PM │    │ Arch  │   │ Front │ │ UI  │ │ Back  │   │  QA    │ │ E2E │ │Security│
└────┘    └───────┘   └───────┘ └─────┘ └───────┘   └────────┘ └─────┘ └────────┘

Model Assignment:
- Executive: Gemini 1.5 Pro (complex reasoning)
- Leads: Gemini 1.5 Flash (fast, capable)
- ICs: Gemini 1.5 Flash-8B (cost-effective)
```

---

## Implementation Strategy

### Phase 1: Foundation (Current → 2 weeks)

**Goal**: Connect AI Chat to Gemini and enable basic code generation

**Tasks:**
1. **Firebase AI Logic Setup**
   - Install `@genkit-ai/googleai` and configure
   - Create API route `/api/chat` with streaming
   - Set up `GEMINI_API_KEY` environment variable

2. **Chat Integration**
   - Connect ChatPanel to `/api/chat` endpoint
   - Implement streaming response display
   - Add message history persistence (IndexedDB)

3. **Basic Code Generation**
   - Define file operation tools for Gemini
   - Create artifact parser (file writes, shell commands)
   - Connect to WebContainer for execution

**Deliverables:**
- Working chat with Gemini responses
- Basic file creation in WebContainer
- Streaming code output

---

### Phase 2: Agent System (2-4 weeks)

**Goal**: Implement multi-agent collaboration

**Tasks:**
1. **Agent Definitions**
   - Create Genkit flows for each agent type
   - Define agent-specific system prompts
   - Implement tool sets per agent role

2. **Prompt Router**
   - Classify user intent (feature, bug fix, question)
   - Route to appropriate agent or agent chain
   - Handle multi-step workflows

3. **Agent Communication**
   - Define artifact schemas (requirements, code, tests)
   - Implement handoff protocol between agents
   - Create shared context mechanism

**Deliverables:**
- vaf-pm, vaf-architect, vaf-frontend agents working
- Basic prompt → PRD → code pipeline
- Agent handoffs with context preservation

---

### Phase 3: Governance (4-6 weeks)

**Goal**: Implement AI-only review and approval pipeline

**Tasks:**
1. **Review System**
   - Create reviewer agent flows
   - Implement Decision Object schema
   - Build review feedback loop

2. **Approval Gates**
   - Define stage transition rules
   - Implement approval collection
   - Create escalation logic

3. **Audit Trail**
   - Log all decisions to ledger
   - Track agent invocations
   - Implement rollback capability

**Deliverables:**
- Full governance pipeline operational
- Automatic reviews and approvals
- Audit log for all decisions

---

### Phase 4: Production Hardening (6-8 weeks)

**Goal**: Make system production-ready

**Tasks:**
1. **Quality Gates**
   - Integrate ESLint, TypeScript, Vitest
   - Implement automatic test generation
   - Add accessibility checks

2. **Error Handling**
   - Graceful failure recovery
   - Retry logic with exponential backoff
   - User-friendly error messages

3. **Performance**
   - Optimize streaming responses
   - Cache common operations
   - Parallel agent execution

**Deliverables:**
- Production-ready system
- 99%+ uptime capability
- Sub-second response times

---

## Firebase AI Logic Integration

### Architecture

```typescript
// src/lib/ai/genkit.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
});

// Define reusable tools
export const fileWriteTool = ai.defineTool({
  name: 'writeFile',
  description: 'Write content to a file in the project',
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
}, async ({ path, content }) => {
  // WebContainer file write
  return { success: true };
});

export const shellCommandTool = ai.defineTool({
  name: 'runCommand',
  description: 'Run a shell command in the terminal',
  inputSchema: z.object({
    command: z.string(),
  }),
  outputSchema: z.object({ output: z.string() }),
}, async ({ command }) => {
  // WebContainer shell execution
  return { output: '...' };
});
```

### Agent Flow Definition

```typescript
// src/lib/ai/agents/frontend.ts
import { ai, fileWriteTool, shellCommandTool } from '../genkit';

export const frontendAgentFlow = ai.defineFlow({
  name: 'frontendAgent',
  inputSchema: z.object({
    task: z.string(),
    context: z.object({
      techSpec: z.string(),
      designSpec: z.string(),
      existingFiles: z.array(z.string()),
    }),
  }),
  outputSchema: z.object({
    files: z.array(z.object({
      path: z.string(),
      content: z.string(),
    })),
    commands: z.array(z.string()),
  }),
}, async (input) => {
  const result = await ai.generate({
    model: googleAI.model('gemini-1.5-flash'),
    prompt: `You are vaf-frontend, a React/TypeScript expert...

Task: ${input.task}
Tech Spec: ${input.context.techSpec}
Design Spec: ${input.context.designSpec}

Generate the implementation.`,
    tools: [fileWriteTool, shellCommandTool],
  });

  return parseAgentOutput(result);
});
```

### API Route

```typescript
// src/app/api/chat/route.ts
import { ai } from '@/lib/ai/genkit';
import { routeToAgent } from '@/lib/ai/router';

export async function POST(req: Request) {
  const { message, context } = await req.json();

  // Determine which agent(s) to invoke
  const agentChain = await routeToAgent(message);

  // Create streaming response
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Execute agent chain with streaming
  for (const agent of agentChain) {
    const result = await agent.flow(context);

    // Stream file operations
    for (const file of result.files) {
      await writer.write(JSON.stringify({
        type: 'file',
        path: file.path,
        content: file.content,
      }));
    }
  }

  await writer.close();
  return new Response(stream.readable);
}
```

---

## Agent System Design

### Prompt Router

```typescript
// src/lib/ai/router.ts
export async function routeToAgent(message: string): Promise<AgentChain> {
  const classification = await ai.generate({
    model: googleAI.model('gemini-1.5-flash-8b'),
    prompt: `Classify this user request:

"${message}"

Categories:
- NEW_FEATURE: User wants to build something new
- BUG_FIX: User reports an issue to fix
- MODIFICATION: User wants to change existing code
- QUESTION: User is asking for information
- DEPLOYMENT: User wants to deploy/publish

Return JSON: { "category": "...", "complexity": "simple|medium|complex" }`,
  });

  const { category, complexity } = JSON.parse(classification.text);

  // Route based on classification
  switch (category) {
    case 'NEW_FEATURE':
      if (complexity === 'simple') {
        return [frontendAgentFlow]; // Direct to implementation
      }
      return [pmAgentFlow, architectAgentFlow, frontendAgentFlow]; // Full pipeline

    case 'BUG_FIX':
      return [researcherAgentFlow, frontendAgentFlow, testRunnerAgentFlow];

    case 'QUESTION':
      return [researcherAgentFlow]; // Just gather info

    default:
      return [orchestratorAgentFlow]; // Let orchestrator decide
  }
}
```

### Decision Object Schema

```typescript
// src/lib/ai/governance/types.ts
export interface DecisionObject {
  workItemId: string;
  stage: 'INTAKE' | 'PLANNING' | 'ARCHITECTURE' | 'DESIGN' |
         'IMPLEMENTATION' | 'VERIFICATION' | 'RELEASE';
  decisionType: 'REVIEW' | 'APPROVAL' | 'SIGNOFF' | 'ESCALATION';
  decision: 'APPROVED' | 'CHANGES_REQUIRED' | 'REJECTED' | 'APPROVED_WITH_RISKS';
  reviewerAgent: string;
  timestamp: string;
  domain: string;
  iteration: number;
  notes: string;
  requiredChanges: string[];
  risks: string[];
  artifactsReviewed: string[];
  blocksTransition: boolean;
}
```

---

## Expansion Considerations

### Future App Types

| Type | Modifications Needed |
|------|---------------------|
| **Mobile Apps (React Native)** | Add mobile-specific templates, Expo integration |
| **Backend APIs** | Extend vaf-backend, add database tools |
| **CLI Tools** | Add Node.js script templates, argument parsing |
| **Serverless Functions** | Cloud Functions templates, deployment tools |
| **Desktop Apps (Electron)** | Electron templates, native module support |
| **Chrome Extensions** | Extension manifest templates, browser API tools |

### Modular Template System

```typescript
// src/lib/templates/registry.ts
export const templateRegistry = {
  'web-nextjs': {
    name: 'Next.js Web App',
    files: async () => import('./nextjs'),
    agents: ['vaf-frontend', 'vaf-ui'],
  },
  'web-react': {
    name: 'React SPA',
    files: async () => import('./react-spa'),
    agents: ['vaf-frontend', 'vaf-ui'],
  },
  'api-express': {
    name: 'Express API',
    files: async () => import('./express'),
    agents: ['vaf-backend', 'vaf-integrations'],
  },
  'script-node': {
    name: 'Node.js Script',
    files: async () => import('./node-script'),
    agents: ['vaf-backend'],
  },
  'function-serverless': {
    name: 'Serverless Function',
    files: async () => import('./serverless'),
    agents: ['vaf-backend', 'vaf-devops'],
  },
};
```

### Plugin Architecture

```typescript
// For future: Allow community plugins
interface VAFPlugin {
  name: string;
  version: string;
  templates?: TemplateDefinition[];
  agents?: AgentDefinition[];
  tools?: ToolDefinition[];
  hooks?: HookDefinition[];
}
```

---

## Technical Specifications

### Model Selection

| Agent Role | Model | Reasoning |
|------------|-------|-----------|
| vaf-orchestrator | gemini-1.5-pro | Complex multi-step reasoning |
| vaf-pm | gemini-1.5-flash | Fast requirement analysis |
| vaf-architect | gemini-1.5-pro | Deep technical decisions |
| vaf-frontend | gemini-1.5-flash | Fast code generation |
| vaf-backend | gemini-1.5-flash | Fast API development |
| vaf-ui | gemini-1.5-flash | Component design |
| vaf-researcher | gemini-1.5-flash-8b | Quick codebase search |
| vaf-security-review | gemini-1.5-flash | Security analysis |
| vaf-test-runner | gemini-1.5-flash-8b | Test execution |

### Cost Estimation

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| gemini-1.5-pro | $1.25 | $5.00 |
| gemini-1.5-flash | $0.075 | $0.30 |
| gemini-1.5-flash-8b | $0.0375 | $0.15 |

**Estimated cost per project generation:**
- Simple feature: ~$0.05-0.10
- Medium complexity: ~$0.20-0.50
- Full application: ~$1.00-3.00

### API Rate Limits

| Model | RPM | TPM |
|-------|-----|-----|
| gemini-1.5-pro | 360 | 4M |
| gemini-1.5-flash | 1000 | 4M |
| gemini-1.5-flash-8b | 4000 | 4M |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Token limit exceeded | Medium | High | Implement chunking, summarization |
| Hallucinated code | High | Medium | Validation, linting, type checking |
| Infinite agent loops | Low | High | Max iteration limits, circuit breakers |
| API rate limiting | Medium | Medium | Request queuing, backoff |
| Cost overrun | Medium | Medium | Budget limits per project |
| Inconsistent outputs | High | Medium | Structured outputs, schema validation |
| Security vulnerabilities | Medium | High | Security agent review, sandboxing |

---

## Roadmap

### Q1 2026: Foundation
- [ ] Firebase AI Logic integration
- [ ] Basic chat with Gemini
- [ ] Single-agent code generation
- [ ] WebContainer file operations

### Q2 2026: Multi-Agent
- [ ] Agent definitions (PM, Architect, Frontend)
- [ ] Prompt routing
- [ ] Agent handoffs
- [ ] Basic governance

### Q3 2026: Governance
- [ ] Full pipeline stages
- [ ] Review and approval flows
- [ ] Audit logging
- [ ] Quality gates

### Q4 2026: Expansion
- [ ] Additional app types
- [ ] Template marketplace
- [ ] Plugin system
- [ ] Enterprise features

---

## References

### Platforms Analyzed
- [Bolt.new](https://bolt.new/) - StackBlitz's AI code generation platform
- [Bolt.new GitHub](https://github.com/stackblitz/bolt.new) - Open source repository
- [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) - Community fork with multiple LLM support
- [Claude Code](https://github.com/anthropics/claude-code) - Anthropic's agentic coding CLI
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)

### Firebase Resources
- [Firebase Genkit](https://firebase.google.com/docs/genkit/nextjs) - Next.js integration guide
- [Firebase AI Logic](https://firebase.blog/posts/2025/05/building-ai-apps/) - Overview
- [Genkit GitHub](https://github.com/firebase/genkit) - Open source framework

### Technical Deep Dives
- [Bolt Architecture Analysis](https://www.latent.space/p/bolt) - Latent Space podcast
- [Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [WebContainer Technology](https://webcontainers.io/) - StackBlitz documentation

---

*Document created: January 2026*
*Last updated: January 2026*
*Author: VAF System*
