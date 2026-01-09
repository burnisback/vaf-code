/**
 * Bolt Classify API Route
 *
 * Server-side endpoint for LLM-based request classification.
 * This keeps Genkit/OpenTelemetry server-side dependencies out of the client bundle.
 *
 * POST /api/bolt-classify
 *
 * Request body:
 * {
 *   prompt: string;
 *   timeout?: number; // Optional timeout in ms (default: 3000)
 * }
 *
 * Response:
 * {
 *   result: ClassificationResult | null;
 *   usedLLM: boolean;
 * }
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import type {
  ClassificationResult,
  RequestMode,
  RequestDomain,
  MegaComplexIndicators,
} from '@/lib/bolt/ai/classifier/types';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Allow time for LLM classification
export const maxDuration = 10;

// =============================================================================
// CLASSIFICATION PROMPT
// =============================================================================

const CLASSIFICATION_SYSTEM_PROMPT = `You are a code complexity classifier for a web development AI assistant. Your job is to analyze user requests and determine how complex they are to implement.

You must respond with ONLY valid JSON, no markdown formatting, no code blocks, no explanation outside the JSON.`;

function buildClassificationPrompt(userPrompt: string): string {
  return `Analyze this request and classify its complexity:

"${userPrompt}"

Respond with this exact JSON structure:
{
  "isQuestion": boolean,
  "estimatedFiles": number,
  "domains": string[],
  "complexityScore": number,
  "needsResearch": boolean,
  "needsPlanning": boolean,
  "reasoning": string
}

Field definitions:
- isQuestion: true ONLY if asking for explanation/information, NOT requesting code changes
- estimatedFiles: number of files to create/modify (1-2=simple, 3-5=moderate, 6-15=complex, 16+=mega)
- domains: array from ["frontend", "backend", "database", "auth", "api", "styling", "testing", "infrastructure"]
- complexityScore: 1-3=simple, 4-9=moderate, 10-15=complex, 16+=mega-complex
- needsResearch: true only if requires competitor analysis, market research, or studying external systems
- needsPlanning: true if complex enough to benefit from a step-by-step plan before execution
- reasoning: brief 1-sentence explanation of your classification

IMPORTANT - Consider implicit complexity:
- "validation" = validation logic + error handling + error display + types
- "persists/saves/remembers" = storage layer (localStorage, database, cookies)
- "authentication/login" = auth flow + protected routes + session + multiple pages
- "form with X fields" = form component + state + validation + submission handling
- "modal/dialog" = component + state management + backdrop + accessibility
- "dark mode" = theme context + toggle UI + CSS variables + persistence
- "navigation with pages" = navbar + routing setup + page components
- "list of X" = list component + item component + data structure
- "with X and Y and Z" = multiple features compound complexity
- "full/complete/entire/comprehensive" = thorough implementation`;
}

// =============================================================================
// TYPES
// =============================================================================

interface LLMClassificationResponse {
  isQuestion: boolean;
  estimatedFiles: number;
  domains: string[];
  complexityScore: number;
  needsResearch: boolean;
  needsPlanning: boolean;
  reasoning: string;
}

interface ClassifyRequest {
  prompt: string;
  timeout?: number;
}

interface ClassifyResponse {
  result: ClassificationResult | null;
  usedLLM: boolean;
}

// =============================================================================
// PARSING HELPERS
// =============================================================================

function parseClassificationResponse(text: string): LLMClassificationResponse | null {
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (
      typeof parsed.isQuestion !== 'boolean' ||
      typeof parsed.estimatedFiles !== 'number' ||
      !Array.isArray(parsed.domains) ||
      typeof parsed.complexityScore !== 'number'
    ) {
      return null;
    }

    return {
      isQuestion: parsed.isQuestion,
      estimatedFiles: Math.max(0, Math.round(parsed.estimatedFiles)),
      domains: parsed.domains.filter((d: unknown) => typeof d === 'string'),
      complexityScore: Math.max(1, Math.min(20, parsed.complexityScore)),
      needsResearch: Boolean(parsed.needsResearch),
      needsPlanning: Boolean(parsed.needsPlanning),
      reasoning: String(parsed.reasoning || ''),
    };
  } catch {
    return null;
  }
}

function convertToClassificationResult(
  llmResponse: LLMClassificationResponse,
): ClassificationResult {
  // Determine mode from complexity score
  let mode: RequestMode;
  let confidence: number;

  if (llmResponse.isQuestion) {
    mode = 'question';
    confidence = 0.9;
  } else if (llmResponse.needsResearch && llmResponse.complexityScore >= 12) {
    mode = 'mega-complex';
    confidence = 0.85;
  } else if (llmResponse.complexityScore >= 10 || llmResponse.estimatedFiles >= 6) {
    mode = 'complex';
    confidence = 0.8;
  } else if (llmResponse.complexityScore >= 4 || llmResponse.estimatedFiles >= 3) {
    mode = 'moderate';
    confidence = 0.85;
  } else {
    mode = 'simple';
    confidence = 0.9;
  }

  // Map domains to valid RequestDomain values
  const validDomains: RequestDomain[] = llmResponse.domains.filter(
    (d): d is RequestDomain =>
      ['frontend', 'backend', 'database', 'auth', 'api', 'styling', 'testing', 'infrastructure'].includes(d)
  );

  // Build mega-complex indicators if needed
  let megaComplexIndicators: MegaComplexIndicators | undefined;
  if (mode === 'mega-complex') {
    megaComplexIndicators = {
      needsResearch: llmResponse.needsResearch,
      needsProductDefinition: llmResponse.needsPlanning,
      needsArchitecture: llmResponse.estimatedFiles >= 10,
      hasMultiplePhases: llmResponse.estimatedFiles >= 15,
      researchKeywords: llmResponse.needsResearch ? ['research'] : [],
      productKeywords: llmResponse.needsPlanning ? ['build', 'create'] : [],
      scaleIndicators: llmResponse.complexityScore >= 15 ? ['comprehensive'] : [],
    };
  }

  return {
    mode,
    estimatedFiles: llmResponse.estimatedFiles,
    domains: validDomains,
    confidence,
    reasoning: `[AI] ${llmResponse.reasoning || `Complexity score: ${llmResponse.complexityScore}, ${llmResponse.estimatedFiles} files, ${validDomains.length} domains`}`,
    detectedKeywords: [], // LLM doesn't use keywords
    megaComplexIndicators,
  };
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json() as ClassifyRequest;
    const { prompt, timeout = 3000 } = body;

    // Validate request
    if (!prompt || typeof prompt !== 'string') {
      return Response.json(
        { error: 'Missing or invalid prompt' },
        { status: 400 }
      );
    }

    const classificationPrompt = buildClassificationPrompt(prompt);

    // Create a timeout promise to race against the LLM call
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeout);
    });

    // Call the LLM with a race against the timeout
    const response = await Promise.race([
      ai.generate({
        model: MODELS.FLASH,
        system: CLASSIFICATION_SYSTEM_PROMPT,
        prompt: classificationPrompt,
        config: {
          temperature: 0.1, // Low temperature for consistent classification
          maxOutputTokens: 512, // Classification response is small
        },
      }),
      timeoutPromise,
    ]);

    // If timeout won or response is null
    if (response === null) {
      console.warn('[API/bolt-classify] Classification timed out');
      return Response.json({
        result: null,
        usedLLM: false,
      } satisfies ClassifyResponse);
    }

    const responseText = response.text?.trim() || '';

    // Parse the JSON response
    const parsed = parseClassificationResponse(responseText);
    if (!parsed) {
      console.warn('[API/bolt-classify] Failed to parse LLM response');
      return Response.json({
        result: null,
        usedLLM: false,
      } satisfies ClassifyResponse);
    }

    // Convert to ClassificationResult
    const result = convertToClassificationResult(parsed);

    return Response.json({
      result,
      usedLLM: true,
    } satisfies ClassifyResponse);

  } catch (error) {
    console.error('[API/bolt-classify] Error:', error);
    return Response.json({
      result: null,
      usedLLM: false,
    } satisfies ClassifyResponse);
  }
}
