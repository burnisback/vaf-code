/**
 * VAF-ORCHESTRATOR API Route
 *
 * The central intelligence that analyzes user requests and orchestrates
 * the multi-agent pipeline. Acts as the "CEO" of the agent factory.
 *
 * Responsibilities:
 * - Analyze user intent and request complexity
 * - Select appropriate agent(s) from the hierarchy
 * - Prepare context and instructions for each agent
 * - Determine execution order (sequential vs parallel)
 */

import { NextResponse } from 'next/server';
import { ai, MODELS } from '@/lib/ai/genkit';
import type { ProjectSummaryWithHashes } from '@/lib/ai/projectAnalyzer';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// =============================================================================
// AGENT HIERARCHY DEFINITION
// =============================================================================

const AGENT_HIERARCHY = {
  'vaf-pm': {
    name: 'VAF-PM',
    role: 'Product Manager',
    capabilities: [
      'Requirements gathering and clarification',
      'User story creation',
      'Feature prioritization',
      'Scope definition',
      'Acceptance criteria writing',
    ],
    bestFor: [
      'New feature requests',
      'Unclear requirements',
      'Project planning questions',
      'What should we build questions',
    ],
  },
  'vaf-architect': {
    name: 'VAF-Architect',
    role: 'Solution Architect',
    capabilities: [
      'Technical design decisions',
      'System architecture',
      'Technology selection',
      'Code structure planning',
      'API design',
      'Database schema design',
    ],
    bestFor: [
      'How should we build this',
      'Architecture decisions',
      'Technical approach questions',
      'Refactoring strategies',
    ],
  },
  'vaf-frontend': {
    name: 'VAF-Frontend',
    role: 'Frontend Engineer',
    capabilities: [
      'React component implementation',
      'UI/UX implementation',
      'State management',
      'Styling and CSS',
      'Client-side logic',
      'Form handling',
    ],
    bestFor: [
      'Build a component',
      'Add a button/form/page',
      'Fix UI issues',
      'Implement designs',
      'Frontend bugs',
    ],
  },
  'vaf-backend': {
    name: 'VAF-Backend',
    role: 'Backend Engineer',
    capabilities: [
      'API endpoint creation',
      'Server-side logic',
      'Database operations',
      'Authentication/Authorization',
      'Data validation',
      'Business logic',
    ],
    bestFor: [
      'Create an API',
      'Add server functionality',
      'Database operations',
      'Backend bugs',
      'Server-side features',
    ],
  },
  'vaf-designer': {
    name: 'VAF-Designer',
    role: 'UX/UI Designer',
    capabilities: [
      'User experience design',
      'Interface design recommendations',
      'Accessibility guidance',
      'Design system application',
      'User flow optimization',
    ],
    bestFor: [
      'How should this look',
      'UX improvement suggestions',
      'Accessibility questions',
      'Design feedback',
    ],
  },
  'vaf-qa': {
    name: 'VAF-QA',
    role: 'Quality Assurance',
    capabilities: [
      'Test strategy creation',
      'Test case design',
      'Bug analysis',
      'Quality verification',
      'Edge case identification',
    ],
    bestFor: [
      'Write tests for this',
      'What should we test',
      'Bug investigation',
      'Quality concerns',
    ],
  },
  'vaf-researcher': {
    name: 'VAF-Researcher',
    role: 'Research & Analysis',
    capabilities: [
      'Codebase exploration',
      'Pattern identification',
      'Dependency analysis',
      'Code understanding',
      'Documentation review',
    ],
    bestFor: [
      'Where is X defined',
      'How does Y work',
      'Find all usages of Z',
      'Explain this code',
      'Codebase questions',
    ],
  },
  'vaf-filefinder': {
    name: 'VAF-FileFinder',
    role: 'Code Navigation',
    capabilities: [
      'File location',
      'Code search',
      'Import/export tracking',
      'Reference finding',
    ],
    bestFor: [
      'Find the file that does X',
      'Where is the config for Y',
      'Which files import Z',
    ],
  },
  'vaf-validator': {
    name: 'VAF-Validator',
    role: 'Validation & Compliance',
    capabilities: [
      'Code review',
      'Best practices verification',
      'Security checks',
      'Performance review',
      'Standards compliance',
    ],
    bestFor: [
      'Review this code',
      'Is this secure',
      'Check for issues',
      'Validate implementation',
    ],
  },
} as const;

type AgentId = keyof typeof AGENT_HIERARCHY;


// =============================================================================
// ORCHESTRATOR SYSTEM PROMPT
// =============================================================================

function buildSystemPrompt(): string {
  const agentDescriptions = Object.entries(AGENT_HIERARCHY).map(([id, agent]) => `
### ${agent.name} (${id})
Role: ${agent.role}
Capabilities:
${agent.capabilities.map(c => `  - ${c}`).join('\n')}
Best for:
${agent.bestFor.map(b => `  - "${b}"`).join('\n')}
`).join('\n');

  return `You are VAF-ORCHESTRATOR, the central intelligence coordinating a multi-agent software development factory.

## YOUR ROLE
You are the "CEO" of an AI agent factory. When a user sends a request, you must:
1. ANALYZE the request to understand intent, complexity, and scope
2. SELECT the right agent(s) from your team to handle the request
3. PREPARE specific instructions and context for each selected agent
4. DETERMINE if agents should work sequentially or in parallel

## YOUR AGENT TEAM
${agentDescriptions}

## DECISION FRAMEWORK

### Step 1: Classify the Request
- Is it a QUESTION (needs research/explanation)?
- Is it a TASK (needs implementation - "build", "create", "add", "implement")?
- Is it AMBIGUOUS (needs clarification)?
- Is it COMPLEX (needs multiple agents)?

### Step 1.5: Determine Task Mode (CRITICAL for TASK requests)

**CREATION mode** (taskMode: "creation"):
- Building something that doesn't exist yet
- "Build me X", "Create X", "Add new X" where X is new
- No existing files to modify

**MODIFICATION mode** (taskMode: "modification"):
- Changing something that already exists
- "Make X the home page" (X already exists)
- "Change X to Y", "Update X", "Modify X", "Move X", "Set X as Y"
- Existing files need to be edited, not recreated

**For MODIFICATION mode, you MUST:**
1. Set taskMode: "modification" in the analysis
2. Set targetFiles: array of file paths that need to be modified
3. Instructions should describe WHAT TO CHANGE, not what to create from scratch

**Detection hints:**
- Check project context for existing files/components
- Check conversation history for recently created items
- Keywords: "make", "change", "update", "modify", "move", "set as", "use as"

**Default:** If unclear, use "creation"

### Step 2: Identify Primary Intent and Route Correctly

**MANDATORY ROUTING RULES (MUST FOLLOW):**

| Request Type | First Agent | Reasoning |
|-------------|-------------|-----------|
| Feature request ("build X", "create X", "add X", "implement X") | **vaf-pm** | PM creates PRD with user stories first |
| Modification request ("make X the home page", "change Y to Z", "update X") | **vaf-pm** | PM documents modification requirements |
| Ambiguous request ("make it better", unclear scope) | **vaf-pm** | PM clarifies requirements |
| Question about codebase ("where is X", "how does Y work") | vaf-researcher | Research task |
| Find a file ("find X", "locate Y") | vaf-filefinder | File search task |
| Bug fix with clear location | vaf-researcher then implementation agent | Need to understand first |
| Design question ("how should X look") | vaf-designer | Design task |
| Review/validation ("is this secure", "review this") | vaf-validator | Validation task |

**CRITICAL: For ANY request to BUILD, CREATE, ADD, IMPLEMENT, MODIFY, CHANGE, or UPDATE code, you MUST route to vaf-pm FIRST. This is non-negotiable.**

### Step 3: Single Agent Only
For this phase, select ONLY ONE agent. The pipeline will handle sequential calls automatically.
- Do NOT select multiple agents
- Do NOT use "after-previous" or "parallel" modes yet
- Simply identify the FIRST agent that should handle this request

### Step 4: Prepare Context for the Agent
For the selected agent, extract ONLY the relevant information:
- Relevant file paths and purposes from project summary
- Specific directories they need to focus on
- Clear, actionable instructions
- Expected output format

## CRITICAL RULES

1. **PM FIRST FOR FEATURES**: Any request to build/create/add/implement a new feature MUST go to vaf-pm first. NO EXCEPTIONS.
2. **Be Selective with Context**: Don't dump the entire project summary. Extract only what's relevant.
3. **Be Specific in Instructions**: Tell each agent EXACTLY what to do, not vague directions.
4. **Single Agent Per Response**: Select only ONE agent. The system handles the pipeline.
5. **Match Agent to Task**: A frontend task should NOT go to vaf-backend.
6. **Clarify Ambiguity**: If the request is unclear, vaf-pm should clarify requirements.

## OUTPUT FORMAT

You must respond with a valid JSON object (no markdown, no explanation):

{
  "analysis": {
    "requestType": "question" | "task" | "ambiguous" | "complex",
    "taskMode": "creation" | "modification",
    "primaryIntent": "string describing the core intent",
    "complexity": "simple" | "moderate" | "complex",
    "reasoning": "brief explanation of your decision",
    "targetFiles": ["array of file paths to modify - required for modification mode"]
  },
  "agents": [
    {
      "agentId": "vaf-xxx",
      "priority": 1,
      "executionMode": "immediate" | "after-previous" | "parallel",
      "context": {
        "relevantFiles": [
          { "path": "string", "purpose": "why this file is relevant" }
        ],
        "relevantDirectories": ["string"],
        "projectInfo": {
          "framework": "string",
          "architecture": "string"
        }
      },
      "instructions": "Detailed, specific instructions for this agent. Be precise about what to do, what to look for, and what to produce."
    }
  ],
  "userMessage": "Optional message to show the user about what's happening"
}

## EXAMPLES

### Example 1: Feature Request (MUST go to PM)
User: "Build me a login form"
-> Single agent: **vaf-pm**
-> Instructions: Create a PRD with user stories for a login form feature, including email/password fields, validation, and submit functionality.

### Example 2: Feature Request (MUST go to PM)
User: "Add a dark mode toggle"
-> Single agent: **vaf-pm**
-> Instructions: Create a PRD with user stories for dark mode functionality, including toggle mechanism, theme persistence, and affected components.

### Example 3: Simple Question
User: "Where is the login component?"
-> Single agent: vaf-filefinder
-> Instructions: Find files related to login/authentication in the component directories

### Example 4: Bug Investigation
User: "The form isn't submitting"
-> Single agent: vaf-researcher
-> Instructions: Find and analyze form-related components to understand the submission issue

### Example 5: Ambiguous Request
User: "Make it better"
-> Single agent: vaf-pm
-> Instructions: Clarify what "better" means, gather specific requirements from the user

### Example 6: Modification Request (MUST go to PM)
User: "Make the login page the home page"
-> taskMode: "modification"
-> targetFiles: ["src/App.jsx"] (identified from project context)
-> Single agent: **vaf-pm**
-> Instructions: Create modification requirements to change App.jsx to render LoginForm as the main component. The login page already exists - this is an EDIT to existing code, not creation of new files.

### Example 7: Modification Request (MUST go to PM)
User: "Change the button color to red"
-> taskMode: "modification"
-> targetFiles: ["src/components/Button.jsx"] (identified from project context)
-> Single agent: **vaf-pm**
-> Instructions: Document the modification to Button component - change color tokens. This is an EDIT to existing Button.jsx, not creation of new files.

REMEMBER:
- "build", "create", "add", "implement" = vaf-pm with taskMode: "creation"
- "make X the Y", "change", "update", "modify" existing = vaf-pm with taskMode: "modification" + targetFiles

Now analyze the user's request and produce your JSON response.`;
}


// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

interface ConversationMessage {
  role: string;
  content: string;
  filesCreated?: string[];
}

interface OrchestratorRequest {
  prompt: string;
  projectSummary: ProjectSummaryWithHashes | null;
  conversationHistory?: ConversationMessage[];
}

interface AgentAssignment {
  agentId: string;
  priority: number;
  executionMode: 'immediate' | 'after-previous' | 'parallel';
  context: {
    relevantFiles: Array<{ path: string; purpose: string }>;
    relevantDirectories: string[];
    projectInfo: {
      framework: string;
      architecture: string;
    };
  };
  instructions: string;
}

interface OrchestratorResponse {
  analysis: {
    requestType: 'question' | 'task' | 'ambiguous' | 'complex';
    taskMode: 'creation' | 'modification';  // NEW: distinguishes create vs modify
    primaryIntent: string;
    complexity: 'simple' | 'moderate' | 'complex';
    reasoning: string;
    targetFiles?: string[];  // NEW: files to modify (for modification mode)
  };
  agents: AgentAssignment[];
  userMessage?: string;
}

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json() as OrchestratorRequest;
    const { prompt, projectSummary } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required and must be a string' },
        { status: 400 }
      );
    }

    // Quick-fix bypass: Detect dependency errors in user prompt
    const detectDependencyError = (text: string): string[] => {
      const packages: string[] = [];

      // Pattern 1: Failed to resolve import "package-name"
      const resolvePattern = /Failed to resolve import ["']([^"']+)["']/gi;
      let match;
      while ((match = resolvePattern.exec(text)) !== null) {
        const pkg = match[1];
        if (!pkg.startsWith('.') && !pkg.startsWith('/') && !pkg.startsWith('@/')) {
          packages.push(pkg.split('/').slice(0, pkg.startsWith('@') ? 2 : 1).join('/'));
        }
      }

      // Pattern 2: Cannot find module 'package-name'
      const modulePattern = /Cannot find module ["']([^"']+)["']/gi;
      while ((match = modulePattern.exec(text)) !== null) {
        const pkg = match[1];
        if (!pkg.startsWith('.') && !pkg.startsWith('/') && !pkg.startsWith('@/')) {
          packages.push(pkg.split('/').slice(0, pkg.startsWith('@') ? 2 : 1).join('/'));
        }
      }

      // Pattern 3: Can't resolve 'package-name'
      const cantResolvePattern = /Can't resolve ["']([^"']+)["']/gi;
      while ((match = cantResolvePattern.exec(text)) !== null) {
        const pkg = match[1];
        if (!pkg.startsWith('.') && !pkg.startsWith('/') && !pkg.startsWith('@/')) {
          packages.push(pkg.split('/').slice(0, pkg.startsWith('@') ? 2 : 1).join('/'));
        }
      }

      return [...new Set(packages)];
    };

    const missingPackages = detectDependencyError(prompt);

    // If dependency error detected, return quick-fix response (bypass full pipeline)
    if (missingPackages.length > 0) {
      console.log('[VAF-ORCHESTRATOR] Detected dependency error, returning quick-fix:', missingPackages);

      return NextResponse.json({
        success: true,
        quickFix: {
          type: 'install-dependency',
          packages: missingPackages,
          message: `Installing missing dependencies: ${missingPackages.join(', ')}`,
        },
        analysis: {
          requestType: 'task' as const,
          taskMode: 'modification' as const,
          primaryIntent: `Install missing npm package(s): ${missingPackages.join(', ')}`,
          complexity: 'simple' as const,
          reasoning: 'Detected dependency error in prompt - bypassing full pipeline for quick npm install',
          targetFiles: [],
        },
        agents: [], // No agents needed - frontend will handle npm install directly
      });
    }

    console.log('[VAF-ORCHESTRATOR] Received request:', {
      promptLength: prompt.length,
      hasProjectSummary: !!projectSummary,
      projectName: projectSummary?.name,
    });

    // Build the user message with project context
    const projectContext = projectSummary ? `
## PROJECT CONTEXT

Project: ${projectSummary.name}
Description: ${projectSummary.description}
Framework: ${projectSummary.technology?.framework || 'Unknown'}
Language: ${projectSummary.technology?.language || 'Unknown'}
Architecture: ${projectSummary.architecture?.pattern || 'Unknown'}

### Key Files
${projectSummary.files?.filter(f => f.type === 'file').slice(0, 30).map(f =>
  `- ${f.path}: ${f.purpose} [${f.category}]`
).join('\n') || 'No files analyzed'}

### Entry Points
${projectSummary.architecture?.entryPoints?.join(', ') || 'None identified'}

### Key Modules
${projectSummary.architecture?.keyModules?.join(', ') || 'None identified'}

### Existing Components (IMPORTANT for modifications)
${projectSummary.files?.filter(f => f.path.includes('/components/') && f.type === 'file').map(f => {
  const fileName = f.path.split('/').pop() || '';
  return `- ${fileName.replace(/\.(jsx|tsx|js|ts)$/, '')}`;
}).join('\n') || 'None identified'}

### Existing Pages
${projectSummary.files?.filter(f => f.path.includes('/pages/') && f.type === 'file').map(f => {
  const fileName = f.path.split('/').pop() || '';
  return `- ${fileName.replace(/\.(jsx|tsx|js|ts)$/, '')}`;
}).join('\n') || 'None identified'}

### Technology Stack
- Styling: ${projectSummary.technology?.styling?.join(', ') || 'Unknown'}
- State Management: ${projectSummary.technology?.stateManagement?.join(', ') || 'Unknown'}
- Testing: ${projectSummary.technology?.testing?.join(', ') || 'Unknown'}
` : `
## PROJECT CONTEXT
No project analysis available. Recommend running project analysis first for better assistance.
`;

    // Build conversation history context
    const historyContext = body.conversationHistory && body.conversationHistory.length > 0 ? `
## CONVERSATION HISTORY (IMPORTANT CONTEXT)
The user has made previous requests in this session. Consider this context when analyzing the current request.

${body.conversationHistory.slice(-5).map((msg, i) => `
### Previous Request ${i + 1}
- User asked: "${msg.content}"
${msg.filesCreated && msg.filesCreated.length > 0 ? `- Files created: ${msg.filesCreated.join(', ')}` : ''}
`).join('\n')}

NOTE: Even if this request modifies something created previously, it should STILL go to vaf-pm first. The PM will have context about existing files and create appropriate requirements for the modification. The full pipeline (PM → Architect → Frontend) ensures proper planning even for changes.
` : '';

    const userMessage = `${projectContext}
${historyContext}
## USER REQUEST
${prompt}

Analyze this request and provide your JSON response.`;

    // Call Gemini AI
    const response = await ai.generate({
      model: MODELS.FLASH,
      system: buildSystemPrompt(),
      prompt: userMessage,
      config: {
        temperature: 0.3, // Lower temperature for more consistent decisions
        maxOutputTokens: 2048,
      },
    });

    const responseText = response.text || '{}';

    // Parse the JSON response
    let orchestratorResponse: OrchestratorResponse;
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      orchestratorResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[VAF-ORCHESTRATOR] Failed to parse response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse orchestrator response', raw: responseText },
        { status: 500 }
      );
    }

    // Validate the response structure
    if (!orchestratorResponse.analysis || !orchestratorResponse.agents) {
      return NextResponse.json(
        { error: 'Invalid orchestrator response structure', raw: responseText },
        { status: 500 }
      );
    }

    console.log('[VAF-ORCHESTRATOR] Decision:', {
      requestType: orchestratorResponse.analysis.requestType,
      complexity: orchestratorResponse.analysis.complexity,
      agentCount: orchestratorResponse.agents.length,
      agents: orchestratorResponse.agents.map(a => a.agentId),
    });

    return NextResponse.json({
      success: true,
      ...orchestratorResponse,
    });

  } catch (error) {
    console.error('[VAF-ORCHESTRATOR] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service not configured. Please add GEMINI_API_KEY to environment.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Orchestrator failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/orchestrator',
    methods: ['POST'],
    description: 'VAF-ORCHESTRATOR: Analyzes requests and delegates to specialized agents',
    agents: Object.keys(AGENT_HIERARCHY),
  });
}
