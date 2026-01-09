import { NextResponse } from 'next/server';
import { ai, MODELS } from '@/lib/ai';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
import { chatContextManager, generateConversationId } from '@/lib/ai/context';
import {
  createStreamingResponse,
  createReadableStreamFromGenerator,
  encodeStreamChunk,
} from '@/lib/ai/streaming';
// Chat types from legacy types file
import type { ChatRequest, StreamChunk, ChatMessage } from '@/lib/ai/types';
// Orchestrator types from new types folder
import type { FullTaskContext, AgentResponse as OrchestratorAgentResponse, FileOperation } from '@/lib/ai/types/index';
import { orchestrator } from '@/lib/ai/orchestrator';

/**
 * Chat API Route
 *
 * Handles chat requests and returns AI responses.
 * Supports both streaming and non-streaming modes.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json() as ChatRequest;
    const { message, conversationId: existingConversationId, context } = body;

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get or create conversation context
    const conversationId = existingConversationId || generateConversationId();
    const chatContext = chatContextManager.getOrCreateContext(conversationId);

    // Update project context if provided
    if (context?.projectFiles) {
      chatContextManager.updateProjectContext(
        conversationId,
        context.projectFiles,
        context.currentFile || null
      );
    }

    // Update rich project context if provided (from WebContainer scanning)
    if (context?.fileTree || context?.keyFiles || context?.projectType) {
      const ctx = chatContextManager.getOrCreateContext(conversationId);
      if (context.fileTree) {
        // fileTree is already formatted string from client
        ctx.fileTree = [{ name: 'root', path: '/', type: 'directory' as const }]; // Placeholder
      }
      if (context.keyFiles) {
        ctx.keyFileContents = context.keyFiles.map((f: { path: string; content: string }) => ({
          path: f.path,
          content: f.content,
          truncated: false
        }));
      }
      if (context.projectType) {
        ctx.projectType = context.projectType as 'nextjs' | 'vite' | 'cra' | 'unknown';
      }
      if (context.entryPoint) {
        ctx.suggestedEntryPoint = context.entryPoint;
      }
      // Store raw file tree string for direct use in prompt
      (ctx as any).fileTreeFormatted = context.fileTree;
    }

    // Add user message to context
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
    };
    chatContextManager.addMessage(conversationId, userMessage);

    // Check if streaming is requested
    const acceptHeader = request.headers.get('accept') || '';
    const useStreaming = acceptHeader.includes('text/event-stream');

    if (useStreaming) {
      // Return streaming response
      const stream = createReadableStreamFromGenerator(
        generateStreamingResponse(conversationId, message)
      );
      return createStreamingResponse(stream);
    }

    // Non-streaming response
    const response = await generateResponse(conversationId, message);

    // Add assistant message to context
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: response,
    };
    chatContextManager.addMessage(conversationId, assistantMessage);

    return NextResponse.json({
      message: response,
      conversationId,
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service not configured. Please add GEMINI_API_KEY to environment.' },
          { status: 503 }
        );
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}

/**
 * Generate a non-streaming response using orchestrator pipeline
 */
async function generateResponse(
  conversationId: string,
  userMessage: string
): Promise<string> {
  const chatContext = chatContextManager.getOrCreateContext(conversationId);

  try {
    // Build FullTaskContext for orchestrator
    const taskContext: FullTaskContext = buildTaskContext(userMessage, chatContext);

    console.log('[Chat API] Processing via orchestrator pipeline...');
    console.log('[Chat API] Task context:', JSON.stringify({
      userRequest: taskContext.userRequest,
      projectType: taskContext.project?.type,
      hasRelevantFiles: (taskContext.relevantFiles?.length ?? 0) > 0,
    }));

    // Process through orchestrator (Design → Engineer → QA pipeline)
    const responses = await orchestrator.processRequest(
      userMessage,
      taskContext,
      conversationId
    );

    console.log('[Chat API] Orchestrator completed:', responses.length, 'agent responses');

    // Format the orchestrator responses for the user
    return formatOrchestratorResponse(responses, userMessage);
  } catch (error) {
    console.error('[Chat API] Orchestrator error:', error);

    // Fallback to direct generation for simple questions
    if (isSimpleQuestion(userMessage)) {
      console.log('[Chat API] Falling back to direct generation for simple question');
      return generateDirectResponse(conversationId, userMessage);
    }

    throw error;
  }
}

/**
 * Fallback direct generation for simple questions
 */
async function generateDirectResponse(
  conversationId: string,
  userMessage: string
): Promise<string> {
  const systemPrompt = chatContextManager.buildSystemPrompt(conversationId);
  const messages = chatContextManager.getMessagesForModel(conversationId);
  const prompt = buildPrompt(systemPrompt, messages, userMessage);

  const response = await ai.generate({
    model: MODELS.FLASH,
    prompt,
    config: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  });

  return response.text || 'I apologize, but I was unable to generate a response.';
}

/**
 * Check if the message is a simple question (not a code request)
 */
function isSimpleQuestion(message: string): boolean {
  const questionPatterns = /^(what|how|why|when|where|who|can you explain|tell me about|describe)\s/i;
  const codePatterns = /\b(create|add|build|implement|make|write|update|fix|change|modify|delete|remove)\b/i;

  return questionPatterns.test(message) && !codePatterns.test(message);
}

/**
 * Build FullTaskContext from chat context
 */
function buildTaskContext(userMessage: string, chatContext: any): FullTaskContext {
  // Map key files to relevant files format
  const relevantFiles = (chatContext.keyFileContents || []).map((f: { path: string; content: string }) => ({
    path: f.path,
    content: f.content,
    relevance: 'provided by user context',
  }));

  // Map project type to expected enum values
  const projectTypeMap: Record<string, 'nextjs' | 'vite' | 'react' | 'express' | 'unknown'> = {
    'nextjs': 'nextjs',
    'vite': 'vite',
    'cra': 'react', // Map CRA to react
    'react': 'react',
    'express': 'express',
    'unknown': 'unknown',
  };
  const mappedProjectType = projectTypeMap[chatContext.projectType || 'unknown'] || 'unknown';

  return {
    userRequest: userMessage,
    project: {
      type: mappedProjectType,
      rootPath: '/',
      fileTree: (chatContext as any).fileTreeFormatted || '',
    },
    relevantFiles,
    // Design context would be populated from design system if available
    design: {
      designSystem: {
        colors: {
          primary: '#3b82f6',
          secondary: '#64748b',
          background: '#ffffff',
          text: '#1e293b',
        },
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '2rem',
        },
        typography: {
          fontFamily: {
            sans: 'Inter, system-ui, sans-serif',
            mono: 'ui-monospace, monospace',
          },
          fontSize: { base: '1rem', sm: '0.875rem', lg: '1.125rem' },
        },
      },
    },
    conversation: {
      messages: chatContext.messages || [],
    },
  };
}

/**
 * Format orchestrator responses into user-friendly output
 * Only shows the LATEST response per agent (in case of rework)
 */
function formatOrchestratorResponse(responses: OrchestratorAgentResponse[], userRequest: string): string {
  const parts: string[] = [];

  // Deduplicate responses - keep only the latest per agent
  const latestByAgent = new Map<string, OrchestratorAgentResponse>();
  for (const r of responses) {
    latestByAgent.set(r.agentId, r); // Later responses overwrite earlier ones
  }
  const deduplicatedResponses = Array.from(latestByAgent.values());

  // Find design spec if present
  const designResponse = responses.find(r => r.agentId === 'design' && r.output?.type === 'design_spec');
  if (designResponse?.output?.type === 'design_spec') {
    const spec = designResponse.output;
    parts.push(`## Design Specification\n`);
    parts.push(`**Component**: ${spec.component.type} (${spec.component.variant}, ${spec.component.size})`);
    parts.push(`**Placement**: ${spec.placement.position} - ${spec.placement.justification}`);
    parts.push(`**Styling**: \`${spec.styling.classes.join(' ')}\``);
    if (spec.accessibility) {
      parts.push(`**Accessibility**: ${spec.accessibility.ariaLabel || 'Standard'}`);
    }
    parts.push('');
  }

  // Find file operations if present
  const engineerResponse = responses.find(r => r.agentId === 'engineer' && r.output?.type === 'file_operations');
  if (engineerResponse?.output?.type === 'file_operations') {
    const operations = engineerResponse.output.operations;
    parts.push(`## File Operations\n`);

    for (const op of operations) {
      if (op.type === 'write') {
        parts.push(`### Create: \`${op.path}\``);
        parts.push('```tsx');
        parts.push(op.content || '');
        parts.push('```');
      } else if (op.type === 'edit') {
        parts.push(`### Edit: \`${op.path}\``);
        for (const edit of op.edits || []) {
          parts.push('**Replace:**');
          parts.push('```tsx');
          parts.push(edit.oldContent);
          parts.push('```');
          parts.push('**With:**');
          parts.push('```tsx');
          parts.push(edit.newContent);
          parts.push('```');
        }
      } else if (op.type === 'delete') {
        parts.push(`### Delete: \`${op.path}\``);
      }
      parts.push('');
    }
  }

  // Find QA analysis if present
  const qaResponse = responses.find(r => r.agentId === 'qa' && r.output?.type === 'analysis');
  if (qaResponse?.output?.type === 'analysis') {
    const analysis = qaResponse.output;
    parts.push(`## Verification\n`);
    parts.push(`**Summary**: ${analysis.summary}`);
    if (analysis.findings && analysis.findings.length > 0) {
      parts.push(`**Findings**:`);
      for (const finding of analysis.findings) {
        parts.push(`- [${finding.severity}] ${finding.description}`);
      }
    }
    parts.push('');
  }

  // Add self-check summary (using deduplicated responses)
  const selfChecks = deduplicatedResponses.filter(r => r.selfCheck?.passed !== undefined);
  if (selfChecks.length > 0) {
    parts.push(`## Quality Checks\n`);
    for (const r of selfChecks) {
      const status = r.selfCheck?.passed ? '✅' : '⚠️';
      const confidence = Math.round((r.selfCheck?.confidence ?? 0) * 100);
      parts.push(`${status} **${r.agentId}**: ${confidence}% confidence`);
    }
  }

  // If no structured output, return a summary
  if (parts.length === 0) {
    return `I've processed your request "${userRequest}" through the orchestrator pipeline, but no file operations were generated. This might be a question or the request couldn't be fulfilled.`;
  }

  return parts.join('\n');
}

/**
 * Generate a streaming response using orchestrator pipeline
 * Now emits orchestrator events for workflow visualization
 */
async function* generateStreamingResponse(
  conversationId: string,
  userMessage: string
): AsyncGenerator<StreamChunk, void, unknown> {
  const chatContext = chatContextManager.getOrCreateContext(conversationId);

  // Queue for orchestrator events
  const eventQueue: StreamChunk[] = [];
  let unsubscribe: (() => void) | null = null;

  try {
    // For simple questions, use direct streaming
    if (isSimpleQuestion(userMessage)) {
      yield* generateDirectStreamingResponse(conversationId, userMessage);
      return;
    }

    // Subscribe to orchestrator events
    unsubscribe = orchestrator.onEvent((event) => {
      // Convert orchestrator event to stream chunk
      eventQueue.push({
        type: 'orchestrator_event',
        orchestratorEvent: {
          type: event.type,
          state: event.type === 'STATE_CHANGE' ? event.state : undefined,
          phase: event.type === 'STATE_CHANGE' ? event.phase : undefined,
          agent: 'agent' in event ? event.agent : undefined,
          step: event.type === 'AGENT_INVOKED' ? event.step as Record<string, unknown> : undefined,
          response: event.type === 'AGENT_RESPONSE' ? event.response as Record<string, unknown> : undefined,
          result: event.type === 'EVALUATION' ? event.result as unknown as Record<string, unknown> : undefined,
          operation: event.type === 'FILE_OPERATION' ? event.operation as Record<string, unknown> : undefined,
          status: event.type === 'FILE_OPERATION' ? event.status : undefined,
          success: event.type === 'COMPLETE' ? event.success : undefined,
          error: event.type === 'ERROR' && event.error ? { message: event.error.message } : undefined,
        },
      });
    });

    // Emit phase update
    yield { type: 'text', content: '**Processing through orchestrator pipeline...**\n\n' };

    // Emit queued events
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }

    // Build task context
    const taskContext: FullTaskContext = buildTaskContext(userMessage, chatContext);

    // Emit classification phase
    yield { type: 'text', content: '🔍 **Classifying request...**\n' };

    // Process through orchestrator
    const responses = await orchestrator.processRequest(
      userMessage,
      taskContext,
      conversationId
    );

    // Emit any remaining queued events
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }

    // Emit agent progress (deduplicated)
    const seenAgents = new Set<string>();
    for (const response of responses) {
      if (!seenAgents.has(response.agentId)) {
        seenAgents.add(response.agentId);
        const status = response.selfCheck?.passed ? '✅' : '⚠️';
        yield { type: 'text', content: `${status} **${response.agentId}** completed\n` };
      }
    }

    yield { type: 'text', content: '\n---\n\n' };

    // Format and emit the full response
    const formattedResponse = formatOrchestratorResponse(responses, userMessage);
    yield { type: 'text', content: formattedResponse };

    // Add complete response to context
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: formattedResponse,
    };
    chatContextManager.addMessage(conversationId, assistantMessage);

    yield { type: 'done' };
  } catch (error) {
    console.error('[Chat API] Orchestrator streaming error:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Pipeline failed',
    };
  } finally {
    // Clean up event subscription
    if (unsubscribe) {
      unsubscribe();
    }
  }
}

/**
 * Direct streaming for simple questions (fallback)
 */
async function* generateDirectStreamingResponse(
  conversationId: string,
  userMessage: string
): AsyncGenerator<StreamChunk, void, unknown> {
  const systemPrompt = chatContextManager.buildSystemPrompt(conversationId);
  const messages = chatContextManager.getMessagesForModel(conversationId);
  const prompt = buildPrompt(systemPrompt, messages, userMessage);

  let fullResponse = '';

  try {
    const { stream } = await ai.generateStream({
      model: MODELS.FLASH,
      prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text || '';
      if (text) {
        fullResponse += text;
        yield { type: 'text', content: text };
      }
    }

    // Add complete response to context
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: fullResponse,
    };
    chatContextManager.addMessage(conversationId, assistantMessage);

    yield { type: 'done' };
  } catch (error) {
    console.error('[Chat API] Direct streaming error:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}

/**
 * Build the full prompt with system message and conversation history
 */
function buildPrompt(
  systemPrompt: string,
  messages: ChatMessage[],
  currentMessage: string
): string {
  let prompt = systemPrompt + '\n\n';

  // Add conversation history (excluding the current message which is already in messages)
  for (const msg of messages.slice(0, -1)) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    prompt += `${role}: ${msg.content}\n\n`;
  }

  // Add current user message
  prompt += `User: ${currentMessage}\n\nAssistant:`;

  return prompt;
}
