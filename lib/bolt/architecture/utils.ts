/**
 * Architecture Utilities (Client-Safe)
 *
 * Client-safe utility functions for working with architecture documents.
 * No genkit or Node.js-specific dependencies.
 */

import type { ArchitectureDocument, ImplementationPhase } from './types';

// =============================================================================
// MARKDOWN EXPORT
// =============================================================================

/**
 * Export architecture to markdown format
 */
export function exportArchitectureToMarkdown(arch: ArchitectureDocument): string {
  const lines: string[] = [];

  lines.push(`# ${arch.name}`);
  lines.push('');
  lines.push('## Overview');
  lines.push(arch.overview);
  lines.push('');

  // Technical Decisions
  if (arch.decisions.length > 0) {
    lines.push('## Technical Decisions');
    lines.push('');
    for (const dec of arch.decisions) {
      lines.push(`### ${dec.title}`);
      lines.push(`**Decision:** ${dec.decision}`);
      lines.push('');
      lines.push(`**Rationale:** ${dec.rationale}`);
      lines.push('');
      if (dec.alternatives.length > 0) {
        lines.push('**Alternatives:**');
        for (const alt of dec.alternatives) {
          lines.push(`- ${alt}`);
        }
        lines.push('');
      }
      if (dec.consequences.length > 0) {
        lines.push('**Consequences:**');
        for (const con of dec.consequences) {
          lines.push(`- ${con}`);
        }
        lines.push('');
      }
    }
  }

  // Technology Stack
  lines.push('## Technology Stack');
  lines.push('');
  lines.push('### Frontend');
  lines.push(`- **Framework:** ${arch.stack.frontend.framework}`);
  lines.push(`- **Language:** ${arch.stack.frontend.language}`);
  lines.push(`- **Styling:** ${arch.stack.frontend.styling}`);
  lines.push(`- **State Management:** ${arch.stack.frontend.stateManagement}`);
  lines.push(`- **Routing:** ${arch.stack.frontend.routing}`);
  lines.push(`- **Build Tool:** ${arch.stack.frontend.buildTool}`);
  if (arch.stack.frontend.testing.length > 0) {
    lines.push(`- **Testing:** ${arch.stack.frontend.testing.join(', ')}`);
  }
  lines.push('');

  if (arch.stack.backend) {
    lines.push('### Backend');
    lines.push(`- **Runtime:** ${arch.stack.backend.runtime}`);
    lines.push(`- **Framework:** ${arch.stack.backend.framework}`);
    lines.push(`- **Language:** ${arch.stack.backend.language}`);
    if (arch.stack.backend.orm) {
      lines.push(`- **ORM:** ${arch.stack.backend.orm}`);
    }
    lines.push('');
  }

  if (arch.stack.database) {
    lines.push('### Database');
    lines.push(`- **Type:** ${arch.stack.database.type}`);
    lines.push(`- **Engine:** ${arch.stack.database.engine}`);
    if (arch.stack.database.hosted) {
      lines.push(`- **Hosted:** ${arch.stack.database.hosted}`);
    }
    lines.push('');
  }

  lines.push('### Infrastructure');
  lines.push(`- **Hosting:** ${arch.stack.infrastructure.hosting}`);
  if (arch.stack.infrastructure.cdn) lines.push(`- **CDN:** ${arch.stack.infrastructure.cdn}`);
  if (arch.stack.infrastructure.auth) lines.push(`- **Auth:** ${arch.stack.infrastructure.auth}`);
  if (arch.stack.infrastructure.storage) lines.push(`- **Storage:** ${arch.stack.infrastructure.storage}`);
  lines.push('');

  // Data Models
  if (arch.data.models.length > 0) {
    lines.push('## Data Models');
    lines.push('');
    for (const model of arch.data.models) {
      lines.push(`### ${model.name}`);
      lines.push(model.description);
      lines.push('');
      lines.push('| Field | Type | Required | Description |');
      lines.push('|-------|------|----------|-------------|');
      for (const field of model.fields) {
        lines.push(`| ${field.name} | ${field.type} | ${field.required ? 'Yes' : 'No'} | ${field.description} |`);
      }
      lines.push('');
    }
  }

  // API Endpoints
  if (arch.api.endpoints.length > 0) {
    lines.push('## API Endpoints');
    lines.push('');
    lines.push(`**Style:** ${arch.api.style.toUpperCase()}`);
    lines.push(`**Base URL:** ${arch.api.baseUrl}`);
    lines.push('');
    lines.push('| Method | Path | Description | Auth |');
    lines.push('|--------|------|-------------|------|');
    for (const ep of arch.api.endpoints) {
      lines.push(`| ${ep.method} | ${ep.path} | ${ep.description} | ${ep.authRequired ? 'Yes' : 'No'} |`);
    }
    lines.push('');
  }

  // Implementation Phases
  if (arch.phases.length > 0) {
    lines.push('## Implementation Phases');
    lines.push('');
    for (const phase of arch.phases) {
      lines.push(`### Phase ${phase.id.replace('phase_', '')}: ${phase.name}`);
      lines.push(phase.description);
      lines.push('');
      lines.push(`**Complexity:** ${phase.complexity}/10`);
      lines.push('');
      if (phase.goals.length > 0) {
        lines.push('**Goals:**');
        for (const goal of phase.goals) {
          lines.push(`- ${goal}`);
        }
        lines.push('');
      }
      if (phase.tasks.length > 0) {
        lines.push('**Tasks:**');
        for (const task of phase.tasks) {
          lines.push(`- [ ] ${task.description} (${task.files.length} files)`);
        }
        lines.push('');
      }
      if (phase.dependsOn.length > 0) {
        lines.push(`*Depends on: ${phase.dependsOn.join(', ')}*`);
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push(`*Version: ${arch.version} | Status: ${arch.status} | Generated: ${new Date(arch.createdAt).toISOString()}*`);

  return lines.join('\n');
}

// =============================================================================
// ARCHITECTURE STATISTICS
// =============================================================================

/**
 * Get architecture statistics
 */
export function getArchitectureStats(arch: ArchitectureDocument): {
  phaseCount: number;
  taskCount: number;
  modelCount: number;
  endpointCount: number;
  componentCount: number;
  totalComplexity: number;
  estimatedDays: number;
} {
  const taskCount = arch.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const totalComplexity = arch.phases.reduce((sum, p) => sum + p.complexity, 0);

  // Rough estimate: 1 complexity point = 0.5 days
  const estimatedDays = Math.ceil(totalComplexity * 0.5);

  return {
    phaseCount: arch.phases.length,
    taskCount,
    modelCount: arch.data.models.length,
    endpointCount: arch.api.endpoints.length,
    componentCount:
      arch.components.shared.length +
      arch.components.pages.length +
      arch.components.features.length +
      arch.components.layouts.length,
    totalComplexity,
    estimatedDays,
  };
}

/**
 * Get architecture completeness score
 */
export function getArchitectureCompleteness(arch: ArchitectureDocument): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  // Check required sections
  if (!arch.overview || arch.overview.length < 20) {
    issues.push('Overview is too short');
    score -= 10;
  }

  if (arch.decisions.length === 0) {
    issues.push('No technical decisions documented');
    score -= 10;
  }

  if (arch.data.models.length === 0) {
    issues.push('No data models defined');
    score -= 15;
  }

  if (arch.api.endpoints.length === 0) {
    issues.push('No API endpoints defined');
    score -= 15;
  }

  if (arch.phases.length === 0) {
    issues.push('No implementation phases defined');
    score -= 20;
  }

  // Check phases have tasks
  const phasesWithoutTasks = arch.phases.filter(p => p.tasks.length === 0);
  if (phasesWithoutTasks.length > 0) {
    issues.push(`${phasesWithoutTasks.length} phases have no tasks`);
    score -= 10;
  }

  // Check for MVP phase
  const hasMvpPhase = arch.phases.some(p =>
    p.name.toLowerCase().includes('mvp') ||
    p.name.toLowerCase().includes('foundation') ||
    p.id === 'phase_1'
  );
  if (!hasMvpPhase) {
    issues.push('No clear MVP/Foundation phase identified');
    score -= 10;
  }

  return {
    score: Math.max(0, score),
    issues,
  };
}

/**
 * Validate architecture structure
 */
export function validateArchitecture(arch: ArchitectureDocument): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!arch.id) errors.push('Missing architecture ID');
  if (!arch.name) errors.push('Missing architecture name');
  if (!arch.overview) errors.push('Missing overview');

  // Check phase IDs are unique
  const phaseIds = new Set<string>();
  for (const phase of arch.phases) {
    if (phaseIds.has(phase.id)) {
      errors.push(`Duplicate phase ID: ${phase.id}`);
    }
    phaseIds.add(phase.id);
  }

  // Check phase dependencies exist
  for (const phase of arch.phases) {
    for (const depId of phase.dependsOn) {
      if (!phaseIds.has(depId)) {
        warnings.push(`Phase ${phase.id} depends on non-existent phase: ${depId}`);
      }
    }
  }

  // Check task IDs are unique within phases
  for (const phase of arch.phases) {
    const taskIds = new Set<string>();
    for (const task of phase.tasks) {
      if (taskIds.has(task.id)) {
        errors.push(`Duplicate task ID in ${phase.id}: ${task.id}`);
      }
      taskIds.add(task.id);
    }
  }

  // Warnings for missing optional data
  if (arch.stack.frontend.libraries.length === 0) {
    warnings.push('No frontend libraries specified');
  }

  if (!arch.stack.database) {
    warnings.push('No database specified');
  }

  const totalTasks = arch.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  if (totalTasks > 50) {
    warnings.push('Large number of tasks - consider breaking into more phases');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// PHASE UTILITIES
// =============================================================================

/**
 * Get phases in dependency order
 */
export function getPhasesInOrder(phases: ImplementationPhase[]): ImplementationPhase[] {
  const result: ImplementationPhase[] = [];
  const visited = new Set<string>();
  const phaseMap = new Map(phases.map(p => [p.id, p]));

  function visit(id: string) {
    if (visited.has(id)) return;

    const phase = phaseMap.get(id);
    if (!phase) return;

    for (const dep of phase.dependsOn) {
      visit(dep);
    }

    visited.add(id);
    result.push(phase);
  }

  for (const phase of phases) {
    visit(phase.id);
  }

  return result;
}

/**
 * Get phase dependencies as a tree
 */
export function getPhaseDependencyTree(phases: ImplementationPhase[]): Map<string, string[]> {
  const tree = new Map<string, string[]>();

  for (const phase of phases) {
    tree.set(phase.id, phase.dependsOn);
  }

  return tree;
}

/**
 * Check if a phase can be started (all dependencies complete)
 */
export function canStartPhase(
  phase: ImplementationPhase,
  completedPhases: Set<string>
): boolean {
  return phase.dependsOn.every(dep => completedPhases.has(dep));
}
