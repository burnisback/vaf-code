/**
 * Bolt Generate API Route
 *
 * Unified generator endpoint that streams AI responses as SSE.
 * Parses vafArtifact/vafAction tags and emits structured actions.
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
 *     existingFiles?: { path: string; content: string }[];
 *   };
 *   conversationHistory?: { role: string; content: string }[];
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

// Force dynamic rendering for streaming
export const dynamic = 'force-dynamic';

// Allow longer generation time
export const maxDuration = 60;

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json() as BoltGenerateRequest;
    const { prompt, projectContext, conversationHistory } = body;

    // Validate request
    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build the full prompt with context
    const contextualPrompt = buildContextualPrompt(
      prompt,
      projectContext || { fileTree: '', framework: 'React + Vite', styling: 'Tailwind CSS' },
      conversationHistory?.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    );

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
          // Generate with streaming
          const { stream: aiStream } = await ai.generateStream({
            model: MODELS.FLASH,
            system: BOLT_SYSTEM_PROMPT,
            prompt: contextualPrompt,
            config: {
              temperature: 0.4,
              maxOutputTokens: 8192,
            },
          });

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
