/**
 * Phase Planner (Client-Safe)
 *
 * Creates executable implementation phases from architecture.
 * No genkit or Node.js-specific dependencies.
 */

import type {
  ArchitectureDocument,
  ImplementationPhase,
  ImplementationTask,
} from './types';
import type { ProductRequirementsDocument, FeatureSpecification } from '../product/types';
import type { TaskPlan, PlanTask } from '../ai/planner/types';

// =============================================================================
// TYPES
// =============================================================================

export interface PhaseConversionResult {
  /** Converted task plans for each phase */
  plans: TaskPlan[];

  /** Total estimated complexity */
  totalComplexity: number;

  /** Suggested execution order */
  executionOrder: string[];
}

// =============================================================================
// PHASE CONVERTER
// =============================================================================

/**
 * Convert architecture phases to executable task plans
 */
export function convertPhasesToPlans(
  arch: ArchitectureDocument,
  prd?: ProductRequirementsDocument
): PhaseConversionResult {
  const plans: TaskPlan[] = [];
  let totalComplexity = 0;

  for (const phase of arch.phases) {
    const plan = convertPhaseToTaskPlan(phase, arch, prd);
    plans.push(plan);
    totalComplexity += phase.complexity;
  }

  // Determine execution order based on dependencies
  const executionOrder = topologicalSort(arch.phases);

  return {
    plans,
    totalComplexity,
    executionOrder,
  };
}

/**
 * Convert a single phase to a task plan
 */
function convertPhaseToTaskPlan(
  phase: ImplementationPhase,
  arch: ArchitectureDocument,
  prd?: ProductRequirementsDocument
): TaskPlan {
  const tasks: PlanTask[] = phase.tasks.map((task) => ({
    id: task.id,
    description: task.description,
    type: mapTaskType(task.type),
    filePath: task.files[0],
    command: task.type === 'install' ? 'npm install' : undefined,
    status: 'pending' as const,
    dependsOn: task.dependsOn,
    complexity: task.complexity,
    generationPrompt: buildTaskPrompt(task, phase, arch, prd),
  }));

  // Add any additional files as separate tasks
  for (const task of phase.tasks) {
    if (task.files.length > 1) {
      for (let i = 1; i < task.files.length; i++) {
        tasks.push({
          id: `${task.id}_file_${i}`,
          description: `Create ${task.files[i]}`,
          type: 'file',
          filePath: task.files[i],
          status: 'pending',
          dependsOn: [task.id],
          complexity: 1,
        });
      }
    }
  }

  return {
    id: `plan_${phase.id}`,
    summary: phase.name,
    description: phase.description,
    tasks,
    filesToCreate: phase.tasks.flatMap(t => t.files.filter(() => t.type === 'create')),
    filesToModify: phase.tasks.flatMap(t => t.files.filter(() => t.type === 'modify')),
    dependencies: extractDependencies(arch),
    createdAt: Date.now(),
    status: 'draft',
    iteration: 1,
  };
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildTaskPrompt(
  task: ImplementationTask,
  phase: ImplementationPhase,
  arch: ArchitectureDocument,
  prd?: ProductRequirementsDocument
): string {
  if (task.prompt) return task.prompt;

  const parts: string[] = [];

  parts.push(`Task: ${task.description}`);
  parts.push(`Phase: ${phase.name}`);
  parts.push('');

  // Add technology context
  parts.push('Technology Stack:');
  parts.push(`- Framework: ${arch.stack.frontend.framework}`);
  parts.push(`- Styling: ${arch.stack.frontend.styling}`);
  parts.push(`- State: ${arch.stack.frontend.stateManagement}`);
  parts.push('');

  // Add file context
  if (task.files.length > 0) {
    parts.push(`Files to ${task.type}:`);
    for (const file of task.files) {
      parts.push(`- ${file}`);
    }
    parts.push('');
  }

  // Add relevant data models
  const relevantModels = findRelevantModels(task, arch);
  if (relevantModels.length > 0) {
    parts.push('Relevant Data Models:');
    for (const model of relevantModels) {
      parts.push(`- ${model.name}: ${model.fields.map(f => f.name).join(', ')}`);
    }
    parts.push('');
  }

  // Add relevant endpoints
  const relevantEndpoints = findRelevantEndpoints(task, arch);
  if (relevantEndpoints.length > 0) {
    parts.push('Relevant API Endpoints:');
    for (const ep of relevantEndpoints) {
      parts.push(`- ${ep.method} ${ep.path}: ${ep.description}`);
    }
    parts.push('');
  }

  // Add PRD requirements if available
  if (prd) {
    const relevantFeatures = findRelevantFeatures(task, prd);
    if (relevantFeatures.length > 0) {
      parts.push('Requirements:');
      for (const feature of relevantFeatures) {
        parts.push(`- ${feature.name}: ${feature.description}`);
        for (const ac of feature.acceptanceCriteria) {
          parts.push(`  - ${ac}`);
        }
      }
    }
  }

  return parts.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

function mapTaskType(type: ImplementationTask['type']): 'file' | 'shell' | 'modify' {
  switch (type) {
    case 'create': return 'file';
    case 'modify': return 'modify';
    case 'install': return 'shell';
    case 'config': return 'file';
    default: return 'file';
  }
}

function extractDependencies(arch: ArchitectureDocument): string[] {
  const deps = new Set<string>();

  // Add npm packages from libraries
  for (const lib of arch.stack.frontend.libraries) {
    deps.add(lib.name);
  }

  // Add testing libraries
  for (const test of arch.stack.frontend.testing) {
    deps.add(test.toLowerCase());
  }

  return Array.from(deps);
}

function findRelevantModels(
  task: ImplementationTask,
  arch: ArchitectureDocument
) {
  const taskLower = task.description.toLowerCase();
  return arch.data.models.filter(m =>
    taskLower.includes(m.name.toLowerCase())
  );
}

function findRelevantEndpoints(
  task: ImplementationTask,
  arch: ArchitectureDocument
) {
  const taskLower = task.description.toLowerCase();
  return arch.api.endpoints.filter(ep =>
    taskLower.includes(ep.path.split('/').pop()?.toLowerCase() || '')
  );
}

function findRelevantFeatures(
  task: ImplementationTask,
  prd: ProductRequirementsDocument
): FeatureSpecification[] {
  const taskLower = task.description.toLowerCase();
  return prd.features.filter(f =>
    taskLower.includes(f.name.toLowerCase())
  );
}

function topologicalSort(phases: ImplementationPhase[]): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const phaseMap = new Map(phases.map(p => [p.id, p]));

  function visit(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular dependency at ${id}`);

    visiting.add(id);
    const phase = phaseMap.get(id);
    if (phase) {
      for (const dep of phase.dependsOn) {
        visit(dep);
      }
    }
    visiting.delete(id);
    visited.add(id);
    result.push(id);
  }

  for (const phase of phases) {
    visit(phase.id);
  }

  return result;
}

// =============================================================================
// PHASE SELECTION
// =============================================================================

/**
 * Get the next phase to execute
 */
export function getNextPhase(
  phases: ImplementationPhase[],
  completedPhases: Set<string>
): ImplementationPhase | null {
  for (const phase of phases) {
    if (completedPhases.has(phase.id)) continue;

    // Check if all dependencies are met
    const depsMet = phase.dependsOn.every(dep => completedPhases.has(dep));
    if (depsMet) {
      return phase;
    }
  }

  return null;
}

/**
 * Calculate overall progress
 */
export function calculateProgress(
  phases: ImplementationPhase[],
  completedPhases: Set<string>
): {
  completedCount: number;
  totalCount: number;
  percentage: number;
  nextPhase: string | null;
} {
  const totalCount = phases.length;
  const completedCount = completedPhases.size;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const next = getNextPhase(phases, completedPhases);

  return {
    completedCount,
    totalCount,
    percentage,
    nextPhase: next?.name || null,
  };
}

/**
 * Get phase by ID
 */
export function getPhaseById(
  phases: ImplementationPhase[],
  phaseId: string
): ImplementationPhase | null {
  return phases.find(p => p.id === phaseId) || null;
}

/**
 * Get all tasks for a phase
 */
export function getPhaseTasks(phase: ImplementationPhase): ImplementationTask[] {
  return phase.tasks;
}

/**
 * Calculate phase complexity summary
 */
export function getPhaseComplexitySummary(phases: ImplementationPhase[]): {
  total: number;
  average: number;
  highest: { phase: string; complexity: number } | null;
  lowest: { phase: string; complexity: number } | null;
} {
  if (phases.length === 0) {
    return { total: 0, average: 0, highest: null, lowest: null };
  }

  const total = phases.reduce((sum, p) => sum + p.complexity, 0);
  const average = total / phases.length;

  let highest = phases[0];
  let lowest = phases[0];

  for (const phase of phases) {
    if (phase.complexity > highest.complexity) highest = phase;
    if (phase.complexity < lowest.complexity) lowest = phase;
  }

  return {
    total,
    average: Math.round(average * 10) / 10,
    highest: { phase: highest.name, complexity: highest.complexity },
    lowest: { phase: lowest.name, complexity: lowest.complexity },
  };
}
