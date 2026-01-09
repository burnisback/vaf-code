/**
 * Bolt Architecture API Route
 *
 * Server-side endpoint for generating technical architecture documents.
 * This keeps Genkit/OpenTelemetry server-side dependencies out of the client bundle.
 *
 * POST /api/bolt-architecture
 *
 * Request body:
 * {
 *   prdId?: string;
 *   prdData?: unknown;
 *   stackPreferences?: Partial<TechnologyStack>;
 *   focus?: ('components' | 'data' | 'api' | 'phases')[];
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   architecture?: ArchitectureDocument;
 *   error?: string;
 *   warnings?: string[];
 * }
 */

import { generateArchitecture } from '@/lib/bolt/architecture/generator';
import type { ArchitectureGenerationRequest } from '@/lib/bolt/architecture/types';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Allow longer generation time for complex architectures
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    const body = await request.json() as ArchitectureGenerationRequest;
    const { prdId, prdData, stackPreferences, focus } = body;

    // Validate request
    if (!prdId && !prdData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Either prdId or prdData is required'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[bolt-architecture] Generating architecture from PRD');

    // Generate the architecture
    const result = await generateArchitecture({
      prdId,
      prdData,
      stackPreferences,
      focus,
    });

    if (result.success) {
      console.log('[bolt-architecture] Architecture generated:', {
        name: result.architecture?.name,
        phaseCount: result.architecture?.phases.length,
        modelCount: result.architecture?.data.models.length,
        endpointCount: result.architecture?.api.endpoints.length,
        warnings: result.warnings?.length,
      });
    } else {
      console.error('[bolt-architecture] Architecture generation failed:', result.error);
    }

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[bolt-architecture] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Architecture generation failed',
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
