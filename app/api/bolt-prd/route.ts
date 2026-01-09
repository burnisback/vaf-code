/**
 * Bolt PRD API Route
 *
 * Server-side endpoint for generating Product Requirements Documents.
 * This keeps Genkit/OpenTelemetry server-side dependencies out of the client bundle.
 *
 * POST /api/bolt-prd
 *
 * Request body:
 * {
 *   researchId?: string;
 *   researchData?: unknown;
 *   productName?: string;
 *   additionalContext?: string;
 *   focusAreas?: string[];
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   prd?: ProductRequirementsDocument;
 *   analysis?: ResearchAnalysis;
 *   error?: string;
 *   suggestions?: string[];
 * }
 */

import { generatePRD } from '@/lib/bolt/product/generator';
import type { PRDGenerationRequest } from '@/lib/bolt/product/types';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Allow longer generation time for complex PRDs
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json() as PRDGenerationRequest;
    const { researchId, researchData, productName, additionalContext, focusAreas } = body;

    // Validate request
    if (!researchId && !researchData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Either researchId or researchData is required'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[bolt-prd] Generating PRD for:', productName || 'unnamed product');

    // Generate the PRD
    const result = await generatePRD({
      researchId,
      researchData,
      productName,
      additionalContext,
      focusAreas,
    });

    if (result.success) {
      console.log('[bolt-prd] PRD generated:', {
        name: result.prd?.name,
        featureCount: result.prd?.features.length,
        suggestions: result.suggestions?.length,
      });
    } else {
      console.error('[bolt-prd] PRD generation failed:', result.error);
    }

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[bolt-prd] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'PRD generation failed',
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
