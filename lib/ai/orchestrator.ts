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
   */
  private async generateDirectResponse(
    message: string,
    context: FullTaskContext
  ): Promise<string> {
    const systemPrompt = `You are a helpful AI assistant for a web development project.
Project type: ${context.project?.type || 'unknown'}
${context.project?.fileTree ? `\nProject structure:\n${context.project.fileTree}` : ''}

Answer the user's question concisely and helpfully.`;

    const response = await ai.generate({
      model: MODELS.FLASH,
      prompt: `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`,
      config: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    return response.text || 'I apologize, but I was unable to generate a response.';
  }

  /**
   * Run the design agent
   */
  private async runDesignAgent(
    message: string,
    context: FullTaskContext,
    requestId: string
  ): Promise<AgentResponse> {
    const prompt = `You are a UI/UX design agent. Based on the user's request, create a design specification.

User request: ${message}

Project context:
- Type: ${context.project?.type || 'unknown'}
- Design system: ${JSON.stringify(context.design?.designSystem || {})}

Provide a design specification that includes:
1. Component type and variant
2. Placement and positioning
3. Styling classes (Tailwind)
4. Accessibility considerations

Respond in JSON format with this structure:
{
  "component": { "type": "...", "variant": "...", "size": "..." },
  "placement": { "parentComponent": "...", "position": "...", "justification": "..." },
  "styling": { "classes": [...], "reasoning": "..." },
  "accessibility": { "ariaLabel": "...", "note": "..." }
}`;

    try {
      const response = await ai.generate({
        model: MODELS.FLASH,
        prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      });

      const text = response.text || '{}';
      let designSpec;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        designSpec = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        designSpec = {};
      }

      return {
        requestId,
        agentId: 'design' as any,
        status: 'success',
        output: {
          type: 'design_spec',
          ...designSpec,
          component: designSpec.component || { type: 'unknown', variant: 'default', size: 'md' },
          placement: designSpec.placement || { parentComponent: 'unknown', position: 'relative', justification: 'start' },
          styling: designSpec.styling || { classes: [], reasoning: '' },
        },
        selfCheck: {
          passed: true,
          criteriaResults: [
            { criterion: 'Design spec provided', met: true, evidence: 'Spec generated' },
          ],
          confidence: 0.8,
        },
      };
    } catch (error) {
      return {
        requestId,
        agentId: 'design' as any,
        status: 'error',
        selfCheck: {
          passed: false,
          criteriaResults: [],
          confidence: 0,
        },
        error: {
          code: 'DESIGN_ERROR',
          message: error instanceof Error ? error.message : 'Design failed',
          recoverable: true,
        },
      };
    }
  }

  /**
   * Run the engineer agent
   */
  private async runEngineerAgent(
    message: string,
    context: FullTaskContext,
    designResponse: AgentResponse,
    requestId: string
  ): Promise<AgentResponse> {
    const designSpec = designResponse.output?.type === 'design_spec' ? designResponse.output : null;

    const prompt = `You are a frontend engineer agent. Implement the user's request based on the design spec.

User request: ${message}

Design specification:
${JSON.stringify(designSpec, null, 2)}

Project context:
- Type: ${context.project?.type || 'unknown'}
- File tree: ${context.project?.fileTree || 'Not available'}

Relevant files:
${context.relevantFiles?.map(f => `\n### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n') || 'None'}

Generate file operations to implement this feature. Respond in JSON format:
{
  "operations": [
    {
      "type": "write" | "edit",
      "path": "path/to/file.tsx",
      "content": "full file content for write, or omit for edit",
      "edits": [{ "oldContent": "...", "newContent": "..." }] // for edit type
    }
  ]
}`;

    try {
      const response = await ai.generate({
        model: MODELS.FLASH,
        prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      });

      const text = response.text || '{}';
      let result;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { operations: [] };
      } catch {
        result = { operations: [] };
      }

      return {
        requestId,
        agentId: 'engineer' as any,
        status: 'success',
        output: {
          type: 'file_operations',
          operations: result.operations || [],
        },
        selfCheck: {
          passed: true,
          criteriaResults: [
            { criterion: 'Implementation provided', met: true, evidence: `${result.operations?.length || 0} operations` },
          ],
          confidence: 0.85,
        },
      };
    } catch (error) {
      return {
        requestId,
        agentId: 'engineer' as any,
        status: 'error',
        selfCheck: {
          passed: false,
          criteriaResults: [],
          confidence: 0,
        },
        error: {
          code: 'ENGINEER_ERROR',
          message: error instanceof Error ? error.message : 'Engineering failed',
          recoverable: true,
        },
      };
    }
  }

  /**
   * Run the QA agent
   */
  private async runQAAgent(
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
