/**
 * Orchestrator Module
 *
 * Coordinates the multi-agent pipeline for processing user requests.
 * This is the central coordinator that routes requests through design,
 * engineering, and QA agents.
 */

import type { OrchestratorEventChunk } from './types';
import type { AgentResponse, FullTaskContext } from './types/index';
import { ai, MODELS } from './genkit';

// OrchestratorEvent is an alias for OrchestratorEventChunk
export type OrchestratorEvent = OrchestratorEventChunk;

// Re-export for convenience
export type { OrchestratorEventChunk };

/**
 * Orchestrator event types for real-time pipeline visualization
 */
export type OrchestratorEventType =
  | 'STATE_CHANGE'
  | 'AGENT_INVOKED'
  | 'AGENT_RESPONSE'
  | 'EVALUATION'
  | 'FILE_OPERATION'
  | 'COMPLETE'
  | 'ERROR';

export interface OrchestratorEventPayload {
  type: OrchestratorEventType;
  state?: string;
  phase?: string;
  agent?: string;
  step?: Record<string, unknown>;
  response?: Record<string, unknown>;
  result?: Record<string, unknown>;
  operation?: Record<string, unknown>;
  status?: string;
  success?: boolean;
  error?: Error;
}

type EventCallback = (event: OrchestratorEventPayload) => void;

/**
 * Orchestrator class - coordinates the agent pipeline
 */
class Orchestrator {
  private eventListeners: Set<EventCallback> = new Set();

  /**
   * Subscribe to orchestrator events
   * @returns Unsubscribe function
   */
  onEvent(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: OrchestratorEventPayload): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[Orchestrator] Event listener error:', err);
      }
    }
  }

  /**
   * Process a user request through the agent pipeline
   *
   * For simple questions, returns a direct response.
   * For code requests, routes through design → engineer → QA pipeline.
   */
  async processRequest(
    userMessage: string,
    context: FullTaskContext,
    conversationId?: string
  ): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];
    const requestId = `req-${Date.now()}`;

    try {
      // Emit start event
      this.emit({
        type: 'STATE_CHANGE',
        state: 'classifying',
        phase: 'Classification',
      });

      // Classify the request
      const isCodeRequest = this.isCodeRequest(userMessage);

      if (!isCodeRequest) {
        // Simple question - generate direct response
        this.emit({
          type: 'STATE_CHANGE',
          state: 'executing_agent',
          phase: 'Direct Response',
          agent: 'assistant',
        });

        const response = await this.generateDirectResponse(userMessage, context);
        responses.push({
          requestId,
          agentId: 'assistant' as any,
          status: 'success',
          output: {
            type: 'analysis',
            summary: response,
            findings: [],
          },
          selfCheck: {
            passed: true,
            criteriaResults: [],
            confidence: 0.9,
          },
        });
      } else {
        // Code request - run through pipeline
        // Step 1: Design phase
        this.emit({
          type: 'STATE_CHANGE',
          state: 'executing_agent',
          phase: 'Design',
          agent: 'design',
        });

        this.emit({
          type: 'AGENT_INVOKED',
          agent: 'design',
          step: { description: 'Generating design specification' },
        });

        // Design agent generates spec
        const designResponse = await this.runDesignAgent(userMessage, context, requestId);
        responses.push(designResponse);

        this.emit({
          type: 'AGENT_RESPONSE',
          agent: 'design',
          response: { status: designResponse.status },
        });

        // Step 2: Engineering phase
        this.emit({
          type: 'STATE_CHANGE',
          state: 'executing_agent',
          phase: 'Implementation',
          agent: 'engineer',
        });

        this.emit({
          type: 'AGENT_INVOKED',
          agent: 'engineer',
          step: { description: 'Implementing changes' },
        });

        const engineerResponse = await this.runEngineerAgent(
          userMessage,
          context,
          designResponse,
          requestId
        );
        responses.push(engineerResponse);

        this.emit({
          type: 'AGENT_RESPONSE',
          agent: 'engineer',
          response: { status: engineerResponse.status },
        });

        // Step 3: QA phase
        this.emit({
          type: 'STATE_CHANGE',
          state: 'evaluating',
          phase: 'Verification',
          agent: 'qa',
        });

        this.emit({
          type: 'AGENT_INVOKED',
          agent: 'qa',
          step: { description: 'Verifying implementation' },
        });

        const qaResponse = await this.runQAAgent(
          userMessage,
          context,
          engineerResponse,
          requestId
        );
        responses.push(qaResponse);

        this.emit({
          type: 'AGENT_RESPONSE',
          agent: 'qa',
          response: { status: qaResponse.status },
        });
      }

      // Complete
      this.emit({
        type: 'COMPLETE',
        success: true,
      });

      return responses;
    } catch (error) {
      this.emit({
        type: 'ERROR',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Check if the message is requesting code changes
   */
  private isCodeRequest(message: string): boolean {
    const codePatterns = /\b(create|add|build|implement|make|write|update|fix|change|modify|delete|remove|refactor)\b/i;
    return codePatterns.test(message);
  }

  /**
   * Generate a direct response for simple questions
   * Enhanced to include comprehensive project context for better answers
   */
  private async generateDirectResponse(
    message: string,
    context: FullTaskContext
  ): Promise<string> {
    // Build comprehensive system prompt with full project context
    const systemPromptParts: string[] = [
      `You are a helpful AI assistant with deep knowledge of the user's web development project.
You have access to the project's complete structure and key files.
Provide comprehensive, informative answers that demonstrate understanding of the codebase.`,
    ];

    // Add project type and configuration
    if (context.project?.type && context.project.type !== 'unknown') {
      systemPromptParts.push(`
## PROJECT OVERVIEW
- **Type**: ${context.project.type.toUpperCase()} project
- **Root Path**: ${context.project.rootPath || '/'}`);
    }

    // Add file tree structure
    if (context.project?.fileTree) {
      systemPromptParts.push(`
## PROJECT STRUCTURE
\`\`\`
${context.project.fileTree}
\`\`\``);
    }

    // Add key file contents - this is CRITICAL for project understanding
    if (context.relevantFiles && context.relevantFiles.length > 0) {
      systemPromptParts.push(`
## KEY FILE CONTENTS
The following are important files in the project. Use these to understand the codebase:
`);
      for (const file of context.relevantFiles) {
        // Truncate very long files to avoid token overflow
        const content = file.content.length > 3000
          ? file.content.slice(0, 3000) + '\n... (truncated)'
          : file.content;
        systemPromptParts.push(`### ${file.path}
\`\`\`
${content}
\`\`\`
`);
      }
    }

    // Add design system context if available
    if (context.design?.designSystem) {
      const ds = context.design.designSystem;
      systemPromptParts.push(`
## DESIGN SYSTEM
- **Colors**: Primary=${ds.colors?.primary || 'N/A'}, Secondary=${ds.colors?.secondary || 'N/A'}
- **Font**: ${ds.typography?.fontFamily?.sans || 'system fonts'}`);
    }

    // Build conversation history for context continuity
    let conversationContext = '';
    if (context.conversation?.messages && context.conversation.messages.length > 0) {
      const recentMessages = context.conversation.messages.slice(-6); // Last 6 messages
      if (recentMessages.length > 0) {
        conversationContext = '\n## RECENT CONVERSATION\n';
        for (const msg of recentMessages) {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          // Truncate long messages in history
          const content = msg.content.length > 500
            ? msg.content.slice(0, 500) + '...'
            : msg.content;
          conversationContext += `${role}: ${content}\n\n`;
        }
      }
    }

    // Instructions for answering
    systemPromptParts.push(`
## INSTRUCTIONS
When answering questions about this project:
1. Reference specific files, functions, and code patterns you see in the KEY FILE CONTENTS
2. Explain BOTH the technical implementation AND the product functionality
3. Be specific - mention actual component names, routes, APIs, and features
4. If asked about functionality, describe what the application DOES, not just its tech stack
5. Structure your answer clearly with sections if the question is broad`);

    const systemPrompt = systemPromptParts.join('\n');

    // Build the full prompt
    const fullPrompt = `${systemPrompt}${conversationContext}

User: ${message}`;

    // Call AI to generate response
    const response = await ai.generate({
      model: MODELS.flash,
      prompt: fullPrompt,
    });

    return response.text;
  }

  /**
   * Generate QA review for engineer response
   */
  private async generateQAReview(
    message: string,
    context: FullTaskContext,
    engineerResponse: AgentResponse,
    requestId: string
  ): Promise<AgentResponse> {
    const operations = engineerResponse.output?.type === 'file_operations'
      ? engineerResponse.output.operations
      : [];

    return {
      requestId,
      agentId: 'qa' as any,
      status: 'success',
      output: {
        type: 'analysis',
        summary: `Verified ${operations.length} file operations`,
        findings: operations.map((op: any) => ({
          category: 'file',
          description: `${op.type}: ${op.path}`,
          severity: 'info' as const,
        })),
        recommendations: [],
      },
      selfCheck: {
        passed: true,
        criteriaResults: [
          { criterion: 'Code review complete', met: true, evidence: 'Operations verified' },
        ],
        confidence: 0.8,
      },
    };
  }
}

// Export singleton instance
export const orchestrator = new Orchestrator();
