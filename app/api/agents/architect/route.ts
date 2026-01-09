/**
 * VAF-ARCHITECT Agent API Route
 *
 * The Solution Architect agent that transforms PRDs into technical architecture
 * with component breakdowns and implementation order.
 *
 * Hierarchy Position: Level 2 (Reports to ORCHESTRATOR)
 * Can Communicate With: ORCHESTRATOR (upstream)
 * Can Delegate To: Frontend, Backend, Unit-Test, Designer
 */

import { NextResponse } from 'next/server';
import { ai, MODELS } from '@/lib/ai/genkit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface UserStory {
  id: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  priority: 'must-have' | 'should-have' | 'nice-to-have';
}

interface PRD {
  title: string;
  summary: string;
  userStories: UserStory[];
  outOfScope: string[];
  assumptions: string[];
}

interface ComponentSpec {
  name: string;
  type: 'page' | 'container' | 'presentational' | 'hook' | 'utility' | 'api';
  path: string;
  description: string;
  operationType?: 'create' | 'edit';  // NEW: whether to create new or edit existing
  editInstructions?: string;  // NEW: what to change (for edit operations)
  props?: Array<{ name: string; type: string; required: boolean }>;
  children?: string[];
  dependencies?: string[];
}

interface Architecture {
  summary: string;
  components: ComponentSpec[];
  implementationOrder: string[];
  stateManagement: {
    approach: string;
    stores?: string[];
  };
  apiEndpoints?: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    description: string;
  }>;
  dataFlow: string;
}

interface WorkItemContext {
  language: 'javascript' | 'typescript';
  componentExtension: '.jsx' | '.tsx' | '.js' | '.ts';
  framework: string;
  frameworkType: 'vite' | 'nextjs' | 'cra' | 'other';
  componentDir: string;
  pageDir: string;
  hookDir: string;
  utilDir: string;
  apiDir: string;
  styling: string;
  routingPattern: 'file-based' | 'react-router' | 'tanstack-router' | 'none';
  existingComponents: string[];
}

interface ArchitectRequest {
  workItemId: string;
  prd: PRD;
  workItemContext?: WorkItemContext;
  taskMode?: 'creation' | 'modification';  // NEW: from PM
  targetFiles?: string[];  // NEW: files to modify (for modification mode)
}

interface ArchitectResponse {
  workItemId: string;
  status: 'success' | 'needs-clarification';
  architecture: Architecture;
  taskMode: 'creation' | 'modification';  // NEW: pass through to frontend
  targetFiles?: string[];  // NEW: files to modify
  clarificationQuestions?: string[];
  nextAgent: 'vaf-frontend' | 'vaf-backend' | 'vaf-designer';
}

// =============================================================================
// ARCHITECT AGENT SYSTEM PROMPT
// =============================================================================

const ARCHITECT_SYSTEM_PROMPT = `You are VAF-ARCHITECT, the Solution Architect agent in a multi-agent software factory.

## YOUR ROLE
Transform Product Requirements Documents (PRDs) into technical architecture with component specifications.

## YOUR RESPONSIBILITIES
1. Analyze user stories to identify required components
2. Design component hierarchy (pages, containers, presentational)
3. Determine state management approach
4. Identify API endpoints needed
5. Define implementation order (dependencies first)
6. Keep designs simple and follow existing patterns

## COMPONENT TYPES
- **page**: Route-level components (e.g., LoginPage)
- **container**: Smart components with logic/state (e.g., LoginForm)
- **presentational**: Dumb UI components (e.g., TextField, Button)
- **hook**: Custom React hooks (e.g., useAuth)
- **utility**: Helper functions (e.g., validateEmail)
- **api**: API route handlers

## OUTPUT FORMAT
You must respond with valid JSON (no markdown, no explanation):

{
  "status": "success" | "needs-clarification",
  "architecture": {
    "summary": "Brief description of the technical approach",
    "components": [
      {
        "name": "ComponentName",
        "type": "page" | "container" | "presentational" | "hook" | "utility" | "api",
        "path": "src/components/ComponentName.tsx",
        "description": "What this component does",
        "props": [
          { "name": "propName", "type": "string", "required": true }
        ],
        "children": ["ChildComponent1", "ChildComponent2"],
        "dependencies": ["external-package"]
      }
    ],
    "implementationOrder": ["Component1", "Component2", "Component3"],
    "stateManagement": {
      "approach": "local-state" | "context" | "zustand" | "redux",
      "stores": ["optional store names"]
    },
    "apiEndpoints": [
      {
        "method": "POST",
        "path": "/api/auth/login",
        "description": "Handle login requests"
      }
    ],
    "dataFlow": "Description of how data flows through components"
  },
  "nextAgent": "vaf-frontend" | "vaf-backend" | "vaf-designer",
  "clarificationQuestions": ["optional questions if status is needs-clarification"]
}

## GUIDELINES

### Component Design
- Keep components small and focused (single responsibility)
- Presentational components should be reusable
- Container components manage state and logic
- Prefer composition over inheritance
- Use existing design system components when available

### State Management
- Use local state (useState) for component-specific state
- Use Context for shared state across few components
- Use zustand/redux only for complex global state

### Implementation Order
- List dependencies before dependents
- Presentational components before containers
- Hooks before components that use them
- Start with smallest, most reusable pieces

### File Paths
- Components: src/components/[ComponentName].tsx
- Pages: src/app/[route]/page.tsx
- Hooks: src/hooks/use[HookName].ts
- API: src/app/api/[endpoint]/route.ts
- Utilities: src/lib/[name].ts

## MODIFICATION MODE (CRITICAL)

When taskMode is "modification", you are modifying EXISTING code, not creating new files.

**For MODIFICATION requests:**
1. Set operationType: "edit" for components that already exist
2. Set operationType: "create" ONLY for genuinely new components
3. Include editInstructions describing WHAT to change in the existing file
4. Do NOT design full component specs for existing files - just describe the change

### RESPECT PROJECT ARCHITECTURE (VERY IMPORTANT)
When modifying what gets rendered, ALWAYS respect the project's existing architecture:
- If a PAGE component exists for the feature (e.g., LoginPage), use the PAGE not the raw component
- App.jsx should render PAGES, not individual components directly
- Pages are the composition layer (they combine components like backgrounds + forms)
- Check the existingComponents list for pages before suggesting direct component rendering

**WRONG:** App.jsx → LoginForm (bypasses page layer, loses layout/background)
**CORRECT:** App.jsx → LoginPage → LoginForm + SpaceBackground

**Example MODIFICATION architecture:**
User wants: "Make login the default home page"
Existing components: [LoginPage, LoginForm, SpaceBackground, ...]

{
  "status": "success",
  "architecture": {
    "summary": "Modify App.jsx to render LoginPage as the main route",
    "components": [
      {
        "name": "App",
        "type": "page",
        "path": "src/App.jsx",
        "description": "Main application entry point - MODIFY to render LoginPage",
        "operationType": "edit",
        "editInstructions": "Change the main render to return <LoginPage /> instead of current content. Add import for LoginPage from './pages/LoginPage'. Do NOT import LoginForm directly - use the page component."
      }
    ],
    "implementationOrder": ["App"],
    "stateManagement": { "approach": "local-state" },
    "dataFlow": "App renders LoginPage, which contains SpaceBackground and LoginForm"
  }
}

**Key differences from CREATION mode:**
- CREATION: Full component specs with props, children, etc.
- MODIFICATION: Only operationType: "edit" with editInstructions

## EXAMPLE (CREATION MODE)

PRD Title: "User Login Form"
User Stories: Login with email/password, validation, error handling

Response:
{
  "status": "success",
  "architecture": {
    "summary": "A login form with client-side validation, error states, and API integration for authentication.",
    "components": [
      {
        "name": "TextField",
        "type": "presentational",
        "path": "src/components/ui/TextField.tsx",
        "description": "Reusable text input with label, error state, and icon support",
        "props": [
          { "name": "label", "type": "string", "required": true },
          { "name": "type", "type": "'text' | 'email' | 'password'", "required": false },
          { "name": "error", "type": "string", "required": false },
          { "name": "value", "type": "string", "required": true },
          { "name": "onChange", "type": "(value: string) => void", "required": true }
        ]
      },
      {
        "name": "Button",
        "type": "presentational",
        "path": "src/components/ui/Button.tsx",
        "description": "Reusable button with variants and loading state",
        "props": [
          { "name": "children", "type": "ReactNode", "required": true },
          { "name": "variant", "type": "'primary' | 'secondary'", "required": false },
          { "name": "loading", "type": "boolean", "required": false },
          { "name": "disabled", "type": "boolean", "required": false },
          { "name": "onClick", "type": "() => void", "required": false }
        ]
      },
      {
        "name": "useLoginForm",
        "type": "hook",
        "path": "src/hooks/useLoginForm.ts",
        "description": "Manages login form state, validation, and submission"
      },
      {
        "name": "LoginForm",
        "type": "container",
        "path": "src/components/LoginForm.tsx",
        "description": "Login form container with validation and API integration",
        "children": ["TextField", "Button"],
        "dependencies": ["useLoginForm"]
      }
    ],
    "implementationOrder": ["TextField", "Button", "useLoginForm", "LoginForm"],
    "stateManagement": {
      "approach": "local-state"
    },
    "apiEndpoints": [
      {
        "method": "POST",
        "path": "/api/auth/login",
        "description": "Authenticate user with email and password"
      }
    ],
    "dataFlow": "User types in TextField → useLoginForm manages state/validation → Submit triggers API call → Success redirects, Error shows message"
  },
  "nextAgent": "vaf-frontend"
}

Now analyze the PRD and create the architecture.`;

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json() as ArchitectRequest;
    const { workItemId, prd, workItemContext, taskMode, targetFiles } = body;

    if (!workItemId || !prd) {
      return NextResponse.json(
        { error: 'workItemId and prd are required' },
        { status: 400 }
      );
    }

    // Default to creation mode if not specified
    const effectiveTaskMode = taskMode || 'creation';

    // Default context if not provided
    const ctx = workItemContext || {
      language: 'javascript' as const,
      componentExtension: '.jsx' as const,
      framework: 'React',
      frameworkType: 'vite' as const,
      componentDir: 'src/components',
      pageDir: 'src/pages',
      hookDir: 'src/hooks',
      utilDir: 'src/lib',
      apiDir: 'src/api',
      styling: 'CSS',
      routingPattern: 'react-router' as const,
      existingComponents: [],
    };

    console.log('[VAF-ARCHITECT] Processing request:', {
      workItemId,
      prdTitle: prd.title,
      storyCount: prd.userStories?.length || 0,
      language: ctx.language,
      extension: ctx.componentExtension,
      taskMode: effectiveTaskMode,
      targetFiles: targetFiles?.length || 0,
    });

    // Build context info with EXPLICIT file path instructions
    const contextInfo = `
## PROJECT CONTEXT (CRITICAL - MUST FOLLOW)
- Language: ${ctx.language.toUpperCase()}
- File Extension: ${ctx.componentExtension} (ALL component files MUST use this extension)
- Framework: ${ctx.framework} (${ctx.frameworkType})
- Styling: ${ctx.styling}

### Directory Structure (USE THESE EXACT PATHS)
- Components: ${ctx.componentDir}/[ComponentName]${ctx.componentExtension}
- Pages: ${ctx.pageDir}/[PageName]${ctx.componentExtension}
- Hooks: ${ctx.hookDir}/use[HookName]${ctx.language === 'typescript' ? '.ts' : '.js'}
- Utilities: ${ctx.utilDir}/[utilName]${ctx.language === 'typescript' ? '.ts' : '.js'}
- API Routes: ${ctx.apiDir}/[endpoint]${ctx.language === 'typescript' ? '.ts' : '.js'}

### Routing
- Pattern: ${ctx.routingPattern}

### Existing Components (can be reused)
${ctx.existingComponents.length > 0 ? ctx.existingComponents.map((c: string) => `- ${c}`).join('\n') : '- None'}

**IMPORTANT**: You MUST use ${ctx.componentExtension} extension for all React components. Do NOT use .tsx if the project uses .jsx.
`;

    const prdContent = `
## PRD TO IMPLEMENT

**Title:** ${prd.title}
**Summary:** ${prd.summary}

### User Stories
${prd.userStories.map(story => `
**${story.id}** (${story.priority})
As a ${story.asA}, I want ${story.iWant}, so that ${story.soThat}

Acceptance Criteria:
${story.acceptanceCriteria.map(c => `- ${c}`).join('\n')}
`).join('\n')}

### Out of Scope
${prd.outOfScope.map(item => `- ${item}`).join('\n')}

### Assumptions
${prd.assumptions.map(item => `- ${item}`).join('\n')}
`;

    // Build task mode context
    const taskModeContext = effectiveTaskMode === 'modification' ? `
## TASK MODE: MODIFICATION (CRITICAL)
This is a MODIFICATION request - design changes to EXISTING files, NOT new files.
Target files to modify: ${targetFiles?.join(', ') || 'Identify from PRD context'}

IMPORTANT:
- Use operationType: "edit" for existing files
- Include editInstructions describing what to change
- Do NOT design full component specs for files that already exist
- Only include components that need to be changed
` : `
## TASK MODE: CREATION
This is a CREATION request - design new components and files.
`;

    const userMessage = `${contextInfo}
${taskModeContext}
${prdContent}

Design the technical architecture for this ${effectiveTaskMode === 'modification' ? 'modification' : 'feature'}. Return JSON only.`;

    // Call Gemini AI
    const response = await ai.generate({
      model: MODELS.FLASH,
      system: ARCHITECT_SYSTEM_PROMPT,
      prompt: userMessage,
      config: {
        temperature: 0.3, // More deterministic for technical decisions
        maxOutputTokens: 4096,
      },
    });

    const responseText = response.text || '{}';

    // Parse the JSON response
    let architectResponse: Omit<ArchitectResponse, 'workItemId'>;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      architectResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[VAF-ARCHITECT] Failed to parse response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse Architect response', raw: responseText },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!architectResponse.architecture || !architectResponse.architecture.components) {
      return NextResponse.json(
        { error: 'Invalid architecture structure', raw: responseText },
        { status: 500 }
      );
    }

    // POST-PROCESSING: Ensure operationType is set for all components
    // This fixes LLM inconsistency - the model doesn't always set operationType
    architectResponse.architecture.components = architectResponse.architecture.components.map(component => {
      // If operationType is already set, keep it
      if (component.operationType) {
        return component;
      }

      // In modification mode, check if this file is in targetFiles
      if (effectiveTaskMode === 'modification' && targetFiles && targetFiles.length > 0) {
        // Check if component path matches any target file
        const isTargetFile = targetFiles.some(tf =>
          component.path === tf ||
          component.path.includes(tf) ||
          tf.includes(component.name)
        );

        if (isTargetFile) {
          return {
            ...component,
            operationType: 'edit' as const,
            editInstructions: component.editInstructions || component.description,
          };
        }
      }

      // Default: new components get 'create'
      return {
        ...component,
        operationType: 'create' as const,
      };
    });

    console.log('[VAF-ARCHITECT] Generated architecture:', {
      workItemId,
      componentCount: architectResponse.architecture.components.length,
      implementationOrder: architectResponse.architecture.implementationOrder,
      status: architectResponse.status,
      taskMode: effectiveTaskMode,
    });

    // Return the complete response with taskMode and targetFiles
    return NextResponse.json({
      workItemId,
      ...architectResponse,
      taskMode: effectiveTaskMode,
      targetFiles: targetFiles || [],
      nextAgent: architectResponse.nextAgent || 'vaf-frontend',
    });

  } catch (error) {
    console.error('[VAF-ARCHITECT] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service not configured. Please add GEMINI_API_KEY to environment.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Architect agent failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: 'VAF-ARCHITECT',
    role: 'Solution Architect',
    endpoint: '/api/agents/architect',
    methods: ['POST'],
    description: 'Transforms PRDs into technical architecture with component specifications',
    hierarchy: {
      level: 2,
      reportsTo: ['vaf-orchestrator'],
      delegatesTo: ['vaf-frontend', 'vaf-backend', 'vaf-unit-test', 'vaf-designer'],
    },
    inputContract: {
      workItemId: 'string (required)',
      prd: 'PRD object (required)',
      projectContext: 'object (optional)',
    },
    outputContract: {
      workItemId: 'string',
      status: 'success | needs-clarification',
      architecture: 'Architecture object with components',
      nextAgent: 'vaf-frontend | vaf-backend | vaf-designer',
    },
  });
}
