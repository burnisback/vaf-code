/**
 * Planner Tests
 *
 * Tests for the task planning system.
 */

import { describe, it, expect } from 'vitest';
import {
  validatePlan,
  getReadyTasks,
  getNextTask,
  getPlanComplexity,
  getPlanProgress,
  hasFailedTasks,
  isPlanComplete,
  isPlanBlocked,
  updateTaskStatus,
  getPlanSummary,
  estimateExecutionTime,
} from './index';
import { buildPlanningPrompt } from './prompts';
import type { TaskPlan, PlanTask } from './types';

// =============================================================================
// TEST UTILITIES
// =============================================================================

function createMockPlan(overrides?: Partial<TaskPlan>): TaskPlan {
  return {
    id: 'plan_test',
    summary: 'Test Plan',
    description: 'A test implementation plan',
    tasks: [
      {
        id: 'task-1',
        description: 'Install dependencies',
        type: 'shell',
        command: 'npm install react-query',
        status: 'pending',
        dependsOn: [],
        complexity: 1,
      },
      {
        id: 'task-2',
        description: 'Create component',
        type: 'file',
        filePath: 'src/components/Test.tsx',
        status: 'pending',
        dependsOn: ['task-1'],
        complexity: 3,
      },
      {
        id: 'task-3',
        description: 'Update App.tsx',
        type: 'modify',
        filePath: 'src/App.tsx',
        status: 'pending',
        dependsOn: ['task-2'],
        complexity: 2,
      },
    ],
    filesToCreate: ['src/components/Test.tsx'],
    filesToModify: ['src/App.tsx'],
    dependencies: ['react-query'],
    createdAt: Date.now(),
    status: 'draft',
    iteration: 1,
    ...overrides,
  };
}

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe('validatePlan', () => {
  it('should validate a correct plan', () => {
    const plan = createMockPlan();
    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect empty plan', () => {
    const plan = createMockPlan({ tasks: [] });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Plan has no tasks');
  });

  it('should detect non-existent dependencies', () => {
    const plan = createMockPlan({
      tasks: [
        {
          id: 'task-1',
          description: 'Task with bad dependency',
          type: 'file',
          filePath: 'test.ts',
          status: 'pending',
          dependsOn: ['non-existent-task'],
          complexity: 1,
        },
      ],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('non-existent'))).toBe(true);
  });

  it('should detect circular dependencies', () => {
    const plan = createMockPlan({
      tasks: [
        {
          id: 'task-1',
          description: 'Task 1',
          type: 'file',
          filePath: 'a.ts',
          status: 'pending',
          dependsOn: ['task-2'],
          complexity: 1,
        },
        {
          id: 'task-2',
          description: 'Task 2',
          type: 'file',
          filePath: 'b.ts',
          status: 'pending',
          dependsOn: ['task-1'],
          complexity: 1,
        },
      ],
    });
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Plan has circular dependencies');
  });

  it('should warn about missing filePath for file tasks', () => {
    const plan = createMockPlan({
      tasks: [
        {
          id: 'task-1',
          description: 'File task without path',
          type: 'file',
          status: 'pending',
          dependsOn: [],
          complexity: 1,
        },
      ],
    });
    const result = validatePlan(plan);
    expect(result.warnings.some(w => w.includes('filePath'))).toBe(true);
  });

  it('should warn about many tasks', () => {
    const manyTasks: PlanTask[] = Array.from({ length: 20 }, (_, i) => ({
      id: `task-${i}`,
      description: `Task ${i}`,
      type: 'file' as const,
      filePath: `file${i}.ts`,
      status: 'pending' as const,
      dependsOn: [],
      complexity: 1,
    }));
    const plan = createMockPlan({ tasks: manyTasks });
    const result = validatePlan(plan);
    expect(result.warnings.some(w => w.includes('splitting'))).toBe(true);
  });
});

// =============================================================================
// READY TASKS TESTS
// =============================================================================

describe('getReadyTasks', () => {
  it('should return tasks with no dependencies', () => {
    const plan = createMockPlan();
    const ready = getReadyTasks(plan);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('task-1');
  });

  it('should return tasks when dependencies are complete', () => {
    const plan = createMockPlan({
      tasks: [
        {
          id: 'task-1',
          description: 'Install',
          type: 'shell',
          command: 'npm install',
          status: 'completed',
          dependsOn: [],
          complexity: 1,
        },
        {
          id: 'task-2',
          description: 'Create',
          type: 'file',
          filePath: 'test.ts',
          status: 'pending',
          dependsOn: ['task-1'],
          complexity: 2,
        },
      ],
    });
    const ready = getReadyTasks(plan);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('task-2');
  });

  it('should not return tasks with incomplete dependencies', () => {
    const plan = createMockPlan();
    // task-2 depends on task-1 which is pending
    const ready = getReadyTasks(plan);
    expect(ready.some(t => t.id === 'task-2')).toBe(false);
  });

  it('should not return completed tasks', () => {
    const plan = createMockPlan({
      tasks: [
        {
          id: 'task-1',
          description: 'Already done',
          type: 'shell',
          command: 'npm install',
          status: 'completed',
          dependsOn: [],
          complexity: 1,
        },
      ],
    });
    const ready = getReadyTasks(plan);
    expect(ready).toHaveLength(0);
  });
});

// =============================================================================
// NEXT TASK TESTS
// =============================================================================

describe('getNextTask', () => {
  it('should return shell tasks first', () => {
    const plan = createMockPlan({
      tasks: [
        {
          id: 'task-1',
          description: 'Create file',
          type: 'file',
          filePath: 'test.ts',
          status: 'pending',
          dependsOn: [],
          complexity: 1,
        },
        {
          id: 'task-2',
          description: 'Install deps',
          type: 'shell',
          command: 'npm install',
          status: 'pending',
          dependsOn: [],
          complexity: 1,
        },
      ],
    });
    const next = getNextTask(plan);
    expect(next?.id).toBe('task-2'); // Shell has priority
  });

  it('should return null when no tasks are ready', () => {
    const plan = createMockPlan({
      tasks: [
        {
          id: 'task-1',
          description: 'Done',
          type: 'shell',
          command: 'npm install',
          status: 'completed',
          dependsOn: [],
          complexity: 1,
        },
      ],
    });
    const next = getNextTask(plan);
    expect(next).toBeNull();
  });
});

// =============================================================================
// COMPLEXITY & PROGRESS TESTS
// =============================================================================

describe('getPlanComplexity', () => {
  it('should sum task complexities', () => {
    const plan = createMockPlan();
    const complexity = getPlanComplexity(plan);
    expect(complexity).toBe(6); // 1 + 3 + 2
  });
});

describe('getPlanProgress', () => {
  it('should return 0 for pending plan', () => {
    const plan = createMockPlan();
    expect(getPlanProgress(plan)).toBe(0);
  });

  it('should return 100 for completed plan', () => {
    const plan = createMockPlan({
      tasks: [
        {
          id: 'task-1',
          description: 'Done',
          type: 'shell',
          command: 'npm install',
          status: 'completed',
          dependsOn: [],
          complexity: 1,
        },
      ],
    });
    expect(getPlanProgress(plan)).toBe(100);
  });

  it('should return partial progress', () => {
    const plan = createMockPlan({
      tasks: [
        { id: 'task-1', description: 'Done', type: 'shell', command: 'npm install', status: 'completed', dependsOn: [], complexity: 1 },
        { id: 'task-2', description: 'Pending', type: 'file', filePath: 'test.ts', status: 'pending', dependsOn: [], complexity: 1 },
      ],
    });
    expect(getPlanProgress(plan)).toBe(50);
  });
});

// =============================================================================
// STATUS TESTS
// =============================================================================

describe('hasFailedTasks', () => {
  it('should return false for plan without failures', () => {
    const plan = createMockPlan();
    expect(hasFailedTasks(plan)).toBe(false);
  });

  it('should return true for plan with failures', () => {
    const plan = createMockPlan({
      tasks: [
        {
          id: 'task-1',
          description: 'Failed',
          type: 'shell',
          command: 'npm install',
          status: 'failed',
          error: 'Network error',
          dependsOn: [],
          complexity: 1,
        },
      ],
    });
    expect(hasFailedTasks(plan)).toBe(true);
  });
});

describe('isPlanComplete', () => {
  it('should return false for pending plan', () => {
    const plan = createMockPlan();
    expect(isPlanComplete(plan)).toBe(false);
  });

  it('should return true when all tasks complete', () => {
    const plan = createMockPlan({
      tasks: [
        { id: 'task-1', description: 'Done', type: 'shell', command: 'npm', status: 'completed', dependsOn: [], complexity: 1 },
        { id: 'task-2', description: 'Skipped', type: 'file', filePath: 't.ts', status: 'skipped', dependsOn: [], complexity: 1 },
      ],
    });
    expect(isPlanComplete(plan)).toBe(true);
  });
});

describe('isPlanBlocked', () => {
  it('should return true when blocked by failures', () => {
    const plan = createMockPlan({
      tasks: [
        { id: 'task-1', description: 'Failed', type: 'shell', command: 'npm', status: 'failed', dependsOn: [], complexity: 1 },
        { id: 'task-2', description: 'Blocked', type: 'file', filePath: 't.ts', status: 'pending', dependsOn: ['task-1'], complexity: 1 },
      ],
    });
    expect(isPlanBlocked(plan)).toBe(true);
  });

  it('should return false when not blocked', () => {
    const plan = createMockPlan();
    expect(isPlanBlocked(plan)).toBe(false);
  });
});

// =============================================================================
// UPDATE TESTS
// =============================================================================

describe('updateTaskStatus', () => {
  it('should update task status immutably', () => {
    const plan = createMockPlan();
    const updated = updateTaskStatus(plan, 'task-1', 'completed');

    // Original unchanged
    expect(plan.tasks[0].status).toBe('pending');

    // New plan updated
    expect(updated.tasks[0].status).toBe('completed');
  });

  it('should add error message for failed tasks', () => {
    const plan = createMockPlan();
    const updated = updateTaskStatus(plan, 'task-1', 'failed', 'Something went wrong');

    expect(updated.tasks[0].status).toBe('failed');
    expect(updated.tasks[0].error).toBe('Something went wrong');
  });
});

// =============================================================================
// SUMMARY & ESTIMATION TESTS
// =============================================================================

describe('getPlanSummary', () => {
  it('should return correct counts', () => {
    const plan = createMockPlan({
      tasks: [
        { id: 'task-1', description: 'Done', type: 'shell', command: 'npm', status: 'completed', dependsOn: [], complexity: 1 },
        { id: 'task-2', description: 'In Progress', type: 'file', filePath: 'a.ts', status: 'in_progress', dependsOn: [], complexity: 1 },
        { id: 'task-3', description: 'Pending', type: 'file', filePath: 'b.ts', status: 'pending', dependsOn: [], complexity: 1 },
        { id: 'task-4', description: 'Failed', type: 'file', filePath: 'c.ts', status: 'failed', dependsOn: [], complexity: 1 },
      ],
    });
    const summary = getPlanSummary(plan);

    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(0);
  });
});

describe('estimateExecutionTime', () => {
  it('should estimate based on complexity', () => {
    const plan = createMockPlan(); // complexity: 1 + 3 + 2 = 6
    const estimate = estimateExecutionTime(plan);
    expect(estimate).toBe(30); // 6 * 5 seconds
  });
});

// =============================================================================
// PROMPT TESTS
// =============================================================================

describe('buildPlanningPrompt', () => {
  it('should include project context', () => {
    const prompt = buildPlanningPrompt(
      'Build a dashboard',
      {
        fileTree: 'src/\n  App.tsx\n  main.tsx',
        framework: 'React + Vite',
        styling: 'Tailwind CSS',
      }
    );

    expect(prompt).toContain('React + Vite');
    expect(prompt).toContain('Tailwind CSS');
    expect(prompt).toContain('App.tsx');
  });

  it('should include user request', () => {
    const prompt = buildPlanningPrompt(
      'Build a user authentication system',
      {
        fileTree: 'src/',
        framework: 'React',
        styling: 'CSS',
      }
    );

    expect(prompt).toContain('Build a user authentication system');
    expect(prompt).toContain('<user_request>');
  });

  it('should include conversation history', () => {
    const prompt = buildPlanningPrompt(
      'Now add notifications',
      {
        fileTree: 'src/',
        framework: 'React',
        styling: 'CSS',
      },
      [
        { role: 'user', content: 'Build a dashboard' },
        { role: 'assistant', content: 'I created a dashboard component' },
      ]
    );

    expect(prompt).toContain('Build a dashboard');
    expect(prompt).toContain('<recent_conversation>');
  });

  it('should include existing files summary', () => {
    const prompt = buildPlanningPrompt(
      'Add a form',
      {
        fileTree: 'src/',
        framework: 'React',
        styling: 'CSS',
        existingFiles: [
          { path: 'src/App.tsx', content: 'const App = () => {}' },
          { path: 'src/components/Button.tsx', content: 'export const Button = () => {}' },
        ],
      }
    );

    expect(prompt).toContain('src/App.tsx');
    expect(prompt).toContain('src/components/Button.tsx');
    expect(prompt).toContain('<existing_files>');
  });
});
