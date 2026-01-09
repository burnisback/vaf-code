/**
 * Bolt Refinement API Route
 *
 * Server-side endpoint for generating refinement plans to fix errors.
 * Keeps Genkit/AI dependencies on the server side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ai, MODELS } from '@/lib/ai/genkit';
import type { TaskPlan, PlanTask } from '@/lib/bolt/ai/planner';
import type { VerificationResult } from '@/lib/bolt/execution/verifier';
import { formatErrorsForAI } from '@/lib/bolt/execution/verifier';

// =============================================================================
// TYPES
// =============================================================================

interface RefinementRequest {
  /** Original plan that was executed */
  originalPlan: TaskPlan;

  /** Verification result with errors */
  verificationResult: VerificationResult;

  /** Current project context */
  projectContext: {
    fileTree: string;
    framework: string;
    styling: string;
  };

  /** Current iteration number */
  iteration: number;
}

interface RefinementResponse {
  /** Whether refinement is possible */
  canRefine: boolean;

  /** Refined plan (if canRefine is true) */
  plan?: TaskPlan;

  /** Explanation of refinement approach */
  reasoning: string;

  /** Whether to abort further refinement attempts */
  shouldAbort: boolean;

  /** Reason for aborting (if shouldAbort is true) */
  abortReason?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_ITERATIONS = 3;

const REFINEMENT_SYSTEM_PROMPT = `You are an expert at debugging and fixing code errors.

Your job is to analyze errors from a failed code generation and create a refined plan to fix them.

<rules>
1. Focus on the ROOT CAUSE, not symptoms
2. Only include tasks that need to change
3. Prefer small, focused fixes over large rewrites
4. If errors indicate missing dependencies, add npm install task first
5. If errors indicate wrong imports, fix the import statements
6. If errors indicate type issues, add proper type annotations
7. Order tasks by dependencies
</rules>

<common_fixes>
- "Cannot find module X" → npm install X or fix import path
- "Property X does not exist" → Add type annotation or check prop name
- "X is not defined" → Import the missing export or declare variable
- "Expected X but got Y" → Fix type mismatch or component props
</common_fixes>

<output_format>
First, explain your analysis of the errors (2-3 sentences).

Then output a JSON refinement plan:
\`\`\`json
{
  "summary": "Fixing [specific issues]",
  "description": "Detailed fix description",
  "tasks": [
    {
      "id": "fix-1",
      "description": "What this fix does",
      "type": "file|shell|modify",
      "filePath": "path/to/file.tsx",
      "dependsOn": [],
      "complexity": 1
    }
  ],
  "filesToCreate": [],
  "filesToModify": ["files that will be changed"],
  "dependencies": ["packages to install"]
}
\`\`\`
</output_format>`;

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as RefinementRequest;
    const { originalPlan, verificationResult, projectContext, iteration } = body;

    // Check iteration limit
    if (iteration >= MAX_ITERATIONS) {
      return NextResponse.json({
        canRefine: false,
        shouldAbort: true,
        abortReason: `Maximum refinement iterations (${MAX_ITERATIONS}) reached. Manual intervention required.`,
        reasoning: 'Iteration limit exceeded.',
      } as RefinementResponse);
    }

    // Check if there are actually errors to fix
    const totalErrors =
      verificationResult.typeErrors.length +
      verificationResult.moduleErrors.length +
      verificationResult.runtimeErrors.length;

    if (totalErrors === 0) {
      return NextResponse.json({
        canRefine: false,
        shouldAbort: false,
        reasoning: 'No errors to fix.',
      } as RefinementResponse);
    }

    // Build the refinement prompt
    const prompt = buildRefinementPrompt(
      originalPlan,
      verificationResult,
      projectContext,
      iteration
    );

    // Generate refinement plan
    const response = await ai.generate({
      model: MODELS.PRO,
      system: REFINEMENT_SYSTEM_PROMPT,
      prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    });

    // Parse the response
    const { plan, reasoning } = parseRefinementResponse(
      response.text,
      originalPlan,
      iteration
    );

    // Validate the plan has tasks
    if (!plan.tasks || plan.tasks.length === 0) {
      return NextResponse.json({
        canRefine: false,
        shouldAbort: false,
        reasoning: 'AI could not generate fix tasks. Try rephrasing your request.',
      } as RefinementResponse);
    }

    return NextResponse.json({
      canRefine: true,
      plan,
      reasoning,
      shouldAbort: false,
    } as RefinementResponse);
  } catch (error) {
    console.error('[bolt-refine] Error:', error);
    return NextResponse.json({
      canRefine: false,
      shouldAbort: true,
      abortReason: `Refinement generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      reasoning: 'Error during refinement generation.',
    } as RefinementResponse);
  }
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildRefinementPrompt(
  originalPlan: TaskPlan,
  verificationResult: VerificationResult,
  projectContext: { fileTree: string; framework: string; styling: string },
  iteration: number
): string {
  const errorText = formatErrorsForAI(verificationResult);

  return `<context>
Framework: ${projectContext.framework}
Styling: ${projectContext.styling}
Iteration: ${iteration + 1} of ${MAX_ITERATIONS}

Current file structure:
${projectContext.fileTree}
</context>

<original_plan>
Summary: ${originalPlan.summary}
Tasks executed: ${originalPlan.tasks.map(t => `- ${t.description}`).join('\n')}
Files created: ${originalPlan.filesToCreate.join(', ') || 'none'}
Files modified: ${originalPlan.filesToModify.join(', ') || 'none'}
</original_plan>

<errors_to_fix>
${errorText}
</errors_to_fix>

<instructions>
Analyze these errors and create a refinement plan to fix them.

Focus on:
1. The root cause of each error
2. Minimal changes needed to fix
3. Proper task ordering (install deps before using them)

If the errors seem unfixable or require major architectural changes, explain why and suggest aborting.
</instructions>`;
}

// =============================================================================
// RESPONSE PARSER
// =============================================================================

function parseRefinementResponse(
  responseText: string,
  originalPlan: TaskPlan,
  iteration: number
): { plan: TaskPlan; reasoning: string } {
  // Extract JSON from response
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1] : responseText;

  const jsonStart = jsonText.indexOf('{');
  const jsonEnd = jsonText.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No JSON found in refinement response');
  }

  const cleanJson = jsonText.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(cleanJson);

  const plan: TaskPlan = {
    id: `refine_${Date.now()}`,
    summary: parsed.summary || `Refinement ${iteration + 1}`,
    description: parsed.description || 'Fixing errors from previous execution',
    tasks: (parsed.tasks || []).map((t: Record<string, unknown>, index: number) => ({
      id: t.id || `fix_${index + 1}`,
      description: t.description || `Fix ${index + 1}`,
      type: t.type || 'modify',
      filePath: t.filePath,
      command: t.command,
      status: 'pending' as const,
      dependsOn: t.dependsOn || [],
      complexity: Math.min(5, Math.max(1, (t.complexity as number) || 2)),
    })) as PlanTask[],
    filesToCreate: parsed.filesToCreate || [],
    filesToModify: parsed.filesToModify || [],
    dependencies: parsed.dependencies || [],
    createdAt: Date.now(),
    status: 'draft',
    iteration: iteration + 1,
  };

  const reasoning = responseText.slice(0, jsonStart).trim() ||
    'Analyzing errors and generating fixes.';

  return { plan, reasoning };
}
