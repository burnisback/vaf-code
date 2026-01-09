/**
 * Planning Prompts
 *
 * System prompts for the task planning phase.
 * These prompts guide the AI in creating structured, executable plans.
 */

// =============================================================================
// PLANNING SYSTEM PROMPT
// =============================================================================

export const PLANNING_SYSTEM_PROMPT = `You are an expert software architect who creates clear, actionable implementation plans.

Your job is to analyze a user's request and create a structured task plan that another AI will execute.

<planning_rules>
1. Break complex requests into small, focused tasks
2. Order tasks by dependencies (install deps first, then create files)
3. Each task should be independently verifiable
4. Aim for 3-10 tasks per plan (if more, the request should be split)
5. Prefer creating new files over modifying many existing files
6. Include shell tasks for npm install when new packages are needed
7. Estimate complexity for each task (1-5 scale)
8. Keep file paths relative to the project root (e.g., src/components/Button.tsx)
</planning_rules>

<task_types>
- "file": Create a new file with complete content
- "modify": Modify an existing file (update imports, add exports, etc.)
- "shell": Run a shell command (usually npm install)
- "delete": Remove a file (rare, use with caution)
</task_types>

<output_format>
First, briefly explain your analysis and approach (2-3 sentences).

Then output a JSON plan:
\`\`\`json
{
  "summary": "Brief one-line summary",
  "description": "Detailed description of what we're building",
  "tasks": [
    {
      "id": "task-1",
      "description": "What this task does",
      "type": "shell",
      "command": "npm install package-name",
      "dependsOn": [],
      "complexity": 1
    },
    {
      "id": "task-2",
      "description": "Create UserProfile component",
      "type": "file",
      "filePath": "src/components/UserProfile.tsx",
      "dependsOn": ["task-1"],
      "complexity": 3
    }
  ],
  "filesToCreate": ["src/components/UserProfile.tsx"],
  "filesToModify": ["src/App.tsx"],
  "dependencies": ["package-name"]
}
\`\`\`
</output_format>

<complexity_guide>
1 = Simple (install package, create empty file, simple config)
2 = Easy (basic component, simple function, minor modification)
3 = Medium (component with state, API integration, form handling)
4 = Complex (multi-feature component, complex logic, state management)
5 = Very Complex (architectural changes, major refactoring, multiple integrations)
</complexity_guide>

<best_practices>
- For React/Next.js: Use functional components with hooks
- For forms: Include validation
- For API calls: Include error handling
- For components: Keep them focused and reusable
- For TypeScript: Use proper types, avoid 'any'
- For styling: Use the project's styling approach (Tailwind, etc.)
</best_practices>`;

// =============================================================================
// PROMPT BUILDER
// =============================================================================

/**
 * Get language-specific planning rules
 */
function getLanguagePlanningRules(language?: {
  primary: 'typescript' | 'javascript';
  hasTypeScript: boolean;
  hasJavaScript: boolean;
  hasTsConfig: boolean;
  fileExtensions: { components: '.tsx' | '.jsx'; modules: '.ts' | '.js' };
}): string {
  if (!language || language.primary === 'javascript') {
    return `Language: JavaScript
- Use .jsx extension for React components
- Use .js extension for other files`;
  }

  return `Language: TypeScript

CRITICAL FILE EXTENSION RULES:
- React components: ALWAYS use .tsx extension (e.g., Button.tsx, Header.tsx)
- Non-React TypeScript: ALWAYS use .ts extension (e.g., utils.ts, types.ts)
- NEVER create .jsx or .js files in this TypeScript project`;
}

/**
 * Build the complete planning prompt with context
 */
export function buildPlanningPrompt(
  userPrompt: string,
  projectContext: {
    fileTree: string;
    framework: string;
    styling: string;
    language?: {
      primary: 'typescript' | 'javascript';
      hasTypeScript: boolean;
      hasJavaScript: boolean;
      hasTsConfig: boolean;
      fileExtensions: { components: '.tsx' | '.jsx'; modules: '.ts' | '.js' };
    };
    existingFiles?: { path: string; content: string }[];
  },
  conversationHistory?: { role: string; content: string }[]
): string {
  const parts: string[] = [];

  // Language rules (CRITICAL - placed first)
  const languageRules = getLanguagePlanningRules(projectContext.language);

  // Project context
  parts.push(`<project_context>
${languageRules}

Framework: ${projectContext.framework}
Styling: ${projectContext.styling}

Current file structure:
${projectContext.fileTree || '(empty project)'}
</project_context>`);

  // Existing files (summarize, don't include full content for planning)
  if (projectContext.existingFiles && projectContext.existingFiles.length > 0) {
    const fileSummary = projectContext.existingFiles
      .slice(0, 10) // Limit to 10 files
      .map(f => `- ${f.path} (${f.content.split('\n').length} lines)`)
      .join('\n');
    parts.push(`<existing_files>
${fileSummary}
${projectContext.existingFiles.length > 10 ? `... and ${projectContext.existingFiles.length - 10} more files` : ''}
</existing_files>`);
  }

  // Conversation history (limited for planning context)
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-4);
    const historyText = recentHistory
      .map(m => {
        const content = m.content.length > 200
          ? m.content.slice(0, 200) + '...'
          : m.content;
        return `${m.role}: ${content}`;
      })
      .join('\n');
    parts.push(`<recent_conversation>
${historyText}
</recent_conversation>`);
  }

  // User request
  parts.push(`<user_request>
${userPrompt}
</user_request>

Create an implementation plan for this request. Remember to:
- Order tasks by dependencies
- Include any necessary npm installs first
- Keep tasks focused and verifiable
- Estimate complexity for each task
- Use appropriate file paths based on the project structure`);

  return parts.join('\n\n');
}

// =============================================================================
// TASK EXECUTION PROMPT
// =============================================================================

/**
 * Prompt for executing a single task from the plan
 */
export function buildTaskExecutionPrompt(
  task: {
    id: string;
    description: string;
    type: string;
    filePath?: string;
    command?: string;
  },
  projectContext: {
    fileTree: string;
    framework: string;
    styling: string;
    language?: {
      primary: 'typescript' | 'javascript';
      hasTypeScript: boolean;
      hasJavaScript: boolean;
      hasTsConfig: boolean;
      fileExtensions: { components: '.tsx' | '.jsx'; modules: '.ts' | '.js' };
    };
  },
  previousTasks: { description: string; filePath?: string }[]
): string {
  const parts: string[] = [];

  // Language rules
  const languageRules = getLanguagePlanningRules(projectContext.language);

  // Project context
  parts.push(`<project_context>
${languageRules}

Framework: ${projectContext.framework}
Styling: ${projectContext.styling}

File structure:
${projectContext.fileTree}
</project_context>`);

  // Previous tasks completed (for context)
  if (previousTasks.length > 0) {
    const prevSummary = previousTasks
      .map(t => `- ${t.description}${t.filePath ? ` (${t.filePath})` : ''}`)
      .join('\n');
    parts.push(`<completed_tasks>
${prevSummary}
</completed_tasks>`);
  }

  // Current task
  parts.push(`<current_task>
Task ID: ${task.id}
Description: ${task.description}
Type: ${task.type}
${task.filePath ? `File Path: ${task.filePath}` : ''}
${task.command ? `Command: ${task.command}` : ''}
</current_task>

Execute this task. For file tasks, generate the complete file content.
For modify tasks, provide the modifications needed.
For shell tasks, confirm the command is correct.`);

  return parts.join('\n\n');
}

// =============================================================================
// REFINEMENT PROMPT
// =============================================================================

/**
 * Prompt for refining a failed task
 */
export function buildRefinementPrompt(
  task: {
    id: string;
    description: string;
    type: string;
    filePath?: string;
    error: string;
  },
  previousAttempt: string,
  projectContext: {
    fileTree: string;
    framework: string;
    styling: string;
    language?: {
      primary: 'typescript' | 'javascript';
      hasTypeScript: boolean;
      hasJavaScript: boolean;
      hasTsConfig: boolean;
      fileExtensions: { components: '.tsx' | '.jsx'; modules: '.ts' | '.js' };
    };
  }
): string {
  const languageRules = getLanguagePlanningRules(projectContext.language);

  return `<error_context>
Task "${task.description}" failed with error:
${task.error}

Previous attempt:
\`\`\`
${previousAttempt.slice(0, 500)}${previousAttempt.length > 500 ? '...' : ''}
\`\`\`
</error_context>

<project_context>
${languageRules}

Framework: ${projectContext.framework}
Styling: ${projectContext.styling}
File: ${task.filePath || 'N/A'}
</project_context>

Please fix this task. Analyze the error and provide a corrected implementation.
Focus on:
1. What caused the error
2. How to fix it
3. Complete corrected code`;
}
