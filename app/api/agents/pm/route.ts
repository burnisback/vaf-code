/**
 * VAF-PM Agent API Route
 *
 * The Product Manager agent that transforms user requests into structured
 * Product Requirements Documents (PRDs) with user stories and acceptance criteria.
 *
 * Hierarchy Position: Level 2 (Reports to ORCHESTRATOR only)
 * Can Communicate With: ORCHESTRATOR (upstream)
 * Can Delegate To: None
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

interface PMRequest {
  workItemId: string;
  userRequest: string;
  workItemContext?: WorkItemContext;
  taskMode?: 'creation' | 'modification';  // NEW: from orchestrator
  targetFiles?: string[];  // NEW: files to modify (for modification mode)
}

interface PMResponse {
  workItemId: string;
  status: 'success' | 'needs-clarification';
  prd: PRD;
  taskMode: 'creation' | 'modification';  // NEW: pass through to architect
  targetFiles?: string[];  // NEW: files to modify (for modification mode)
  clarificationQuestions?: string[];
  nextAgent: 'vaf-architect';
}

// =============================================================================
// PM AGENT SYSTEM PROMPT
// =============================================================================

const PM_SYSTEM_PROMPT = `You are VAF-PM, the Product Manager agent in a multi-agent software factory.

## YOUR ROLE
Transform user requests into structured Product Requirements Documents (PRDs) with clear user stories.

## YOUR RESPONSIBILITIES
1. Understand the user's intent and desired outcome
2. Break down requests into discrete, implementable user stories
3. Define clear acceptance criteria for each story
4. Identify what's in scope and out of scope
5. Document assumptions
6. Prioritize stories using MoSCoW method

## OUTPUT FORMAT
You must respond with valid JSON (no markdown, no explanation):

{
  "status": "success" | "needs-clarification",
  "prd": {
    "title": "Feature name",
    "summary": "Brief description of what we're building",
    "userStories": [
      {
        "id": "US-1",
        "asA": "user type",
        "iWant": "action or capability",
        "soThat": "benefit or value",
        "acceptanceCriteria": ["criteria 1", "criteria 2"],
        "priority": "must-have" | "should-have" | "nice-to-have"
      }
    ],
    "outOfScope": ["items explicitly not included"],
    "assumptions": ["assumptions made about the request"]
  },
  "clarificationQuestions": ["optional questions if status is needs-clarification"],
  "nextAgent": "vaf-architect"
}

## GUIDELINES

### User Story Quality
- Each story should be small enough to implement in a single session
- Acceptance criteria should be testable (can verify pass/fail)
- Use plain language, avoid technical jargon in the "asA/iWant/soThat" parts
- Technical details go in acceptance criteria

### Prioritization (MoSCoW)
- **must-have**: Core functionality, without this the feature doesn't work
- **should-have**: Important but not critical for MVP
- **nice-to-have**: Enhancements that can be added later

### When to Ask for Clarification
Set status to "needs-clarification" when:
- The request is too vague (e.g., "make it better")
- Critical information is missing (e.g., no user type specified)
- Conflicting requirements detected

## MODIFICATION MODE (CRITICAL)

When taskMode is "modification", the user wants to CHANGE existing code, not CREATE new files.

**For MODIFICATION requests:**
1. User stories should describe WHAT TO CHANGE, not what to build from scratch
2. Reference the targetFiles that need to be modified
3. Acceptance criteria should describe the expected change, not full implementation
4. Keep user stories focused on the specific modification

**Example MODIFICATION PRD:**
User: "Make the login page the home page"
taskMode: "modification"
targetFiles: ["src/App.jsx"]

Response:
{
  "status": "success",
  "prd": {
    "title": "Set Login as Home Page",
    "summary": "Modify App.jsx to render LoginForm as the default landing page",
    "userStories": [
      {
        "id": "US-1",
        "asA": "developer",
        "iWant": "to modify App.jsx to render LoginForm instead of the current content",
        "soThat": "users see the login form when they first visit the site",
        "acceptanceCriteria": [
          "App.jsx imports LoginForm component",
          "App.jsx renders LoginForm as the main content",
          "Previous home content is removed or moved",
          "No new files are created - only App.jsx is modified"
        ],
        "priority": "must-have"
      }
    ],
    "outOfScope": ["Creating new components", "Changing LoginForm itself"],
    "assumptions": ["LoginForm component already exists", "App.jsx is the main entry point"]
  },
  "nextAgent": "vaf-architect"
}

**Key difference from CREATION mode:**
- CREATION: "Build a LoginForm with fields..." (creates new files)
- MODIFICATION: "Modify App.jsx to render LoginForm..." (edits existing files)

## EXAMPLE (CREATION MODE)

User: "Build me a login form"

Response:
{
  "status": "success",
  "prd": {
    "title": "User Login Form",
    "summary": "A login form allowing users to authenticate with email and password",
    "userStories": [
      {
        "id": "US-1",
        "asA": "visitor",
        "iWant": "to see a login form on the page",
        "soThat": "I know where to enter my credentials",
        "acceptanceCriteria": [
          "Form has email input field with label",
          "Form has password input field with label",
          "Form has a submit button labeled 'Sign In'",
          "Form is visually centered and responsive"
        ],
        "priority": "must-have"
      },
      {
        "id": "US-2",
        "asA": "user",
        "iWant": "to enter my email address",
        "soThat": "I can identify myself to the system",
        "acceptanceCriteria": [
          "Email field accepts text input",
          "Email field validates format (contains @)",
          "Invalid email shows error message",
          "Email field is required"
        ],
        "priority": "must-have"
      },
      {
        "id": "US-3",
        "asA": "user",
        "iWant": "to enter my password securely",
        "soThat": "my credentials are protected",
        "acceptanceCriteria": [
          "Password field masks input characters",
          "Password field is required",
          "Minimum length validation (8 characters)",
          "Shows/hide password toggle button"
        ],
        "priority": "must-have"
      },
      {
        "id": "US-4",
        "asA": "user",
        "iWant": "to submit the form and get feedback",
        "soThat": "I know if login succeeded or failed",
        "acceptanceCriteria": [
          "Form prevents submission if validation fails",
          "Loading state shown while submitting",
          "Success message on successful login",
          "Error message on failed login (generic, not specific)"
        ],
        "priority": "must-have"
      },
      {
        "id": "US-5",
        "asA": "user",
        "iWant": "to see a 'Forgot Password' link",
        "soThat": "I can recover my account if needed",
        "acceptanceCriteria": [
          "Link is visible below the form",
          "Link navigates to password recovery page"
        ],
        "priority": "should-have"
      }
    ],
    "outOfScope": [
      "Password recovery flow implementation",
      "Social login (Google, GitHub, etc.)",
      "Remember me functionality",
      "Two-factor authentication"
    ],
    "assumptions": [
      "Backend authentication API already exists",
      "Using existing design system styling",
      "Form will be on a dedicated /login page"
    ]
  },
  "nextAgent": "vaf-architect"
}

Now process the user's request and generate the PRD.`;

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json() as PMRequest;
    const { workItemId, userRequest, workItemContext, taskMode, targetFiles } = body;

    if (!workItemId || !userRequest) {
      return NextResponse.json(
        { error: 'workItemId and userRequest are required' },
        { status: 400 }
      );
    }

    // Default to creation mode if not specified
    const effectiveTaskMode = taskMode || 'creation';

    console.log('[VAF-PM] Processing request:', {
      workItemId,
      requestLength: userRequest.length,
      hasContext: !!workItemContext,
      language: workItemContext?.language,
      framework: workItemContext?.framework,
      taskMode: effectiveTaskMode,
      targetFiles: targetFiles?.length || 0,
    });

    // Build the user message with normalized project context
    const contextInfo = workItemContext ? `
## PROJECT CONTEXT (IMPORTANT - Follow these specifications)
- Language: ${workItemContext.language} (use ${workItemContext.componentExtension} file extension)
- Framework: ${workItemContext.framework} (${workItemContext.frameworkType})
- Styling: ${workItemContext.styling}
- Component Directory: ${workItemContext.componentDir}
- Routing: ${workItemContext.routingPattern}
- Existing Components: ${workItemContext.existingComponents.join(', ') || 'None'}

IMPORTANT: All file paths and code should use ${workItemContext.language === 'typescript' ? 'TypeScript' : 'JavaScript'} with ${workItemContext.componentExtension} extensions.
` : '';

    // Build task mode context
    const existingComponentsList = workItemContext?.existingComponents || [];
    const taskModeContext = effectiveTaskMode === 'modification' ? `
## TASK MODE: MODIFICATION (CRITICAL)
This is a MODIFICATION request - the user wants to CHANGE existing code, NOT create new files.
Target files to modify: ${targetFiles?.join(', ') || 'Not specified - identify from context'}

### EXISTING COMPONENTS (USE THESE EXACT NAMES)
${existingComponentsList.length > 0 ? existingComponentsList.map(c => `- ${c}`).join('\n') : 'None detected'}

IMPORTANT:
- Your PRD should describe WHAT TO CHANGE in existing files
- Do NOT create user stories for building new components that already exist
- Focus on the specific modification needed
- Reference the target files in acceptance criteria
- ALWAYS use existing component names (e.g., use "LoginPage" if it exists, NOT "LoginForm")
- Check the existing components list above before referencing any component
` : `
## TASK MODE: CREATION
This is a CREATION request - the user wants to BUILD something new.
`;

    const userMessage = `${contextInfo}
${taskModeContext}
## USER REQUEST
${userRequest}

Generate the PRD JSON response. Remember to account for the project context and task mode above.`;

    // Call Gemini AI
    const response = await ai.generate({
      model: MODELS.FLASH,
      system: PM_SYSTEM_PROMPT,
      prompt: userMessage,
      config: {
        temperature: 0.4, // Slightly creative but mostly structured
        maxOutputTokens: 4096,
      },
    });

    const responseText = response.text || '{}';

    // Parse the JSON response
    let pmResponse: Omit<PMResponse, 'workItemId'>;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      pmResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[VAF-PM] Failed to parse response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse PM response', raw: responseText },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!pmResponse.prd || !pmResponse.prd.userStories) {
      return NextResponse.json(
        { error: 'Invalid PRD structure', raw: responseText },
        { status: 500 }
      );
    }

    console.log('[VAF-PM] Generated PRD:', {
      workItemId,
      title: pmResponse.prd.title,
      storyCount: pmResponse.prd.userStories.length,
      status: pmResponse.status,
      taskMode: effectiveTaskMode,
    });

    // Return the complete response with taskMode and targetFiles
    return NextResponse.json({
      workItemId,
      ...pmResponse,
      taskMode: effectiveTaskMode,
      targetFiles: targetFiles || [],
      nextAgent: 'vaf-architect',
    });

  } catch (error) {
    console.error('[VAF-PM] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service not configured. Please add GEMINI_API_KEY to environment.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'PM agent failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: 'VAF-PM',
    role: 'Product Manager',
    endpoint: '/api/agents/pm',
    methods: ['POST'],
    description: 'Transforms user requests into structured PRDs with user stories',
    hierarchy: {
      level: 2,
      reportsTo: ['vaf-orchestrator'],
      delegatesTo: [],
    },
    inputContract: {
      workItemId: 'string (required)',
      userRequest: 'string (required)',
      projectContext: 'object (optional)',
    },
    outputContract: {
      workItemId: 'string',
      status: 'success | needs-clarification',
      prd: 'PRD object with userStories',
      nextAgent: 'vaf-architect',
    },
  });
}
