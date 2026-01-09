/**
 * Bolt Debug API Route
 *
 * Server-side endpoint for analyzing runtime errors and generating fixes.
 *
 * POST /api/bolt-debug
 *
 * Request body:
 * {
 *   error: RuntimeError;
 *   context: {
 *     previousAttempts: FixAttempt[];
 *     relevantFiles: { path: string; content: string }[];
 *     projectPatterns?: ProjectPatterns;
 *   };
 * }
 *
 * Response:
 * {
 *   analysis: ErrorAnalysis;
 *   proposedActions: BoltAction[];
 * }
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import {
  buildContextAwareDebugPrompt,
  DEBUG_SYSTEM_PROMPT,
  detectProjectPatterns,
} from '@/lib/bolt/debug';
import type {
  RuntimeError,
  FixAttempt,
  ErrorAnalysis,
  BoltAction,
  ProjectPatterns,
} from '@/lib/bolt/types';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Allow longer generation time for complex analysis
export const maxDuration = 60;

// =============================================================================
// TYPES
// =============================================================================

interface DebugRequest {
  error: RuntimeError;
  context: {
    previousAttempts: FixAttempt[];
    relevantFiles: { path: string; content: string }[];
    projectPatterns?: ProjectPatterns;
  };
}

interface DebugResponse {
  analysis: ErrorAnalysis;
  proposedActions: BoltAction[];
}

// =============================================================================
// PARSING HELPERS
// =============================================================================

function extractTag(content: string, tag: string): string | null {
  const match = content.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : null;
}

function parseAnalysis(content: string): ErrorAnalysis {
  const analysisMatch = content.match(/<analysis>([\s\S]*?)<\/analysis>/);

  if (!analysisMatch) {
    return {
      rootCause: 'Unable to determine root cause from AI response',
      affectedFiles: [],
      suggestedApproach: 'Manual investigation required',
      confidence: 'low',
    };
  }

  const analysisContent = analysisMatch[1];

  const affectedFilesRaw = extractTag(analysisContent, 'affectedFiles') || '';
  const affectedFiles = affectedFilesRaw
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  const confidence = extractTag(analysisContent, 'confidence') as
    | 'high'
    | 'medium'
    | 'low'
    | null;

  return {
    rootCause: extractTag(analysisContent, 'rootCause') || 'Unknown root cause',
    affectedFiles,
    suggestedApproach: extractTag(analysisContent, 'approach') || 'Unknown approach',
    confidence: confidence || 'low',
  };
}

function parseVafArtifact(content: string): BoltAction[] {
  const actions: BoltAction[] = [];

  // Match vafArtifact blocks
  const artifactMatch = content.match(
    /<vafArtifact[^>]*>([\s\S]*?)<\/vafArtifact>/i
  );

  if (!artifactMatch) {
    return actions;
  }

  const artifactContent = artifactMatch[1];

  // Match all vafAction elements
  const actionRegex =
    /<vafAction\s+type="(file|shell)"(?:\s+filePath="([^"]*)")?\s*>([\s\S]*?)<\/vafAction>/gi;

  let actionMatch;
  while ((actionMatch = actionRegex.exec(artifactContent)) !== null) {
    const type = actionMatch[1] as 'file' | 'shell';
    const filePath = actionMatch[2];
    const actionContent = actionMatch[3].trim();

    actions.push({
      type,
      filePath: type === 'file' ? filePath : undefined,
      content: actionContent,
      status: 'pending',
      operation: type === 'file' ? 'modify' : undefined,
    });
  }

  return actions;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DebugRequest;
    const { error, context } = body;

    // Validate request
    if (!error || !error.message) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid error' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[bolt-debug] Analyzing error:', error.message.slice(0, 100));

    // Detect project patterns if not provided
    const projectPatterns =
      context.projectPatterns ||
      detectProjectPatterns(context.relevantFiles || []);

    // Build the prompt
    const prompt = buildContextAwareDebugPrompt(error, {
      previousAttempts: context.previousAttempts || [],
      relevantFiles: context.relevantFiles || [],
      projectPatterns,
    });

    // Call Gemini API via Genkit
    const response = await ai.generate({
      model: MODELS.PRO,
      system: DEBUG_SYSTEM_PROMPT,
      prompt: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    // Extract text content
    const responseText = response.text || '';

    // Parse the response
    const analysis = parseAnalysis(responseText);
    const proposedActions = parseVafArtifact(responseText);

    console.log('[bolt-debug] Analysis complete:', {
      rootCause: analysis.rootCause.slice(0, 50),
      confidence: analysis.confidence,
      actionsCount: proposedActions.length,
    });

    const result: DebugResponse = {
      analysis,
      proposedActions,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[bolt-debug] Error:', err);

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Debug analysis failed',
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
