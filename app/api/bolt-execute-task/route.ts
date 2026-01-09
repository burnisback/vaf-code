/**
 * Bolt Execute Task API Route
 *
 * Server-side endpoint for generating code for a single plan task.
 * This keeps Genkit/OpenTelemetry server-side dependencies out of the client bundle.
 *
 * POST /api/bolt-execute-task
 *
 * Request body:
 * {
 *   task: PlanTask;
 *   plan: TaskPlan;
 *   projectContext: {
 *     fileTree: string;
 *     framework: string;
 *     styling: string;
 *   };
 *   existingFileContent?: string;
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   files?: { path: string; content: string }[];
 *   error?: string;
 * }
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import { BOLT_SYSTEM_PROMPT } from '@/lib/bolt/ai/prompts';
import { parseArtifacts } from '@/lib/bolt/ai/parser';
import type { PlanTask, TaskPlan } from '@/lib/bolt/ai/planner';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Allow longer generation time
export const maxDuration = 60;

// =============================================================================
// TYPES
// =============================================================================

interface ExecuteTaskRequest {
  task: PlanTask;
  plan: TaskPlan;
  projectContext: {
    fileTree: string;
    framework: string;
    styling: string;
  };
  existingFileContent?: string | null;
}

interface ExecuteTaskResponse {
  success: boolean;
  files?: { path: string; content: string }[];
  error?: string;
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildTaskPrompt(
  task: PlanTask,
  plan: TaskPlan,
  projectContext: { fileTree: string; framework: string; styling: string },
  existingContent: string | null
): string {
  const parts: string[] = [];

  // Task context
  parts.push(`<task_context>
You are executing task "${task.id}" of plan "${plan.summary}".

Task Description: ${task.description}
${task.filePath ? `Target File: ${task.filePath}` : ''}
Task Type: ${task.type}

Plan Overview: ${plan.description}
</task_context>`);

  // Project context
  parts.push(`<project_context>
Framework: ${projectContext.framework}
Styling: ${projectContext.styling}

File Structure:
${projectContext.fileTree || '(empty project)'}
</project_context>`);

  // Existing file content for modifications
  if (existingContent && task.type === 'modify') {
    parts.push(`<existing_file path="${task.filePath}">
${existingContent}
</existing_file>`);
  }

  // Instructions
  parts.push(`<instructions>
Generate the complete code for this specific task.

${task.type === 'modify'
  ? 'Modify the existing file to implement the required changes. Preserve existing functionality unless explicitly changing it.'
  : 'Create the new file with all necessary code.'}

REQUIREMENTS:
- Provide COMPLETE, working code - no placeholders or TODOs
- Follow the project's existing patterns and conventions
- Use TypeScript with proper types
- Use Tailwind CSS for styling
- Include all necessary imports
- Export components/functions appropriately

RESPONSE FORMAT:
Wrap your code in vafArtifact/vafAction tags:

<vafArtifact title="Task: ${task.description}">
<vafAction type="file" filePath="${task.filePath || 'src/components/NewComponent.tsx'}">
// Your complete code here
</vafAction>
</vafArtifact>
</instructions>`);

  return parts.join('\n\n');
}

// =============================================================================
// CODE EXTRACTION FALLBACK
// =============================================================================

function extractCodeFromResponse(response: string, filePath: string): string | null {
  // Try to find code blocks
  const codeBlockMatch = response.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // If response looks like code (starts with import/export/const/function), use it
  const trimmed = response.trim();
  if (/^(import|export|const|let|var|function|class|interface|type|'use client'|"use client")/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as ExecuteTaskRequest;
    const { task, plan, projectContext, existingFileContent } = body;

    // Validate request
    if (!task || !plan) {
      return Response.json(
        { success: false, error: 'Missing task or plan' } as ExecuteTaskResponse,
        { status: 400 }
      );
    }

    // Shell tasks don't need code generation
    if (task.type === 'shell') {
      return Response.json({
        success: true,
        files: [],
      } as ExecuteTaskResponse);
    }

    // File tasks need a path
    if (!task.filePath) {
      return Response.json(
        { success: false, error: 'File task missing filePath' } as ExecuteTaskResponse,
        { status: 400 }
      );
    }

    console.log('[bolt-execute-task] Generating code for:', task.description);

    // Build the prompt
    const prompt = buildTaskPrompt(
      task,
      plan,
      projectContext,
      existingFileContent || null
    );

    // Generate code
    const response = await ai.generate({
      model: MODELS.FLASH,
      system: BOLT_SYSTEM_PROMPT,
      prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    const responseText = response.text;

    // Parse artifacts from response
    const artifacts = parseArtifacts(responseText);
    const files: { path: string; content: string }[] = [];

    if (artifacts.length > 0) {
      // Extract files from artifacts
      for (const artifact of artifacts) {
        for (const action of artifact.actions) {
          if (action.type === 'file' && action.filePath) {
            files.push({
              path: action.filePath,
              content: action.content,
            });
          }
        }
      }
    }

    // Fallback: try to extract code directly if no artifacts found
    if (files.length === 0) {
      const extractedCode = extractCodeFromResponse(responseText, task.filePath);
      if (extractedCode) {
        files.push({
          path: task.filePath,
          content: extractedCode,
        });
      }
    }

    if (files.length === 0) {
      console.error('[bolt-execute-task] No code generated for task:', task.description);
      return Response.json({
        success: false,
        error: 'No code generated for this task',
      } as ExecuteTaskResponse);
    }

    console.log('[bolt-execute-task] Generated', files.length, 'file(s) for:', task.description);

    return Response.json({
      success: true,
      files,
    } as ExecuteTaskResponse);
  } catch (error) {
    console.error('[bolt-execute-task] Error:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Task execution failed',
      } as ExecuteTaskResponse,
      { status: 500 }
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
