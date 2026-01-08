/**
 * VAF-DESIGNER Agent API Route
 *
 * The UX/UI Designer agent that creates style guides and component specifications.
 * Ensures visual consistency by defining design tokens and component variants.
 *
 * Hierarchy Position: Level 2 (Reports to ARCHITECT)
 * Can Communicate With: ARCHITECT (upstream)
 * Can Delegate To: None
 */

import { NextResponse } from 'next/server';
import { ai, MODELS } from '@/lib/ai/genkit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ComponentSpec {
  name: string;
  type: 'page' | 'container' | 'presentational' | 'hook' | 'utility' | 'api';
  path: string;
  description: string;
  props?: Array<{ name: string; type: string; required: boolean }>;
  children?: string[];
  dependencies?: string[];
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

interface DesignToken {
  name: string;
  value: string;
  category: 'color' | 'spacing' | 'typography' | 'shadow' | 'border' | 'other';
}

interface ComponentDesignSpec {
  component: string;
  variants: string[];
  states: string[];
  tokens: Record<string, string>;
  accessibility: {
    role?: string;
    ariaLabel?: string;
    focusable: boolean;
    keyboardNav?: string[];
  };
}

interface StyleGuide {
  exists: boolean;
  created: boolean;
  path: string;
  tokens: DesignToken[];
}

interface DesignerRequest {
  workItemId: string;
  components: ComponentSpec[];
  workItemContext?: WorkItemContext;
  existingStyleGuide?: string; // Contents of existing style guide if any
  taskMode?: 'creation' | 'modification';  // From architect
  targetFiles?: string[];  // Files to modify (for modification mode)
}

interface DesignerResponse {
  workItemId: string;
  status: 'success' | 'needs-clarification';
  styleGuide: StyleGuide;
  componentSpecs: ComponentDesignSpec[];
  recommendations: string[];
  nextAgent: 'vaf-frontend';
}

// =============================================================================
// STYLING-SPECIFIC GUIDANCE
// =============================================================================

function getStylingGuidelines(styling: string): string {
  switch (styling) {
    case 'Tailwind CSS':
      return `### Tailwind CSS Classes
- Colors: bg-{color}-{shade}, text-{color}-{shade}
- Spacing: p-{size}, m-{size}, gap-{size}
- Typography: text-{size}, font-{weight}
- Borders: border, rounded-{size}
- Shadows: shadow-{size}
- States: hover:, focus:, active:, disabled: prefixes`;

    case 'Styled Components':
      return `### Styled Components
- Use template literals for CSS: styled.div\`...\`
- Define CSS custom properties for tokens: --color-primary, --spacing-md
- Use props for variants: \${props => props.variant === 'primary' && css\`...\`}
- States via &:hover, &:focus, &:active, &:disabled selectors
- Export styled components with descriptive names`;

    case 'Emotion':
      return `### Emotion CSS-in-JS
- Use css prop or styled API: css\`...\` or styled.div\`...\`
- Define CSS custom properties for tokens: --color-primary, --spacing-md
- Use props for variants and conditional styles
- States via &:hover, &:focus, &:active, &:disabled selectors
- Can combine with className for hybrid approaches`;

    case 'Sass':
      return `### Sass/SCSS
- Use variables for tokens: $color-primary, $spacing-md
- Use mixins for reusable patterns: @mixin button-base { ... }
- Nesting for states: &:hover, &:focus, &:active, &:disabled
- Use BEM naming: .button, .button--primary, .button__icon
- Organize in partials: _variables.scss, _mixins.scss, _components.scss`;

    case 'CSS Modules':
      return `### CSS Modules
- Use camelCase class names: styles.buttonPrimary
- Define CSS custom properties for tokens: --color-primary, --spacing-md
- Compose classes: composes: base from './base.module.css'
- States via &:hover, &:focus, &:active, &:disabled selectors
- File naming: Component.module.css`;

    default: // Plain CSS
      return `### Plain CSS
- Use CSS custom properties for tokens: --color-primary, --spacing-md
- Use BEM naming convention: .button, .button--primary, .button__icon
- States via :hover, :focus, :active, :disabled selectors
- Organize by component: button.css, form.css, layout.css
- Use CSS variables for theming and consistency`;
  }
}

function getStylingExample(styling: string): string {
  switch (styling) {
    case 'Tailwind CSS':
      return `{
  "status": "success",
  "styleGuide": {
    "exists": false,
    "created": true,
    "path": "docs/design/style-guide.md",
    "tokens": [
      { "name": "primary", "value": "bg-blue-600", "category": "color" },
      { "name": "primary-hover", "value": "bg-blue-700", "category": "color" },
      { "name": "error", "value": "text-red-500", "category": "color" },
      { "name": "input-border", "value": "border-gray-300", "category": "border" },
      { "name": "focus-ring", "value": "ring-2 ring-blue-500", "category": "border" }
    ]
  },
  "componentSpecs": [
    {
      "component": "TextField",
      "variants": ["default", "error"],
      "states": ["default", "focus", "error", "disabled"],
      "tokens": {
        "bgColor": "bg-white",
        "borderColor": "border-gray-300",
        "focusBorder": "focus:border-blue-500 focus:ring-2 focus:ring-blue-500",
        "errorBorder": "border-red-500",
        "textColor": "text-gray-900",
        "padding": "px-3 py-2",
        "borderRadius": "rounded-md"
      },
      "accessibility": {
        "role": "textbox",
        "focusable": true,
        "keyboardNav": ["Tab"]
      }
    },
    {
      "component": "Button",
      "variants": ["primary", "secondary"],
      "states": ["default", "hover", "active", "disabled", "loading"],
      "tokens": {
        "bgColor": "bg-blue-600",
        "hoverBgColor": "hover:bg-blue-700",
        "activeBgColor": "active:bg-blue-800",
        "disabledBgColor": "bg-gray-400",
        "textColor": "text-white",
        "padding": "px-4 py-2",
        "borderRadius": "rounded-md",
        "fontWeight": "font-medium"
      },
      "accessibility": {
        "role": "button",
        "focusable": true,
        "keyboardNav": ["Enter", "Space"]
      }
    }
  ],
  "recommendations": [
    "Add password visibility toggle for better UX",
    "Consider adding 'Remember me' checkbox"
  ],
  "nextAgent": "vaf-frontend"
}`;

    case 'Styled Components':
    case 'Emotion':
      return `{
  "status": "success",
  "styleGuide": {
    "exists": false,
    "created": true,
    "path": "docs/design/style-guide.md",
    "tokens": [
      { "name": "--color-primary", "value": "#2563eb", "category": "color" },
      { "name": "--color-primary-hover", "value": "#1d4ed8", "category": "color" },
      { "name": "--color-error", "value": "#ef4444", "category": "color" },
      { "name": "--border-input", "value": "#d1d5db", "category": "border" },
      { "name": "--spacing-sm", "value": "0.5rem", "category": "spacing" },
      { "name": "--spacing-md", "value": "1rem", "category": "spacing" },
      { "name": "--radius-md", "value": "0.375rem", "category": "border" }
    ]
  },
  "componentSpecs": [
    {
      "component": "TextField",
      "variants": ["default", "error"],
      "states": ["default", "focus", "error", "disabled"],
      "tokens": {
        "bgColor": "var(--color-white)",
        "borderColor": "var(--border-input)",
        "focusBorderColor": "var(--color-primary)",
        "errorBorderColor": "var(--color-error)",
        "textColor": "var(--color-gray-900)",
        "padding": "var(--spacing-sm) var(--spacing-md)",
        "borderRadius": "var(--radius-md)"
      },
      "accessibility": {
        "role": "textbox",
        "focusable": true,
        "keyboardNav": ["Tab"]
      }
    },
    {
      "component": "Button",
      "variants": ["primary", "secondary"],
      "states": ["default", "hover", "active", "disabled", "loading"],
      "tokens": {
        "bgColor": "var(--color-primary)",
        "hoverBgColor": "var(--color-primary-hover)",
        "textColor": "var(--color-white)",
        "padding": "var(--spacing-sm) var(--spacing-md)",
        "borderRadius": "var(--radius-md)",
        "fontWeight": "500"
      },
      "accessibility": {
        "role": "button",
        "focusable": true,
        "keyboardNav": ["Enter", "Space"]
      }
    }
  ],
  "recommendations": [
    "Define theme object with all CSS custom properties",
    "Use ThemeProvider for consistent token access"
  ],
  "nextAgent": "vaf-frontend"
}`;

    case 'Sass':
      return `{
  "status": "success",
  "styleGuide": {
    "exists": false,
    "created": true,
    "path": "docs/design/style-guide.md",
    "tokens": [
      { "name": "$color-primary", "value": "#2563eb", "category": "color" },
      { "name": "$color-primary-hover", "value": "#1d4ed8", "category": "color" },
      { "name": "$color-error", "value": "#ef4444", "category": "color" },
      { "name": "$border-input", "value": "#d1d5db", "category": "border" },
      { "name": "$spacing-sm", "value": "0.5rem", "category": "spacing" },
      { "name": "$spacing-md", "value": "1rem", "category": "spacing" },
      { "name": "$radius-md", "value": "0.375rem", "category": "border" }
    ]
  },
  "componentSpecs": [
    {
      "component": "TextField",
      "variants": ["default", "error"],
      "states": ["default", "focus", "error", "disabled"],
      "tokens": {
        "bgColor": "$color-white",
        "borderColor": "$border-input",
        "focusBorderColor": "$color-primary",
        "errorBorderColor": "$color-error",
        "textColor": "$color-gray-900",
        "padding": "$spacing-sm $spacing-md",
        "borderRadius": "$radius-md",
        "className": ".text-field, .text-field--error"
      },
      "accessibility": {
        "role": "textbox",
        "focusable": true,
        "keyboardNav": ["Tab"]
      }
    },
    {
      "component": "Button",
      "variants": ["primary", "secondary"],
      "states": ["default", "hover", "active", "disabled", "loading"],
      "tokens": {
        "bgColor": "$color-primary",
        "hoverBgColor": "$color-primary-hover",
        "textColor": "$color-white",
        "padding": "$spacing-sm $spacing-md",
        "borderRadius": "$radius-md",
        "fontWeight": "500",
        "className": ".button, .button--primary, .button--secondary"
      },
      "accessibility": {
        "role": "button",
        "focusable": true,
        "keyboardNav": ["Enter", "Space"]
      }
    }
  ],
  "recommendations": [
    "Create _variables.scss for all token definitions",
    "Use @mixin for repeated styling patterns"
  ],
  "nextAgent": "vaf-frontend"
}`;

    case 'CSS Modules':
      return `{
  "status": "success",
  "styleGuide": {
    "exists": false,
    "created": true,
    "path": "docs/design/style-guide.md",
    "tokens": [
      { "name": "--color-primary", "value": "#2563eb", "category": "color" },
      { "name": "--color-primary-hover", "value": "#1d4ed8", "category": "color" },
      { "name": "--color-error", "value": "#ef4444", "category": "color" },
      { "name": "--border-input", "value": "#d1d5db", "category": "border" },
      { "name": "--spacing-sm", "value": "0.5rem", "category": "spacing" },
      { "name": "--spacing-md", "value": "1rem", "category": "spacing" },
      { "name": "--radius-md", "value": "0.375rem", "category": "border" }
    ]
  },
  "componentSpecs": [
    {
      "component": "TextField",
      "variants": ["default", "error"],
      "states": ["default", "focus", "error", "disabled"],
      "tokens": {
        "bgColor": "var(--color-white)",
        "borderColor": "var(--border-input)",
        "focusBorderColor": "var(--color-primary)",
        "errorBorderColor": "var(--color-error)",
        "textColor": "var(--color-gray-900)",
        "padding": "var(--spacing-sm) var(--spacing-md)",
        "borderRadius": "var(--radius-md)",
        "moduleClass": "styles.textField, styles.textFieldError"
      },
      "accessibility": {
        "role": "textbox",
        "focusable": true,
        "keyboardNav": ["Tab"]
      }
    },
    {
      "component": "Button",
      "variants": ["primary", "secondary"],
      "states": ["default", "hover", "active", "disabled", "loading"],
      "tokens": {
        "bgColor": "var(--color-primary)",
        "hoverBgColor": "var(--color-primary-hover)",
        "textColor": "var(--color-white)",
        "padding": "var(--spacing-sm) var(--spacing-md)",
        "borderRadius": "var(--radius-md)",
        "fontWeight": "500",
        "moduleClass": "styles.button, styles.buttonPrimary"
      },
      "accessibility": {
        "role": "button",
        "focusable": true,
        "keyboardNav": ["Enter", "Space"]
      }
    }
  ],
  "recommendations": [
    "Create variables.css with all CSS custom properties",
    "Use composes for shared base styles"
  ],
  "nextAgent": "vaf-frontend"
}`;

    default: // Plain CSS
      return `{
  "status": "success",
  "styleGuide": {
    "exists": false,
    "created": true,
    "path": "docs/design/style-guide.md",
    "tokens": [
      { "name": "--color-primary", "value": "#2563eb", "category": "color" },
      { "name": "--color-primary-hover", "value": "#1d4ed8", "category": "color" },
      { "name": "--color-error", "value": "#ef4444", "category": "color" },
      { "name": "--border-input", "value": "#d1d5db", "category": "border" },
      { "name": "--spacing-sm", "value": "0.5rem", "category": "spacing" },
      { "name": "--spacing-md", "value": "1rem", "category": "spacing" },
      { "name": "--radius-md", "value": "0.375rem", "category": "border" }
    ]
  },
  "componentSpecs": [
    {
      "component": "TextField",
      "variants": ["default", "error"],
      "states": ["default", "focus", "error", "disabled"],
      "tokens": {
        "bgColor": "var(--color-white)",
        "borderColor": "var(--border-input)",
        "focusBorderColor": "var(--color-primary)",
        "errorBorderColor": "var(--color-error)",
        "textColor": "var(--color-gray-900)",
        "padding": "var(--spacing-sm) var(--spacing-md)",
        "borderRadius": "var(--radius-md)",
        "className": ".text-field, .text-field--error"
      },
      "accessibility": {
        "role": "textbox",
        "focusable": true,
        "keyboardNav": ["Tab"]
      }
    },
    {
      "component": "Button",
      "variants": ["primary", "secondary"],
      "states": ["default", "hover", "active", "disabled", "loading"],
      "tokens": {
        "bgColor": "var(--color-primary)",
        "hoverBgColor": "var(--color-primary-hover)",
        "textColor": "var(--color-white)",
        "padding": "var(--spacing-sm) var(--spacing-md)",
        "borderRadius": "var(--radius-md)",
        "fontWeight": "500",
        "className": ".button, .button--primary, .button--secondary"
      },
      "accessibility": {
        "role": "button",
        "focusable": true,
        "keyboardNav": ["Enter", "Space"]
      }
    }
  ],
  "recommendations": [
    "Create variables.css with all CSS custom properties",
    "Use BEM naming for consistent class structure"
  ],
  "nextAgent": "vaf-frontend"
}`;
  }
}

// =============================================================================
// DESIGNER AGENT SYSTEM PROMPT (BASE)
// =============================================================================

function getDesignerSystemPrompt(styling: string): string {
  return `You are VAF-DESIGNER, the UX/UI Designer agent in a multi-agent software factory.

## YOUR ROLE
Create design specifications and style guides that ensure visual consistency across components.

## YOUR RESPONSIBILITIES
1. Define design tokens (colors, spacing, typography)
2. Create component variants and states
3. Ensure accessibility compliance
4. Recommend existing design system usage
5. Keep designs consistent with project styling approach

## OUTPUT FORMAT
You must respond with valid JSON (no markdown, no explanation):

{
  "status": "success" | "needs-clarification",
  "styleGuide": {
    "exists": boolean,
    "created": boolean,
    "path": "docs/design/style-guide.md",
    "tokens": [
      {
        "name": "token-name",
        "value": "token-value",
        "category": "color"
      }
    ]
  },
  "componentSpecs": [
    {
      "component": "ComponentName",
      "variants": ["primary", "secondary", "ghost"],
      "states": ["default", "hover", "active", "disabled", "loading"],
      "tokens": {
        "bgColor": "...",
        "textColor": "...",
        "padding": "...",
        "borderRadius": "..."
      },
      "accessibility": {
        "role": "button",
        "focusable": true,
        "keyboardNav": ["Enter", "Space"]
      }
    }
  ],
  "recommendations": [
    "Use existing Button component from design system",
    "Consider adding loading spinner for async actions"
  ],
  "nextAgent": "vaf-frontend"
}

## DESIGN GUIDELINES

${getStylingGuidelines(styling)}

### Component States
Every interactive component should define:
- default: Base state
- hover: Mouse over
- active/pressed: Being clicked
- focus: Keyboard focus
- disabled: Cannot interact
- loading: Async operation in progress (if applicable)

### Accessibility Requirements
- All buttons must have clear labels
- Form inputs need associated labels
- Focus states must be visible
- Color contrast must meet WCAG AA (4.5:1 for text)
- Interactive elements need keyboard support

### Variant Naming
- primary: Main action
- secondary: Alternative action
- ghost/outline: Subtle action
- destructive/danger: Delete/warning action

## EXAMPLE (${styling})

Components: [TextField, Button, LoginForm]

Response:
${getStylingExample(styling)}

Now create design specifications for the provided components.`;
}

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json() as DesignerRequest;
    const { workItemId, components, workItemContext } = body;

    if (!workItemId || !components) {
      return NextResponse.json(
        { error: 'workItemId and components are required' },
        { status: 400 }
      );
    }

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

    console.log('[VAF-DESIGNER] Processing request:', {
      workItemId,
      componentCount: components.length,
      componentNames: components.map(c => c.name),
      styling: ctx.styling,
    });

    // Build context info
    const contextInfo = `
## PROJECT CONTEXT
- Framework: ${ctx.framework} (${ctx.frameworkType})
- Styling Approach: ${ctx.styling}
- Language: ${ctx.language}

### Existing Components (can reference for consistency)
${ctx.existingComponents.length > 0 ? ctx.existingComponents.map(c => `- ${c}`).join('\n') : '- None'}
`;

    const componentList = `
## COMPONENTS TO DESIGN

${components.map(c => `
### ${c.name}
- Type: ${c.type}
- Path: ${c.path}
- Description: ${c.description}
${c.props ? `- Props: ${c.props.map(p => `${p.name}: ${p.type}`).join(', ')}` : ''}
${c.children ? `- Children: ${c.children.join(', ')}` : ''}
`).join('\n')}
`;

    // Include existing style guide context if available
    const existingGuideContext = body.existingStyleGuide ? `
## EXISTING STYLE GUIDE (MUST FOLLOW)
The project already has a style guide. You MUST follow these established tokens and patterns:

${body.existingStyleGuide}

Ensure your component specs use the tokens defined above for consistency.
` : '';

    const userMessage = `${contextInfo}
${existingGuideContext}
${componentList}

Create design specifications for these components. ${body.existingStyleGuide ? 'Follow the existing style guide tokens.' : 'Create new style guide tokens.'} Use ${ctx.styling} classes. Return JSON only.`;

    // Call Gemini AI
    const response = await ai.generate({
      model: MODELS.FLASH,
      system: getDesignerSystemPrompt(ctx.styling),
      prompt: userMessage,
      config: {
        temperature: 0.4, // Slightly creative for design choices
        maxOutputTokens: 4096,
      },
    });

    const responseText = response.text || '{}';

    // Parse the JSON response
    let designerResponse: Omit<DesignerResponse, 'workItemId'>;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      designerResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[VAF-DESIGNER] Failed to parse response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse Designer response', raw: responseText },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!designerResponse.componentSpecs) {
      return NextResponse.json(
        { error: 'Invalid designer response structure', raw: responseText },
        { status: 500 }
      );
    }

    console.log('[VAF-DESIGNER] Generated design specs:', {
      workItemId,
      specCount: designerResponse.componentSpecs.length,
      hasStyleGuide: designerResponse.styleGuide?.exists || designerResponse.styleGuide?.created,
      status: designerResponse.status,
    });

    // Return the complete response
    return NextResponse.json({
      workItemId,
      ...designerResponse,
      nextAgent: 'vaf-frontend',
    });

  } catch (error) {
    console.error('[VAF-DESIGNER] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service not configured. Please add GEMINI_API_KEY to environment.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Designer agent failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: 'VAF-DESIGNER',
    role: 'UX/UI Designer',
    endpoint: '/api/agents/designer',
    methods: ['POST'],
    description: 'Creates style guides and component design specifications',
    hierarchy: {
      level: 2,
      reportsTo: ['vaf-architect'],
      delegatesTo: [],
    },
    inputContract: {
      workItemId: 'string (required)',
      components: 'ComponentSpec[] (required)',
      workItemContext: 'object (optional)',
    },
    outputContract: {
      workItemId: 'string',
      status: 'success | needs-clarification',
      styleGuide: 'StyleGuide object',
      componentSpecs: 'ComponentDesignSpec[]',
      recommendations: 'string[]',
      nextAgent: 'vaf-frontend',
    },
  });
}
