/**
 * Bolt Generate API Route
 *
 * Unified generator endpoint that streams AI responses as SSE.
 * Parses vafArtifact/vafAction tags and emits structured actions.
 *
 * Supports intelligent routing based on request classification:
 * - question: Direct answers without code generation
 * - simple/moderate: Standard code generation with flash model
 * - complex/mega-complex: Advanced generation with pro model
 *
 * POST /api/bolt-generate
 *
 * Request body:
 * {
 *   prompt: string;
 *   projectContext: {
 *     fileTree: string;
 *     framework: string;
 *     styling: string;
 *     language?: {
 *       primary: 'typescript' | 'javascript';
 *       hasTypeScript: boolean;
 *       hasJavaScript: boolean;
 *       hasTsConfig: boolean;
 *       fileExtensions: { components: '.tsx' | '.jsx'; modules: '.ts' | '.js' };
 *     };
 *     existingFiles?: { path: string; content: string }[];
 *   };
 *   conversationHistory?: { role: string; content: string }[];
 *   classification?: ClassificationResult;
 * }
 *
 * SSE Response events:
 * - { type: 'text', content: string } - Streamed text chunks
 * - { type: 'action', action: { type, filePath?, content } } - Parsed file/shell actions
 * - { type: 'done' } - Stream complete
 * - { type: 'error', message: string } - Error occurred
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import { BOLT_SYSTEM_PROMPT, buildContextualPrompt } from '@/lib/bolt/ai/prompts';
import { parseArtifacts } from '@/lib/bolt/ai/parser';
import type { BoltGenerateRequest, BoltStreamChunk } from '@/lib/bolt/types';
import type { ClassificationResult } from '@/lib/bolt/ai/classifier';
import {
  selectAndGetModel,
  formatSelectionLog,
  type Phase,
} from '@/lib/bolt/ai/modelRouter';
// Investigation layer integration
import type { InvestigationResult } from '@/lib/bolt/investigation';

// Question mode system prompt - comprehensive project-aware answering
const QUESTION_SYSTEM_PROMPT = `You are an expert AI assistant with deep knowledge of the user's web development project.

You have access to the project's complete file structure, key source files, and conversation history.
Use this information to provide comprehensive, project-specific answers.

When answering questions about this project:
1. **Reference specific files, functions, and code patterns** from the project context
2. **Explain BOTH the technical implementation AND the product functionality**
3. **Be specific** - mention actual component names, routes, APIs, hooks, and features you see in the code
4. **If asked about functionality**, describe what the application DOES, not just its tech stack
5. **Structure your answer** clearly with sections if the question is broad
6. **Quote relevant code snippets** when they help explain your answer

Do NOT generate code blocks with vafArtifact or vafAction tags - focus on explaining.

If the user is actually asking you to build or modify something (not just asking a question),
let them know you'd be happy to help with that as a separate request.`;

// Force dynamic rendering for streaming
export const dynamic = 'force-dynamic';

// Allow longer generation time
export const maxDuration = 60;

// =============================================================================
// INVESTIGATION CONTEXT BUILDER
// =============================================================================

/**
 * Build context string from investigation results
 */
function buildInvestigationContext(result: InvestigationResult): string | null {
  if (!result.success || !result.findings.length) {
    return null;
  }

  const parts: string[] = ['<investigation_findings>'];

  // Add key findings
  if (result.findings.length > 0) {
    parts.push('Key findings from code investigation:');
    for (const finding of result.findings) {
      const files = finding.files.length > 0
        ? ` (files: ${finding.files.slice(0, 3).join(', ')})`
        : '';
      parts.push(`- ${finding.description}${files}`);
      if (finding.suggestion) {
        parts.push(`  Suggestion: ${finding.suggestion}`);
      }
    }
  }

  // Add suggested approach if available
  if (result.suggestedApproach) {
    parts.push('');
    parts.push(`Suggested approach: ${result.suggestedApproach}`);
  }

  // Add files that should be read
  if (result.filesToRead.required.length > 0) {
    parts.push('');
    parts.push('Files to read before making changes:');
    for (const file of result.filesToRead.required.slice(0, 5)) {
      parts.push(`- ${file.filePath} (${file.reason})`);
    }
  }

  parts.push('</investigation_findings>');

  return parts.join('\n');
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json() as BoltGenerateRequest & {
      classification?: ClassificationResult;
      investigationResult?: InvestigationResult;
    };
    const { prompt, projectContext, conversationHistory, classification, investigationResult } = body;

    // Validate request
    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine mode from classification (default to 'moderate' if not provided)
    const mode = classification?.mode || 'moderate';
    const isQuestionMode = mode === 'question';

    console.log('[bolt-generate] Request classification:', {
      mode,
      confidence: classification?.confidence,
      domains: classification?.domains,
    });

    // Build the full prompt with context
    const languageInfo = projectContext?.language?.primary === 'typescript'
      ? 'TypeScript (use .tsx for React components, .ts for other files)'
      : 'JavaScript (use .jsx for React components, .js for other files)';

    // For question mode, build comprehensive context prompt
    let contextualPrompt: string;

    if (isQuestionMode) {
      // Build comprehensive context for questions
      const contextParts: string[] = [];

      // Project overview
      contextParts.push(`<project_context>
Language: ${languageInfo}
Framework: ${projectContext?.framework || 'React + Vite'}
Styling: ${projectContext?.styling || 'Tailwind CSS'}
</project_context>`);

      // File tree structure - CRITICAL for understanding project layout
      if (projectContext?.fileTree) {
        contextParts.push(`<file_structure>
${projectContext.fileTree}
</file_structure>`);
      }

      // Existing/relevant files - CRITICAL for understanding implementation
      if (projectContext?.existingFiles && projectContext.existingFiles.length > 0) {
        const fileContents = projectContext.existingFiles
          .map(f => {
            // Truncate very long files
            const content = f.content.length > 4000
              ? f.content.slice(0, 4000) + '\n... (truncated)'
              : f.content;
            return `### ${f.path}\n\`\`\`\n${content}\n\`\`\``;
          })
          .join('\n\n');
        contextParts.push(`<key_files>
The following are important source files in the project. Use these to understand the codebase:

${fileContents}
</key_files>`);
      }

      // Conversation history for context continuity
      if (conversationHistory && conversationHistory.length > 0) {
        const historyText = conversationHistory
          .slice(-6) // Last 6 messages
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.length > 500 ? m.content.slice(0, 500) + '...' : m.content}`)
          .join('\n\n');
        contextParts.push(`<conversation_history>
${historyText}
</conversation_history>`);
      }

      // User question
      contextParts.push(`<user_question>
${prompt}
</user_question>`);

      contextualPrompt = contextParts.join('\n\n');
    } else {
      // For code generation, use the standard builder
      contextualPrompt = buildContextualPrompt(
        prompt,
        projectContext || { fileTree: '', framework: 'React + Vite', styling: 'Tailwind CSS' },
        conversationHistory?.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      );

      // Add investigation findings to context if available
      if (investigationResult && investigationResult.success) {
        const investigationContext = buildInvestigationContext(investigationResult);
        if (investigationContext) {
          contextualPrompt = `${investigationContext}\n\n${contextualPrompt}`;
        }
      }
    }

    // Select system prompt based on mode
    const systemPrompt = isQuestionMode ? QUESTION_SYSTEM_PROMPT : BOLT_SYSTEM_PROMPT;

    // Determine phase based on mode
    const phase: Phase = isQuestionMode ? 'investigate' : 'execute';

    // Select model using smart router (cost-optimized)
    const { model: selectedModel, selection } = selectAndGetModel({
      phase,
      mode,
      complexityScore: classification?.estimatedFiles,
    });
    console.log(formatSelectionLog({ phase, mode, complexityScore: classification?.estimatedFiles }, selection));

    // Create SSE stream
    const encoder = new TextEncoder();
    let isClosed = false;

    // Helper to safely enqueue data
    const safeEnqueue = (controller: ReadableStreamDefaultController, data: string) => {
      if (isClosed) return false;
      try {
        controller.enqueue(encoder.encode(data));
        return true;
      } catch {
        isClosed = true;
        return false;
      }
    };

    // Helper to safely close the stream
    const safeClose = (controller: ReadableStreamDefaultController) => {
      if (isClosed) return;
      try {
        controller.close();
        isClosed = true;
      } catch {
        isClosed = true;
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        // Listen for client abort
        request.signal.addEventListener('abort', () => {
          console.log('[bolt-generate] Client aborted request');
          isClosed = true;
          safeClose(controller);
        });

        try {
          // Generate with streaming using mode-appropriate settings
          const { stream: aiStream } = await ai.generateStream({
            model: selectedModel,
            system: systemPrompt,
            prompt: contextualPrompt,
            config: {
              temperature: isQuestionMode ? 0.3 : 0.4,
              // Increased from 2048 to 4096 for questions to allow comprehensive answers
              maxOutputTokens: isQuestionMode ? 4096 : 8192,
            },
          });

          console.log(`[bolt-generate] Using model: ${selectedModel === MODELS.PRO ? 'PRO' : 'FLASH'}, mode: ${mode}`);

          let fullResponse = '';

          // Stream text chunks as they arrive
          for await (const chunk of aiStream) {
            // Check if client disconnected
            if (isClosed || request.signal.aborted) {
              console.log('[bolt-generate] Stream cancelled - client disconnected');
              break;
            }

            const text = chunk.text || '';
            if (!text) continue;

            fullResponse += text;

            // Stream raw text for UI display
            const textEvent: BoltStreamChunk = { type: 'text', content: text };
            if (!safeEnqueue(controller, `data: ${JSON.stringify(textEvent)}\n\n`)) {
              break;
            }
          }

          // Only continue if client is still connected
          if (!isClosed && !request.signal.aborted) {
            // For question mode, skip artifact parsing (no code actions expected)
            if (!isQuestionMode) {
              // After streaming completes, parse artifacts and emit actions
              const artifacts = parseArtifacts(fullResponse);

              for (const artifact of artifacts) {
                for (const action of artifact.actions) {
                  if (isClosed) break;

                  const actionEvent: BoltStreamChunk = {
                    type: 'action',
                    action: {
                      type: action.type,
                      filePath: action.filePath,
                      content: action.content,
                    },
                  };
                  safeEnqueue(controller, `data: ${JSON.stringify(actionEvent)}\n\n`);
                }
              }
            }

            // Emit done event
            const doneEvent: BoltStreamChunk = { type: 'done' };
            safeEnqueue(controller, `data: ${JSON.stringify(doneEvent)}\n\n`);
          }

          safeClose(controller);
        } catch (error) {
          // Only log if it's not an abort error
          if (!request.signal.aborted) {
            console.error('[bolt-generate] Stream error:', error);
          }

          // Try to emit error event if still connected
          if (!isClosed) {
            const errorEvent: BoltStreamChunk = {
              type: 'error',
              message: error instanceof Error ? error.message : 'Generation failed',
            };
            safeEnqueue(controller, `data: ${JSON.stringify(errorEvent)}\n\n`);
          }

          safeClose(controller);
        }
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[bolt-generate] Request error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Request failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// =============================================================================
// OPTIONS HANDLER (CORS)
// =============================================================================

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
