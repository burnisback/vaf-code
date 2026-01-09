/**
 * Bolt Investigate API Route
 *
 * Provides server-side investigation capabilities.
 * Runs investigation before code generation to ensure
 * files are read before being modified.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createInvestigator,
  investigate,
  type InvestigationContext,
  type InvestigationResult,
} from '@/lib/bolt/investigation';
import { selectModel } from '@/lib/bolt/ai/modelRouter';
import type { RequestMode } from '@/lib/bolt/ai/classifier/types';

// =============================================================================
// TYPES
// =============================================================================

interface InvestigateRequest {
  /** User's prompt */
  prompt: string;

  /** Request mode from classifier */
  mode: RequestMode;

  /** Project context */
  projectContext: {
    /** File tree as formatted string */
    fileTree: string;
    /** List of all project files */
    projectFiles: string[];
    /** Detected framework */
    framework?: string;
    /** Detected styling solution */
    styling?: string;
    /** Language detection result */
    language?: {
      primary: 'typescript' | 'javascript';
      hasTsConfig: boolean;
    };
    /** Already identified relevant files */
    existingRelevantFiles?: Record<string, string>;
  };

  /** Errors to investigate (for debug mode) */
  errors?: string[];

  /** Investigation configuration overrides */
  config?: {
    maxFilesToRead?: number;
    maxLinesPerFile?: number;
    includeTestFiles?: boolean;
    timeout?: number;
  };
}

interface InvestigateResponse {
  /** Investigation result */
  result: InvestigationResult;

  /** Model selection info */
  modelSelection: {
    tier: string;
    reason: string;
  };

  /** Request ID for correlation */
  requestId: string;
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body: InvestigateRequest = await request.json();

    // Validate required fields
    if (!body.prompt || typeof body.prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid prompt' },
        { status: 400 }
      );
    }

    if (!body.mode) {
      return NextResponse.json(
        { error: 'Missing mode' },
        { status: 400 }
      );
    }

    if (!body.projectContext?.projectFiles) {
      return NextResponse.json(
        { error: 'Missing project files' },
        { status: 400 }
      );
    }

    // Select model for investigation (always Flash-Lite for cost efficiency)
    const modelSelection = selectModel({
      phase: 'investigate',
      mode: body.mode,
    });

    // Build investigation context
    const context: InvestigationContext = {
      prompt: body.prompt,
      mode: body.mode,
      projectFiles: body.projectContext.projectFiles,
      fileTree: body.projectContext.fileTree || '',
      framework: body.projectContext.framework,
      styling: body.projectContext.styling,
      language: body.projectContext.language,
      existingRelevantFiles: body.projectContext.existingRelevantFiles,
      errors: body.errors,
    };

    // Run investigation
    const result = await investigate(context, body.config);

    // Update token usage with model info
    result.tokenUsage.model = modelSelection.tier;

    const response: InvestigateResponse = {
      result,
      modelSelection: {
        tier: modelSelection.tier,
        reason: modelSelection.reason,
      },
      requestId,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[bolt-investigate] Error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Investigation failed',
        requestId,
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET HANDLER (for health check)
// =============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'bolt-investigate',
    version: '1.0.0',
  });
}
