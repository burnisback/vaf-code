/**
 * Project Analysis API Route
 *
 * Analyzes project structure and files using Gemini AI
 * Returns a comprehensive JSON summary
 *
 * Client-side change detection:
 * - Client computes hashes and determines changed files
 * - Client only sends changed files to analyze
 * - Client sends cached analyses for unchanged files
 */

import { NextResponse } from 'next/server';
import {
  analyzeProject,
  quickAnalyze,
  type ProjectSummary,
  type ProjectSummaryWithHashes,
  type AnalysisStats,
  type FileAnalysis,
} from '@/lib/ai/projectAnalyzer';
import type { FileNode } from '@/lib/ai/context/fileTreeScanner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface AnalyzeRequest {
  fileTree: FileNode[];
  /** Only changed files (client filters) */
  fileContents?: Record<string, string>;
  /** Cached analyses for unchanged files (from client) */
  cachedAnalyses?: FileAnalysis[];
  packageJson?: Record<string, unknown>;
  mode?: 'quick' | 'full';
  maxFiles?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as AnalyzeRequest;
    const {
      fileTree,
      fileContents,
      cachedAnalyses,
      packageJson,
      mode = 'quick',
      maxFiles = 50,
    } = body;

    if (!fileTree || !Array.isArray(fileTree)) {
      return NextResponse.json(
        { error: 'fileTree is required and must be an array' },
        { status: 400 }
      );
    }

    console.log('[Project Analyze API] Request received:', {
      fileTreeLength: fileTree.length,
      fileContentsCount: fileContents ? Object.keys(fileContents).length : 0,
      cachedAnalysesCount: cachedAnalyses?.length || 0,
      mode,
      maxFiles,
    });

    let summary: ProjectSummary | ProjectSummaryWithHashes | Omit<ProjectSummary, 'files' | 'insights'>;
    let stats: AnalysisStats | undefined;

    if (mode === 'full' && fileContents) {
      const contentsMap = new Map(Object.entries(fileContents));
      const result = await analyzeProject(fileTree, contentsMap, packageJson, {
        cachedAnalyses,
        maxFiles,
      });
      summary = result;
      stats = result.analysisStats;
    } else {
      summary = quickAnalyze(fileTree, packageJson);
    }

    console.log('[Project Analyze API] Analysis complete:', {
      name: summary.name,
      framework: summary.technology.framework,
      totalFiles: summary.structure.totalFiles,
      ...(stats && {
        apiCallsMade: stats.apiCallsMade,
        analyzedFiles: stats.analyzedFiles,
        cachedFiles: stats.cachedFiles,
      }),
    });

    return NextResponse.json({
      success: true,
      summary,
      stats,
    });
  } catch (error) {
    console.error('[Project Analyze API] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service not configured. Please add GEMINI_API_KEY to environment.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to analyze project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/project/analyze',
    methods: ['POST'],
    description: 'Analyze project structure and files using Gemini AI',
  });
}
