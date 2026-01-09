/**
 * Bolt Plan API Route
 *
 * Server-side endpoint for generating task plans.
 * This keeps Genkit/OpenTelemetry server-side dependencies out of the client bundle.
 *
 * POST /api/bolt-plan
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
 * }
 *
 * Response:
 * {
 *   plan: TaskPlan;
 *   reasoning: string;
 * }
 */

import { generatePlan } from '@/lib/bolt/ai/planner/generator';
import type { PlanGenerationRequest } from '@/lib/bolt/ai/planner';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Allow longer generation time for complex plans
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as PlanGenerationRequest;
    const { prompt, projectContext, conversationHistory } = body;

    // Validate request
    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!projectContext) {
      return new Response(
        JSON.stringify({ error: 'Missing projectContext' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[bolt-plan] Generating plan for:', prompt.slice(0, 100));

    // Generate the plan
    const result = await generatePlan({
      prompt,
      projectContext,
      conversationHistory,
    });

    console.log('[bolt-plan] Plan generated:', {
      taskCount: result.plan.tasks.length,
      complexity: result.plan.totalComplexity,
    });

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[bolt-plan] Error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Plan generation failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

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
