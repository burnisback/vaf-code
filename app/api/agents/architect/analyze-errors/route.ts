/**
 * VAF-ARCHITECT Error Analysis Endpoint
 *
 * Uses AI to analyze build errors and return a structured fix plan.
 * Returns structured fix plan for dependency issues or code fixes.
 */

import { NextResponse } from 'next/server';
import { ai, MODELS } from '@/lib/ai/genkit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ErrorAnalysisRequest {
  workItemId: string;
  buildErrors: string;
  affectedFiles: string[];  // Files that were just created/modified
  projectFiles?: string[];  // List of all project files for context
}

interface DependencyFix {
  type: 'install-dependency';
  packages: string[];
  reason: string;
}

interface CodeFix {
  type: 'code-fix';
  file: string;
  issue: string;
  suggestedFix: string;
}

interface ErrorAnalysisResponse {
  workItemId: string;
  status: 'fixable' | 'needs-investigation' | 'unfixable';
  rootCause: string;
  fixes: (DependencyFix | CodeFix)[];
  allAffectedFiles: string[];  // ALL files with this issue, not just the first one
  fixOrder: string[];  // Order to apply fixes
  additionalContext?: string;
}

// =============================================================================
// ERROR ANALYSIS SYSTEM PROMPT
// =============================================================================

const ERROR_ANALYSIS_PROMPT = `You are VAF-ARCHITECT analyzing build errors to create a fix plan.

## YOUR TASK
Analyze the build error output and determine:
1. What is the ROOT CAUSE of the error?
2. Is it a dependency issue (missing npm package) or a code issue?
3. Which files are affected? (List ALL files, not just the first one mentioned)
4. What is the fix strategy?

## OUTPUT FORMAT
Return valid JSON only (no markdown):

{
  "status": "fixable" | "needs-investigation" | "unfixable",
  "rootCause": "Clear explanation of what's causing the error",
  "fixes": [
    {
      "type": "install-dependency",
      "packages": ["package-name"],
      "reason": "Why this package is needed"
    }
    // OR
    {
      "type": "code-fix",
      "file": "src/components/Example.jsx",
      "issue": "What's wrong in this file",
      "suggestedFix": "Specific instructions on how to fix it"
    }
  ],
  "allAffectedFiles": ["file1.jsx", "file2.jsx"],
  "fixOrder": ["First fix this", "Then fix that"],
  "additionalContext": "Any other relevant information"
}

## ANALYSIS RULES

### Dependency Errors
Look for patterns like:
- "Failed to resolve import 'X'" → Need to install X
- "Cannot find module 'X'" → Need to install X
- "Module not found: Can't resolve 'X'" → Need to install X

Common packages:
- prop-types → npm install prop-types
- react-router-dom → npm install react-router-dom
- axios → npm install axios
- lodash → npm install lodash

### Code Errors
- Syntax errors → Identify the exact line and fix
- Import errors for local files → Check file paths
- Type errors → Fix the type issue
- Undefined variables → Add missing declarations

### CRITICAL
- List ALL affected files, not just the first one in the error
- If the same error appears in multiple files, include ALL of them
- For dependency errors, ONE install fixes ALL files using that dependency

## EXAMPLE

Input error:
"[vite]: Rollup failed to resolve import "prop-types" from "src/components/Button.jsx"
[vite]: Rollup failed to resolve import "prop-types" from "src/components/TextField.jsx""

Output:
{
  "status": "fixable",
  "rootCause": "The 'prop-types' package is not installed but is being imported in multiple components",
  "fixes": [
    {
      "type": "install-dependency",
      "packages": ["prop-types"],
      "reason": "Required for PropTypes validation in React components"
    }
  ],
  "allAffectedFiles": ["src/components/Button.jsx", "src/components/TextField.jsx"],
  "fixOrder": ["Install prop-types package - this will fix all affected files"],
  "additionalContext": "After installing, rebuild to verify the fix"
}

Now analyze the provided build errors.`;

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json() as ErrorAnalysisRequest;
    const { workItemId, buildErrors, affectedFiles, projectFiles } = body;

    if (!workItemId || !buildErrors) {
      return NextResponse.json(
        { error: 'workItemId and buildErrors are required' },
        { status: 400 }
      );
    }

    console.log('[VAF-ARCHITECT:ERROR-ANALYSIS] Analyzing errors:', {
      workItemId,
      errorLength: buildErrors.length,
      affectedFilesCount: affectedFiles?.length || 0,
    });

    const userMessage = `## BUILD ERRORS TO ANALYZE

\`\`\`
${buildErrors}
\`\`\`

## FILES THAT WERE JUST CREATED/MODIFIED
${affectedFiles?.map(f => `- ${f}`).join('\n') || 'None specified'}

${projectFiles ? `## ALL PROJECT FILES\n${projectFiles.map(f => `- ${f}`).join('\n')}` : ''}

Analyze these errors and return the fix plan as JSON.`;

    // Call AI for analysis
    const response = await ai.generate({
      model: MODELS.FLASH,
      system: ERROR_ANALYSIS_PROMPT,
      prompt: userMessage,
      config: {
        temperature: 0.2,  // Low temperature for accurate analysis
        maxOutputTokens: 2048,
      },
    });

    const responseText = response.text || '{}';

    // Parse the JSON response
    let analysisResponse: Omit<ErrorAnalysisResponse, 'workItemId'>;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      analysisResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[VAF-ARCHITECT:ERROR-ANALYSIS] Failed to parse response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse error analysis response', raw: responseText },
        { status: 500 }
      );
    }

    console.log('[VAF-ARCHITECT:ERROR-ANALYSIS] Analysis complete:', {
      workItemId,
      status: analysisResponse.status,
      fixCount: analysisResponse.fixes?.length || 0,
      affectedFiles: analysisResponse.allAffectedFiles?.length || 0,
    });

    return NextResponse.json({
      workItemId,
      ...analysisResponse,
    });

  } catch (error) {
    console.error('[VAF-ARCHITECT:ERROR-ANALYSIS] Error:', error);

    return NextResponse.json(
      { error: 'Error analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: 'VAF-ARCHITECT',
    capability: 'Error Analysis',
    endpoint: '/api/agents/architect/analyze-errors',
    methods: ['POST'],
    description: 'Analyzes build errors using AI and returns structured fix plans',
    inputContract: {
      workItemId: 'string (required)',
      buildErrors: 'string (required) - Raw build error output',
      affectedFiles: 'string[] (optional) - Files that were created/modified',
      projectFiles: 'string[] (optional) - All project files for context',
    },
    outputContract: {
      workItemId: 'string',
      status: 'fixable | needs-investigation | unfixable',
      rootCause: 'string',
      fixes: 'Array of DependencyFix or CodeFix objects',
      allAffectedFiles: 'string[]',
      fixOrder: 'string[]',
    },
  });
}
