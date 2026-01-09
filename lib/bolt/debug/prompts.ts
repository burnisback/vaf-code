/**
 * Debug Prompts
 *
 * Prompt templates for AI-assisted debugging of runtime errors.
 * These prompts guide Claude to analyze errors and propose fixes
 * in a format compatible with the VAF artifact system.
 */

import type {
  RuntimeError,
  FixAttempt,
  ProjectPatterns,
} from '../types';

// =============================================================================
// BASE DEBUG PROMPT
// =============================================================================

/**
 * Build the base debug analysis prompt
 */
export function buildDebugAnalysisPrompt(
  error: RuntimeError,
  context: {
    previousAttempts: FixAttempt[];
    relevantFiles: { path: string; content: string }[];
  }
): string {
  const previousAttemptsSection =
    context.previousAttempts.length > 0
      ? `
## Previous Fix Attempts (${context.previousAttempts.length})
${context.previousAttempts
  .map(
    (attempt, i) => `
### Attempt ${i + 1}
**Analysis:** ${attempt.analysis.rootCause}
**Approach:** ${attempt.analysis.suggestedApproach}
**Result:** ${attempt.verificationResult?.message || 'Applied but not verified'}
**Why it failed:** ${
      attempt.verificationResult?.success === false
        ? 'Error persisted or new errors introduced'
        : 'Unknown'
    }
`
  )
  .join('\n')}

IMPORTANT: The previous attempts did NOT work. You must try a DIFFERENT approach.
Do not repeat the same fix. Consider alternative solutions.
`
      : '';

  const truncatedMessage = error.message.substring(0, 100);

  return `You are debugging a runtime error in a React/TypeScript application.

## Error Information
- **Type:** ${error.type}
- **Message:** ${error.message}
- **Source:** ${error.source || 'Unknown'}
- **Line:** ${error.line || 'Unknown'}
- **Column:** ${error.column || 'Unknown'}
- **Stack Trace:**
\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`
${
  error.componentStack
    ? `
- **React Component Stack:**
\`\`\`
${error.componentStack}
\`\`\`
`
    : ''
}

${previousAttemptsSection}

## Relevant Source Files
${context.relevantFiles
  .map(
    (f) => `
### ${f.path}
\`\`\`typescript
${f.content}
\`\`\`
`
  )
  .join('\n')}

## Your Task

1. **Analyze** the root cause of this error
2. **Identify** all files that need to be modified
3. **Propose** a fix using file actions

Respond with:

<analysis>
<rootCause>Explain the root cause in 1-2 sentences</rootCause>
<affectedFiles>List file paths that need changes, one per line</affectedFiles>
<approach>Describe your fix approach in 1-2 sentences</approach>
<confidence>high|medium|low</confidence>
</analysis>

<vafArtifact id="debug-fix" title="Fix: ${truncatedMessage}">
  <vafAction type="file" filePath="path/to/file.tsx">
    // Complete fixed file content - include the ENTIRE file, not just the changed parts
  </vafAction>
</vafArtifact>

IMPORTANT RULES:
- Include the COMPLETE file content in each vafAction, not just snippets
- Do not add new dependencies unless absolutely necessary
- Make minimal changes - fix only what's broken
- Preserve existing code style and patterns
`;
}

// =============================================================================
// CONTEXT-AWARE DEBUG PROMPT
// =============================================================================

/**
 * Build context-aware prompt that includes project patterns
 */
export function buildContextAwareDebugPrompt(
  error: RuntimeError,
  context: {
    previousAttempts: FixAttempt[];
    relevantFiles: { path: string; content: string }[];
    projectPatterns: ProjectPatterns;
  }
): string {
  const basePrompt = buildDebugAnalysisPrompt(error, context);

  return `${basePrompt}

## Project Context

**Framework:** ${context.projectPatterns.framework}
**Styling:** ${context.projectPatterns.styling}
**State Management:** ${context.projectPatterns.stateManagement || 'React hooks'}

**Code Conventions:**
${context.projectPatterns.conventions.map((c) => `- ${c}`).join('\n')}

${
  context.projectPatterns.examples.length > 0
    ? `
**Common Patterns in This Codebase:**
${context.projectPatterns.examples
  .map(
    (e) => `
- ${e.description}:
\`\`\`typescript
${e.code}
\`\`\`
`
  )
  .join('\n')}
`
    : ''
}

IMPORTANT: Your fix MUST follow these existing patterns and conventions.
`;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

/**
 * System prompt for the debug assistant
 */
export const DEBUG_SYSTEM_PROMPT = `You are an expert React/TypeScript debugger. Your role is to:
1. Quickly identify the root cause of runtime errors
2. Propose minimal, focused fixes
3. Follow existing project patterns
4. Learn from previous failed attempts

Rules:
- Never change more than necessary
- Preserve existing code style
- If previous attempts failed, try a fundamentally different approach
- Explain your reasoning clearly
- Always provide complete file contents in your fixes
- Do not add unnecessary comments or documentation
- Do not refactor unrelated code
- Focus only on fixing the specific error`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract error-relevant file paths from a stack trace
 */
export function extractRelevantPaths(error: RuntimeError): string[] {
  const paths: string[] = [];

  if (error.source) {
    // Clean up the source path
    const cleanPath = error.source
      .replace(/^https?:\/\/[^/]+/, '')
      .replace(/\?.*$/, '')
      .replace(/^\//, '');
    if (cleanPath) {
      paths.push(cleanPath);
    }
  }

  if (error.stack) {
    // Extract paths from stack trace
    const stackLines = error.stack.split('\n');
    const pathRegex = /at\s+(?:\S+\s+)?\(?([^:)]+):\d+:\d+\)?/;

    for (const line of stackLines) {
      const match = line.match(pathRegex);
      if (match) {
        const path = match[1]
          .replace(/^https?:\/\/[^/]+/, '')
          .replace(/\?.*$/, '')
          .replace(/^\//, '');

        // Filter out node_modules and system paths
        if (
          path &&
          !path.includes('node_modules') &&
          !path.startsWith('internal/') &&
          path.includes('src/')
        ) {
          paths.push(path);
        }
      }
    }
  }

  // Deduplicate
  return [...new Set(paths)];
}

/**
 * Detect project patterns from file contents
 */
export function detectProjectPatterns(
  files: { path: string; content: string }[]
): ProjectPatterns {
  const patterns: ProjectPatterns = {
    framework: 'React',
    styling: 'Unknown',
    conventions: [],
    examples: [],
  };

  for (const file of files) {
    // Detect Tailwind
    if (
      file.content.includes('className=') &&
      (file.content.includes('flex') ||
        file.content.includes('grid') ||
        file.content.includes('bg-'))
    ) {
      patterns.styling = 'Tailwind CSS';
    }

    // Detect TypeScript
    if (file.path.endsWith('.tsx') || file.path.endsWith('.ts')) {
      patterns.framework = 'React + TypeScript';
    }

    // Detect state management patterns
    if (file.content.includes('useState')) {
      patterns.stateManagement = 'React hooks (useState, useEffect)';
    }
    if (file.content.includes('useReducer')) {
      patterns.stateManagement = 'React hooks (useReducer)';
    }
    if (file.content.includes('zustand') || file.content.includes('create(')) {
      patterns.stateManagement = 'Zustand';
    }

    // Detect conventions
    if (file.content.includes("'use client'")) {
      patterns.conventions.push('Next.js App Router with client components');
    }
    if (file.content.includes('export default function')) {
      patterns.conventions.push('Default exports for components');
    }
    if (file.content.includes('interface') && file.content.includes('Props')) {
      patterns.conventions.push('TypeScript interfaces for props');
    }
  }

  // Deduplicate conventions
  patterns.conventions = [...new Set(patterns.conventions)];

  return patterns;
}
