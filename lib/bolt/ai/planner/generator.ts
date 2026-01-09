/**
 * Plan Generator (Server-Side Only)
 *
 * This file contains genkit-dependent code for generating plans.
 * ONLY import this file in server-side code (API routes).
 */

import { ai } from '@/lib/ai/genkit';
import { PLANNING_SYSTEM_PROMPT, buildPlanningPrompt } from './prompts';
import type {
  TaskPlan,
  PlanTask,
  TaskType,
  PlanGenerationRequest,
  PlanGenerationResponse,
} from './types';
import { validatePlan } from './utils';
import {
  selectAndGetModel,
  formatSelectionLog,
} from '../modelRouter';

// =============================================================================
// MAIN PLANNER FUNCTION
// =============================================================================

/**
 * Generate a task plan for a complex request
 * NOTE: This function uses genkit and must only be called from server-side code
 */
export async function generatePlan(
  request: PlanGenerationRequest
): Promise<PlanGenerationResponse> {
  const { prompt, projectContext, conversationHistory, mode, complexityScore } = request;

  // Build the planning prompt
  const planningPrompt = buildPlanningPrompt(
    prompt,
    projectContext,
    conversationHistory
  );

  // Select model using smart router (Flash for most, Pro for mega-complex)
  const { model, selection } = selectAndGetModel({
    phase: 'plan',
    mode: mode || 'moderate',
    complexityScore,
  });
  console.log(formatSelectionLog({ phase: 'plan', mode: mode || 'moderate', complexityScore }, selection));

  // Generate plan
  const response = await ai.generate({
    model,
    system: PLANNING_SYSTEM_PROMPT,
    prompt: planningPrompt,
    config: {
      temperature: 0.2, // Low temperature for consistent planning
      maxOutputTokens: 4096,
    },
  });

  // Parse the response
  const { plan, reasoning } = parsePlanResponse(response.text);

  // Validate the plan
  const validation = validatePlan(plan);
  if (!validation.valid) {
    console.warn('[Planner] Plan validation warnings:', validation.warnings);
    if (validation.errors.length > 0) {
      throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
    }
  }

  return { plan, reasoning };
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

/**
 * Parse the AI response into a structured plan
 */
function parsePlanResponse(responseText: string): {
  plan: TaskPlan;
  reasoning: string;
} {
  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1] : responseText;

  // Try to find JSON object in the text
  const jsonStart = jsonText.indexOf('{');
  const jsonEnd = jsonText.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Failed to parse plan: No JSON found in response');
  }

  const cleanJson = jsonText.slice(jsonStart, jsonEnd + 1);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (e) {
    throw new Error(`Failed to parse plan JSON: ${e}`);
  }

  // Validate and transform
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const plan: TaskPlan = {
    id: `plan_${Date.now()}`,
    summary: String(parsed.summary || 'Implementation Plan'),
    description: String(parsed.description || ''),
    tasks: tasks.map((t: Record<string, unknown>, index: number) => ({
      id: String(t.id || `task_${index + 1}`),
      description: String(t.description || `Task ${index + 1}`),
      type: validateTaskType(String(t.type || 'file')),
      filePath: t.filePath ? String(t.filePath) : undefined,
      command: t.command ? String(t.command) : undefined,
      status: 'pending' as const,
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.map(String) : [],
      complexity: Math.min(5, Math.max(1, Number(t.complexity) || 2)),
    })),
    filesToCreate: Array.isArray(parsed.filesToCreate)
      ? parsed.filesToCreate.map(String)
      : [],
    filesToModify: Array.isArray(parsed.filesToModify)
      ? parsed.filesToModify.map(String)
      : [],
    dependencies: Array.isArray(parsed.dependencies)
      ? parsed.dependencies.map(String)
      : [],
    createdAt: Date.now(),
    status: 'draft',
    iteration: 1,
  };

  // Calculate total complexity
  plan.totalComplexity = plan.tasks.reduce((sum, task) => sum + task.complexity, 0);

  // Extract reasoning (text before JSON)
  const reasoning =
    responseText.slice(0, jsonStart).trim() ||
    'Plan generated based on request analysis.';

  return { plan, reasoning };
}

/**
 * Validate task type string
 */
function validateTaskType(type: string): TaskType {
  const validTypes: TaskType[] = ['file', 'shell', 'modify', 'delete'];
  if (validTypes.includes(type as TaskType)) {
    return type as TaskType;
  }
  return 'file'; // Default to file
}
