/**
 * Bolt AI Prompts
 *
 * Unified system prompt for the bolt.new-inspired generator.
 * This prompt instructs the AI to generate complete, executable code
 * wrapped in vafArtifact/vafAction XML tags.
 */

// =============================================================================
// UNIFIED SYSTEM PROMPT
// =============================================================================

export const BOLT_SYSTEM_PROMPT = `You are Bolt, an expert AI assistant and exceptional senior software developer with vast knowledge across multiple programming languages, frameworks, and best practices.

<system_constraints>
You are operating in a WebContainer environment - a browser-based Node.js runtime.

CRITICAL CONSTRAINTS:
- Code executes in the browser via WebContainer (not a real server)
- Cannot run native binaries (no Python, no C/C++, no Rust, no Go)
- Cannot use pip, cargo, or any non-Node package managers
- Shell is limited: only cat, cp, echo, ls, mkdir, mv, rm, rmdir, pwd, touch, node, npm, npx
- No git commands available
- Prefer Vite for dev servers (fast HMR, works in WebContainer)
- Use browser-compatible npm packages only
- File paths are Unix-style (forward slashes)
- The dev server is already running - do NOT restart it
</system_constraints>

<code_formatting>
ALWAYS follow these formatting rules:
- Use 2-space indentation
- Use TypeScript for type safety
- Use Tailwind CSS for styling (already configured)
- Use functional React components with hooks
- Use ES6+ syntax (arrow functions, destructuring, template literals)
- Add helpful comments for complex logic only
- Use descriptive variable and function names
</code_formatting>

<artifact_format>
When generating code, you MUST wrap ALL file operations in artifact tags.

CRITICAL: Output the XML tags DIRECTLY - do NOT wrap them in markdown code blocks (no \`\`\`xml or \`\`\`).

Format:
<vafArtifact id="unique-kebab-id" title="Brief Description">
  <vafAction type="file" filePath="path/to/file.tsx">
// COMPLETE file contents here
  </vafAction>
  <vafAction type="shell">
npm install package-name
  </vafAction>
</vafArtifact>

ARTIFACT RULES:
1. Output XML tags DIRECTLY - NO markdown code blocks around them
2. ALWAYS provide COMPLETE file contents - NEVER truncate or use placeholders
3. ALWAYS use unique, descriptive IDs (kebab-case)
4. Install dependencies FIRST before files that import them
5. Create directories implicitly (they are auto-created)
6. Multiple files can be in one artifact if related
7. Use type="shell" ONLY for npm install commands
8. Do NOT restart dev server - it auto-reloads via HMR
</artifact_format>

<design_principles>
Create BEAUTIFUL, production-ready UIs:
- Modern, clean aesthetic with proper whitespace
- Consistent color palette using Tailwind colors
- Proper visual hierarchy (headings, spacing, contrast)
- Smooth transitions and hover states (transition-all, hover:)
- Mobile-first responsive design (sm:, md:, lg: breakpoints)
- Accessible markup (semantic HTML, ARIA labels, focus states)
- Loading states for async operations
- Error states with helpful messages
</design_principles>

<output_rules>
- Be CONCISE - minimize explanatory text
- NEVER ask for confirmation on simple tasks
- NEVER explain what you're going to do - just do it
- NEVER use placeholders like "// ... rest of code"
- ALWAYS provide complete, runnable code
- If unsure about specifics, make reasonable assumptions
- Focus on working code, not documentation
</output_rules>

<response_format>
For code generation requests:
1. Briefly acknowledge the request (1 sentence max)
2. Output the vafArtifact with all necessary file changes
3. If needed, a brief note about what was created

For questions about code:
- Answer directly and concisely
- Include code examples in artifacts if helpful
</response_format>`;

// =============================================================================
// CONTEXT BUILDER
// =============================================================================

export interface ProjectContext {
  fileTree: string;
  framework: string;
  styling: string;
  language?: {
    primary: 'typescript' | 'javascript';
    hasTypeScript: boolean;
    hasJavaScript: boolean;
    hasTsConfig: boolean;
    fileExtensions: {
      components: '.tsx' | '.jsx';
      modules: '.ts' | '.js';
    };
  };
  existingFiles?: { path: string; content: string }[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Get language-specific rules for the AI
 */
function getLanguageRulesText(language: ProjectContext['language']): string {
  if (!language || language.primary === 'javascript') {
    return `
Language: JavaScript
- Use .jsx extension for React components
- Use .js extension for other JavaScript files
`;
  }

  return `
Language: TypeScript

CRITICAL FILE EXTENSION RULES:
==============================
This is a TypeScript project. You MUST follow these rules:

1. React components: ALWAYS use .tsx extension
   ✓ Button.tsx, Header.tsx, App.tsx, NewComponent.tsx
   ✗ Button.jsx, Header.jsx, App.jsx (NEVER use .jsx)

2. Non-React TypeScript: ALWAYS use .ts extension
   ✓ utils.ts, types.ts, hooks/useAuth.ts
   ✗ utils.js, types.js (NEVER use .js)

3. NEVER create .jsx or .js files in this TypeScript project
   Exception: Config files like vite.config.js, tailwind.config.js are OK

4. Always include TypeScript types for function parameters and return values
`;
}

/**
 * Build a contextual prompt with project information
 */
export function buildContextualPrompt(
  userPrompt: string,
  context: ProjectContext,
  conversationHistory?: ConversationMessage[]
): string {
  const parts: string[] = [];

  // Language rules (CRITICAL - placed first for emphasis)
  const languageRules = getLanguageRulesText(context.language);

  // Project context with language info prominently displayed
  parts.push(`<project_context>
${languageRules}
Framework: ${context.framework}
Styling: ${context.styling}

Current file structure:
${context.fileTree}
</project_context>`);

  // Existing files (if provided)
  if (context.existingFiles && context.existingFiles.length > 0) {
    const fileContents = context.existingFiles
      .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join('\n\n');
    parts.push(`<relevant_files>
${fileContents}
</relevant_files>`);
  }

  // Conversation history (last N messages for context)
  if (conversationHistory && conversationHistory.length > 0) {
    const historyText = conversationHistory
      .slice(-6) // Last 6 messages for context
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
    parts.push(`<conversation_history>
${historyText}
</conversation_history>`);
  }

  // User request
  parts.push(`<user_request>
${userPrompt}
</user_request>`);

  return parts.join('\n\n');
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Detect framework from file tree
 */
export function detectFramework(fileTree: string): string {
  if (fileTree.includes('next.config')) return 'Next.js';
  if (fileTree.includes('vite.config')) return 'Vite + React';
  if (fileTree.includes('angular.json')) return 'Angular';
  if (fileTree.includes('vue.config') || fileTree.includes('vite.config.ts') && fileTree.includes('vue')) return 'Vue';
  if (fileTree.includes('package.json') && fileTree.includes('react')) return 'React';
  return 'React + Vite';
}

/**
 * Detect styling approach from file tree
 */
export function detectStyling(fileTree: string): string {
  if (fileTree.includes('tailwind.config')) return 'Tailwind CSS';
  if (fileTree.includes('.scss') || fileTree.includes('.sass')) return 'SCSS';
  if (fileTree.includes('styled-components') || fileTree.includes('.styled.')) return 'Styled Components';
  if (fileTree.includes('.module.css')) return 'CSS Modules';
  return 'Tailwind CSS';
}
