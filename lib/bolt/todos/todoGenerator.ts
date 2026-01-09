/**
 * Todo Generator
 *
 * Generates appropriate todo lists based on request mode and context.
 * Each mode has a specific pattern of todos that mirror Claude Code CLI behavior.
 */

import type { RequestMode } from '../ai/classifier/types';
import type { Todo, TodoType, TodoGeneratorConfig } from './types';
import type { ModelTier } from '../ai/modelRouter/types';
import { TodoManager } from './todoManager';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a todo entry structure
 */
function makeTodo(
  content: string,
  activeForm: string,
  type: TodoType,
  model?: ModelTier,
  files?: string[]
): {
  content: string;
  activeForm: string;
  type: TodoType;
  model?: ModelTier;
  files?: string[];
} {
  return { content, activeForm, type, model, files };
}

// =============================================================================
// MODE-SPECIFIC GENERATORS
// =============================================================================

/**
 * Generate todos for QUESTION mode
 * Pattern: Understand context → Formulate answer
 */
export function generateQuestionTodos(
  manager: TodoManager,
  prompt: string
): Todo[] {
  const todos = [
    makeTodo(
      'Understand the question and gather relevant context',
      'Understanding the question',
      'investigate',
      'flash-lite'
    ),
    makeTodo(
      'Formulate comprehensive answer',
      'Formulating answer',
      'execute',
      'flash-lite'
    ),
  ];

  return manager.createTodos(todos);
}

/**
 * Generate todos for SIMPLE mode (1-2 files)
 * Pattern: Search → Read → Execute → Verify
 */
export function generateSimpleTodos(
  manager: TodoManager,
  prompt: string
): Todo[] {
  // Extract potential target from prompt
  const target = extractTarget(prompt);

  const todos = [
    makeTodo(
      `Search for ${target} in the codebase`,
      `Searching for ${target}`,
      'investigate',
      'flash-lite'
    ),
    makeTodo(
      'Read target file(s) to understand context',
      'Reading target files',
      'read',
      'flash-lite'
    ),
    makeTodo(
      `Implement the requested change`,
      'Implementing change',
      'execute',
      'flash'
    ),
    makeTodo(
      'Verify changes compile without errors',
      'Verifying changes',
      'verify',
      'flash-lite'
    ),
  ];

  return manager.createTodos(todos);
}

/**
 * Generate todos for MODERATE mode (3-5 files)
 * Pattern: Multi-file investigation → Plan → Execute each → Final verify
 */
export function generateModerateTodos(
  manager: TodoManager,
  prompt: string,
  complexityScore?: number
): Todo[] {
  const feature = extractFeature(prompt);
  const estimatedFiles = complexityScore ? Math.min(5, Math.max(3, Math.floor(complexityScore / 2))) : 4;

  const todos = [
    // Investigation phase
    makeTodo(
      'Understand current project architecture',
      'Understanding project architecture',
      'investigate',
      'flash-lite'
    ),
    makeTodo(
      `Find existing ${feature}-related code`,
      `Searching for related code`,
      'investigate',
      'flash-lite'
    ),
    makeTodo(
      'Read relevant files to understand patterns',
      'Reading relevant files',
      'read',
      'flash-lite'
    ),

    // Planning phase
    makeTodo(
      `Create implementation plan for ${feature}`,
      `Planning ${feature} implementation`,
      'plan',
      'flash'
    ),
  ];

  // Execution todos (one per estimated file)
  for (let i = 1; i <= estimatedFiles; i++) {
    todos.push(
      makeTodo(
        `Implement step ${i} of ${estimatedFiles}`,
        `Implementing step ${i}`,
        'execute',
        'flash'
      )
    );
  }

  // Verification
  todos.push(
    makeTodo(
      'Run full verification suite',
      'Running verification',
      'verify',
      'flash-lite'
    )
  );

  return manager.createTodos(todos);
}

/**
 * Generate todos for COMPLEX mode (6-15 files)
 * Pattern: Deep investigation → Architecture → Phased execution with checkpoints
 */
export function generateComplexTodos(
  manager: TodoManager,
  prompt: string,
  complexityScore?: number
): Todo[] {
  const feature = extractFeature(prompt);

  const todos = [
    // Deep investigation phase
    makeTodo(
      'Analyze existing project architecture',
      'Analyzing project architecture',
      'investigate',
      'flash-lite'
    ),
    makeTodo(
      'Check for existing related implementations',
      'Checking existing implementations',
      'investigate',
      'flash-lite'
    ),
    makeTodo(
      'Understand routing and state management patterns',
      'Understanding patterns',
      'read',
      'flash-lite'
    ),
    makeTodo(
      'Identify API and service patterns',
      'Identifying API patterns',
      'read',
      'flash-lite'
    ),
    makeTodo(
      'Review current component architecture',
      'Reviewing components',
      'read',
      'flash-lite'
    ),

    // Architecture planning
    makeTodo(
      `Design ${feature} architecture`,
      'Designing architecture',
      'architecture',
      'pro'
    ),
    makeTodo(
      'Await user approval for architecture',
      'Awaiting architecture approval',
      'approve'
    ),

    // Phased execution - Phase 1: Core types and structure
    makeTodo(
      'Create type definitions',
      'Creating types',
      'execute',
      'flash'
    ),
    makeTodo(
      'Create core service/context',
      'Creating core service',
      'execute',
      'flash'
    ),
    makeTodo(
      'Verify Phase 1 compiles',
      'Verifying Phase 1',
      'verify',
      'flash-lite'
    ),

    // Phase 2: Components
    makeTodo(
      'Create main component(s)',
      'Creating components',
      'execute',
      'flash'
    ),
    makeTodo(
      'Create supporting components',
      'Creating supporting components',
      'execute',
      'flash'
    ),
    makeTodo(
      'Verify Phase 2 compiles',
      'Verifying Phase 2',
      'verify',
      'flash-lite'
    ),

    // Phase 3: Integration
    makeTodo(
      'Integrate with routing',
      'Integrating routing',
      'execute',
      'flash'
    ),
    makeTodo(
      'Connect state management',
      'Connecting state',
      'execute',
      'flash'
    ),
    makeTodo(
      'Add any additional utilities',
      'Adding utilities',
      'execute',
      'flash'
    ),

    // Final verification
    makeTodo(
      'Run complete verification suite',
      'Running final verification',
      'verify',
      'flash-lite'
    ),
    makeTodo(
      'Check for security issues',
      'Checking security',
      'verify',
      'flash-lite'
    ),
  ];

  return manager.createTodos(todos);
}

/**
 * Generate todos for MEGA-COMPLEX mode (16+ files)
 * Pattern: Research → PRD → Architecture → Phased implementation
 * Note: Actual phase todos will be generated dynamically after architecture approval
 */
export function generateMegaComplexTodos(
  manager: TodoManager,
  prompt: string
): Todo[] {
  const product = extractProduct(prompt);

  const todos = [
    // Research phase
    makeTodo(
      `Research ${product} competitors and best practices`,
      'Researching best practices',
      'research',
      'flash'
    ),
    makeTodo(
      'Synthesize research findings',
      'Synthesizing research',
      'research',
      'flash'
    ),
    makeTodo(
      'Await user approval for research findings',
      'Awaiting research approval',
      'approve'
    ),

    // PRD generation
    makeTodo(
      'Generate Product Requirements Document',
      'Generating PRD',
      'prd',
      'pro'
    ),
    makeTodo(
      'Await user approval for PRD',
      'Awaiting PRD approval',
      'approve'
    ),

    // Architecture design
    makeTodo(
      'Design system architecture',
      'Designing architecture',
      'architecture',
      'pro'
    ),
    makeTodo(
      'Define implementation phases',
      'Defining phases',
      'plan',
      'flash'
    ),
    makeTodo(
      'Await user approval for architecture',
      'Awaiting architecture approval',
      'approve'
    ),

    // Implementation placeholder - actual todos will be generated per phase
    makeTodo(
      'Begin phased implementation',
      'Starting implementation',
      'execute',
      'flash'
    ),
  ];

  return manager.createTodos(todos);
}

/**
 * Generate todos for DEBUG mode
 * Pattern: Collect errors → Analyze → Read source → Identify root cause → Plan fix → Execute → Verify
 */
export function generateDebugTodos(
  manager: TodoManager,
  errors?: string[]
): Todo[] {
  const errorCount = errors?.length || 1;
  const hasMultipleFiles = errorCount > 1;

  const todos = [
    // Error collection
    makeTodo(
      'Collect all error information',
      'Collecting error information',
      'investigate',
      'flash-lite'
    ),

    // Error analysis
    makeTodo(
      'Parse and categorize errors',
      'Analyzing errors',
      'investigate',
      'flash-lite'
    ),

    // Source investigation
    makeTodo(
      hasMultipleFiles
        ? `Read ${errorCount} affected files`
        : 'Read affected file',
      'Reading affected files',
      'read',
      'flash'
    ),

    // Root cause identification
    makeTodo(
      'Identify root cause with evidence',
      'Identifying root cause',
      'investigate',
      'flash'
    ),

    // Fix planning
    makeTodo(
      'Plan minimal fix (no refactoring)',
      'Planning fix',
      'plan',
      'flash'
    ),

    // Fix execution
    makeTodo(
      'Execute minimal fix',
      'Executing fix',
      'execute',
      'flash'
    ),

    // Verification
    makeTodo(
      'Verify fix resolved the error',
      'Verifying fix',
      'verify',
      'flash-lite'
    ),
  ];

  return manager.createTodos(todos);
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generate todos based on configuration
 */
export function generateTodosForMode(
  manager: TodoManager,
  config: TodoGeneratorConfig
): Todo[] {
  const { mode, prompt, isDebug, errors, complexityScore } = config;

  // Debug mode takes precedence if indicated
  if (isDebug) {
    return generateDebugTodos(manager, errors);
  }

  // Generate based on mode
  switch (mode) {
    case 'question':
      return generateQuestionTodos(manager, prompt);

    case 'simple':
      return generateSimpleTodos(manager, prompt);

    case 'moderate':
      return generateModerateTodos(manager, prompt, complexityScore);

    case 'complex':
      return generateComplexTodos(manager, prompt, complexityScore);

    case 'mega-complex':
      return generateMegaComplexTodos(manager, prompt);

    default:
      // Default to simple
      return generateSimpleTodos(manager, prompt);
  }
}

// =============================================================================
// HELPER EXTRACTORS
// =============================================================================

/**
 * Extract a target keyword from the prompt
 */
function extractTarget(prompt: string): string {
  // Look for common patterns like "handleClick", "Button", etc.
  const functionMatch = prompt.match(/\b([a-z]+[A-Z][a-zA-Z]*)\b/);
  if (functionMatch) return functionMatch[1];

  const componentMatch = prompt.match(/\b([A-Z][a-zA-Z]+)\b/);
  if (componentMatch) return componentMatch[1];

  // Default to "relevant code"
  return 'relevant code';
}

/**
 * Extract a feature name from the prompt
 */
function extractFeature(prompt: string): string {
  // Look for common feature keywords
  const featurePatterns = [
    /add\s+(?:a\s+)?(\w+(?:\s+\w+)?)/i,
    /create\s+(?:a\s+)?(\w+(?:\s+\w+)?)/i,
    /implement\s+(?:a\s+)?(\w+(?:\s+\w+)?)/i,
    /build\s+(?:a\s+)?(\w+(?:\s+\w+)?)/i,
  ];

  for (const pattern of featurePatterns) {
    const match = prompt.match(pattern);
    if (match) return match[1];
  }

  // Default
  return 'the feature';
}

/**
 * Extract a product name from the prompt
 */
function extractProduct(prompt: string): string {
  const productPatterns = [
    /(?:build|create|develop)\s+(?:a\s+)?(?:full\s+)?(\w+(?:\s+\w+){0,2})/i,
  ];

  for (const pattern of productPatterns) {
    const match = prompt.match(pattern);
    if (match) return match[1];
  }

  return 'the application';
}

// =============================================================================
// PHASE TODO HELPERS (for mega-complex)
// =============================================================================

/**
 * Add todos for a specific implementation phase (mega-complex)
 */
export function addPhaseTodos(
  manager: TodoManager,
  phaseName: string,
  phaseNumber: number,
  tasks: string[]
): Todo[] {
  const todos: Todo[] = [];

  for (const task of tasks) {
    todos.push(
      manager.createTodo(
        task,
        task.replace(/^(Create|Add|Implement|Update|Configure)/, '$1ing'),
        'execute',
        { model: 'flash', phase: phaseNumber }
      )
    );
  }

  // Add phase verification
  todos.push(
    manager.createTodo(
      `Verify ${phaseName} compiles`,
      `Verifying ${phaseName}`,
      'verify',
      { model: 'flash-lite', phase: phaseNumber }
    )
  );

  return todos;
}

/**
 * Add approval checkpoint todo
 */
export function addApprovalTodo(
  manager: TodoManager,
  artifact: string,
  phaseNumber?: number
): Todo {
  return manager.createTodo(
    `Await user approval for ${artifact}`,
    'Awaiting approval',
    'approve',
    { phase: phaseNumber }
  );
}
