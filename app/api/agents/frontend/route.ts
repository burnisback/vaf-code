/**
 * VAF-FRONTEND Agent API Route
 *
 * The Frontend Engineer agent that generates React component code based on
 * architecture and design specifications.
 *
 * Hierarchy Position: Level 2 (Reports to ARCHITECT)
 * Can Communicate With: ARCHITECT (upstream)
 * Can Delegate To: None
 */

import { NextResponse } from 'next/server';
import { ai, MODELS } from '@/lib/ai/genkit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Longer timeout for code generation

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

interface FileEdit {
  oldContent: string;
  newContent: string;
}

interface FileOperation {
  type: 'create' | 'edit' | 'delete';
  path: string;
  content: string;  // Full content for 'create', empty for 'edit'
  description: string;
  edits?: FileEdit[];  // NEW: for 'edit' operations - array of find/replace
}

interface FixErrorsContext {
  errors: string;
  previousFiles: FileOperation[];
}

interface ExistingFileContent {
  path: string;
  content: string;
}

interface FrontendRequest {
  workItemId: string;
  architecture: Architecture;
  designSpecs: ComponentDesignSpec[];
  workItemContext?: WorkItemContext;
  fixErrors?: FixErrorsContext;
  taskMode?: 'creation' | 'modification';  // NEW: from architect
  targetFiles?: string[];  // NEW: files to modify
  existingFileContents?: ExistingFileContent[];  // NEW: current content of files to edit
}

interface FrontendResponse {
  workItemId: string;
  status: 'success' | 'partial' | 'failed';
  fileOperations: FileOperation[];
  implementedComponents: string[];
  errors?: string[];
  nextAgent: 'vaf-unit-test' | 'vaf-validator';
}

// =============================================================================
// STYLING APPROACH HELPERS
// =============================================================================

type StylingApproach = 'tailwind' | 'css-variables' | 'css-modules' | 'styled-components' | 'plain-css';

/**
 * Detect the styling approach from the context styling string
 */
function detectStylingApproach(styling: string): StylingApproach {
  const normalizedStyling = styling.toLowerCase();

  if (normalizedStyling.includes('tailwind')) {
    return 'tailwind';
  }
  if (normalizedStyling.includes('styled-component') || normalizedStyling.includes('styled component')) {
    return 'styled-components';
  }
  if (normalizedStyling.includes('css module') || normalizedStyling.includes('css-module')) {
    return 'css-modules';
  }
  if (normalizedStyling.includes('css variable') || normalizedStyling.includes('css-variable') || normalizedStyling.includes('custom properties')) {
    return 'css-variables';
  }
  // Default to plain CSS (which uses CSS variables from design tokens)
  return 'plain-css';
}

/**
 * Check if design tokens contain CSS variable format (e.g., --color-primary)
 */
function hasCSSVariableTokens(designSpecs: ComponentDesignSpec[]): boolean {
  if (!designSpecs || designSpecs.length === 0) return false;

  for (const spec of designSpecs) {
    for (const value of Object.values(spec.tokens)) {
      if (typeof value === 'string' && (value.includes('--') || value.includes('var('))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get styling-specific code generation guidance based on styling approach
 */
function getStylingGuidance(approach: StylingApproach): string {
  switch (approach) {
    case 'tailwind':
      return `
### STYLING APPROACH: Tailwind CSS
Use Tailwind utility classes directly in className attributes.

Example from designSpecs:
\`\`\`json
{
  "tokens": {
    "bgColor": "bg-blue-600",
    "textColor": "text-white",
    "padding": "px-4 py-2",
    "borderRadius": "rounded-md"
  }
}
\`\`\`

How to apply:
\`\`\`jsx
// CORRECT - Use utility classes directly
<button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
  Click me
</button>

// Include states
const classes = "bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400";
\`\`\`
`;

    case 'css-variables':
    case 'plain-css':
      return `
### STYLING APPROACH: CSS Variables / Plain CSS
Use CSS custom properties (variables) with inline styles or CSS classes.
When design tokens contain CSS variable format (e.g., --color-primary: #6C63FF), you must:
1. Create a CSS file with the variables
2. Use inline styles or CSS classes to apply them

Example from designSpecs with CSS variables:
\`\`\`json
{
  "tokens": {
    "primaryColor": "--color-primary: #6C63FF",
    "textColor": "--color-text: #333333",
    "spacing": "--spacing-md: 1rem"
  }
}
\`\`\`

How to apply:
\`\`\`jsx
// OPTION 1: Inline styles with CSS variables
<button
  style={{
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-text)',
    padding: 'var(--spacing-md)'
  }}
>
  Click me
</button>

// OPTION 2: Import CSS and use classes
import './Button.css';

<button className="button button--primary">
  Click me
</button>
\`\`\`

**CRITICAL**: You MUST create a CSS variables file (e.g., src/styles/variables.css) with:
\`\`\`css
:root {
  --color-primary: #6C63FF;
  --color-text: #333333;
  --spacing-md: 1rem;
}
\`\`\`

And component-specific CSS files if using classes:
\`\`\`css
/* Button.css */
.button {
  padding: var(--spacing-md);
  border-radius: 0.375rem;
  font-weight: 500;
  transition: background-color 0.2s;
}
.button--primary {
  background-color: var(--color-primary);
  color: white;
}
.button--primary:hover {
  filter: brightness(0.9);
}
\`\`\`

**NEVER** use CSS variables as className strings like \`className="var(--color-primary)"\` - that is INVALID.
**NEVER** use \`className="bg-var(--color-primary)"\` - that is INVALID Tailwind syntax.
`;

    case 'css-modules':
      return `
### STYLING APPROACH: CSS Modules
Use CSS Modules with imported styles object.

Example from designSpecs:
\`\`\`json
{
  "tokens": {
    "primaryColor": "#6C63FF",
    "textColor": "#333333"
  }
}
\`\`\`

How to apply:
\`\`\`jsx
import styles from './Button.module.css';

<button className={styles.button}>
  Click me
</button>

// Multiple classes
<button className={\`\${styles.button} \${styles.primary}\`}>
  Click me
</button>
\`\`\`

**CRITICAL**: Create corresponding .module.css files for each component:
\`\`\`css
/* Button.module.css */
.button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: background-color 0.2s;
}
.primary {
  background-color: #6C63FF;
  color: white;
}
.primary:hover {
  background-color: #5a52e0;
}
\`\`\`
`;

    case 'styled-components':
      return `
### STYLING APPROACH: Styled Components
Use styled-components for CSS-in-JS styling.

Example from designSpecs:
\`\`\`json
{
  "tokens": {
    "primaryColor": "#6C63FF",
    "textColor": "#333333",
    "spacing": "1rem"
  }
}
\`\`\`

How to apply:
\`\`\`jsx
import styled from 'styled-components';

const StyledButton = styled.button\`
  background-color: var(--color-primary, #6C63FF);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: background-color 0.2s;
  border: none;
  cursor: pointer;

  &:hover {
    background-color: #5a52e0;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
\`;

function Button({ children, ...props }) {
  return <StyledButton {...props}>{children}</StyledButton>;
}
\`\`\`

If design tokens include CSS variables, also create a global styles file with createGlobalStyle.
`;

    default:
      return '';
  }
}

/**
 * Get example code for the detected styling approach
 */
function getStylingExample(approach: StylingApproach, language: 'javascript' | 'typescript'): string {
  const isTS = language === 'typescript';

  switch (approach) {
    case 'tailwind':
      return isTS ? `
### Example Component (Tailwind + TypeScript):
\`\`\`tsx
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick?: () => void;
}

function Button({ children, variant = 'primary', disabled = false, onClick }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400 disabled:bg-gray-100',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={\`\${baseClasses} \${variantClasses[variant]}\`}
    >
      {children}
    </button>
  );
}

export default Button;
\`\`\`
` : `
### Example Component (Tailwind + JavaScript):
\`\`\`jsx
import React from 'react';
import PropTypes from 'prop-types';

function Button({ children, variant = 'primary', disabled = false, onClick }) {
  const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400 disabled:bg-gray-100',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={\`\${baseClasses} \${variantClasses[variant]}\`}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary']),
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
};

export default Button;
\`\`\`
`;

    case 'css-variables':
    case 'plain-css':
      return isTS ? `
### Example Component (CSS Variables + TypeScript):
\`\`\`tsx
import React from 'react';
import './Button.css';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick?: () => void;
}

function Button({ children, variant = 'primary', disabled = false, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={\`button button--\${variant}\`}
    >
      {children}
    </button>
  );
}

export default Button;
\`\`\`

### CSS File (Button.css):
\`\`\`css
.button {
  padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 1rem);
  border-radius: 0.375rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s;
}

.button--primary {
  background-color: var(--color-primary, #6C63FF);
  color: white;
}

.button--primary:hover {
  filter: brightness(0.9);
}

.button--secondary {
  background-color: var(--color-secondary, #e5e7eb);
  color: var(--color-text, #333);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
\`\`\`
` : `
### Example Component (CSS Variables + JavaScript):
\`\`\`jsx
import React from 'react';
import PropTypes from 'prop-types';
import './Button.css';

function Button({ children, variant = 'primary', disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={\`button button--\${variant}\`}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary']),
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
};

export default Button;
\`\`\`

### CSS File (Button.css):
\`\`\`css
.button {
  padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 1rem);
  border-radius: 0.375rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s;
}

.button--primary {
  background-color: var(--color-primary, #6C63FF);
  color: white;
}

.button--primary:hover {
  filter: brightness(0.9);
}

.button--secondary {
  background-color: var(--color-secondary, #e5e7eb);
  color: var(--color-text, #333);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
\`\`\`
`;

    case 'css-modules':
      return isTS ? `
### Example Component (CSS Modules + TypeScript):
\`\`\`tsx
import React from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick?: () => void;
}

function Button({ children, variant = 'primary', disabled = false, onClick }: ButtonProps) {
  const variantClass = variant === 'primary' ? styles.primary : styles.secondary;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={\`\${styles.button} \${variantClass}\`}
    >
      {children}
    </button>
  );
}

export default Button;
\`\`\`

### CSS Module File (Button.module.css):
\`\`\`css
.button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.primary {
  background-color: #6C63FF;
  color: white;
}

.primary:hover {
  background-color: #5a52e0;
}

.secondary {
  background-color: #e5e7eb;
  color: #333;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
\`\`\`
` : `
### Example Component (CSS Modules + JavaScript):
\`\`\`jsx
import React from 'react';
import PropTypes from 'prop-types';
import styles from './Button.module.css';

function Button({ children, variant = 'primary', disabled = false, onClick }) {
  const variantClass = variant === 'primary' ? styles.primary : styles.secondary;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={\`\${styles.button} \${variantClass}\`}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary']),
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
};

export default Button;
\`\`\`

### CSS Module File (Button.module.css):
\`\`\`css
.button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.primary {
  background-color: #6C63FF;
  color: white;
}

.primary:hover {
  background-color: #5a52e0;
}

.secondary {
  background-color: #e5e7eb;
  color: #333;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
\`\`\`
`;

    case 'styled-components':
      return isTS ? `
### Example Component (Styled Components + TypeScript):
\`\`\`tsx
import React from 'react';
import styled from 'styled-components';

interface StyledButtonProps {
  $variant?: 'primary' | 'secondary';
}

const StyledButton = styled.button<StyledButtonProps>\`
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;

  background-color: \${props => props.$variant === 'secondary' ? '#e5e7eb' : 'var(--color-primary, #6C63FF)'};
  color: \${props => props.$variant === 'secondary' ? '#333' : 'white'};

  &:hover {
    filter: brightness(0.9);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
\`;

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick?: () => void;
}

function Button({ children, variant = 'primary', disabled = false, onClick }: ButtonProps) {
  return (
    <StyledButton
      type="button"
      onClick={onClick}
      disabled={disabled}
      $variant={variant}
    >
      {children}
    </StyledButton>
  );
}

export default Button;
\`\`\`
` : `
### Example Component (Styled Components + JavaScript):
\`\`\`jsx
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

const StyledButton = styled.button\`
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;

  background-color: \${props => props.$variant === 'secondary' ? '#e5e7eb' : 'var(--color-primary, #6C63FF)'};
  color: \${props => props.$variant === 'secondary' ? '#333' : 'white'};

  &:hover {
    filter: brightness(0.9);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
\`;

function Button({ children, variant = 'primary', disabled = false, onClick }) {
  return (
    <StyledButton
      type="button"
      onClick={onClick}
      disabled={disabled}
      $variant={variant}
    >
      {children}
    </StyledButton>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary']),
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
};

export default Button;
\`\`\`
`;

    default:
      return '';
  }
}

/**
 * Extract CSS variables from design specs and generate CSS content
 */
function generateCSSVariablesFile(designSpecs: ComponentDesignSpec[]): string | null {
  const variables: Record<string, string> = {};

  for (const spec of designSpecs) {
    for (const [key, value] of Object.entries(spec.tokens)) {
      if (typeof value === 'string') {
        // Match patterns like "--color-primary: #6C63FF" or "var(--color-primary)"
        const varMatch = value.match(/--([a-zA-Z0-9-]+):\s*(.+)/);
        if (varMatch) {
          variables[`--${varMatch[1]}`] = varMatch[2].trim();
        }
        // Also handle just the value with the key as variable name (for hex colors, sizes)
        else if (!value.startsWith('var(') && !value.includes(' ') &&
                 (value.startsWith('#') || value.match(/^\d+(\.\d+)?(px|rem|em|%)$/) || value.match(/^rgb/))) {
          const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          variables[`--${cssVarName}`] = value;
        }
      }
    }
  }

  if (Object.keys(variables).length === 0) return null;

  const cssContent = `:root {\n${Object.entries(variables).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;
  return cssContent;
}

/**
 * Build the dynamic system prompt based on styling approach
 */
function buildSystemPrompt(stylingApproach: StylingApproach, language: 'javascript' | 'typescript'): string {
  const stylingGuidance = getStylingGuidance(stylingApproach);
  const stylingExample = getStylingExample(stylingApproach, language);

  return `You are VAF-FRONTEND, the Frontend Engineer agent in a multi-agent software factory.

## YOUR ROLE
Generate production-ready React component code based on architecture specifications and design tokens.

## YOUR RESPONSIBILITIES
1. Generate complete, working React component code
2. Follow the provided design specifications exactly
3. Use correct file extensions based on project context
4. Include proper imports and exports
5. Implement all props defined in architecture
6. Apply styling according to the project's styling approach (see STYLING APPROACH section below)
7. Include accessibility attributes
8. For non-Tailwind projects: Create CSS files when design tokens contain CSS variables

${stylingGuidance}

${stylingExample}

## OUTPUT FORMAT
You must respond with valid JSON (no markdown, no explanation):

### For CREATION mode (type: "create"):
{
  "status": "success" | "partial" | "failed",
  "fileOperations": [
    {
      "type": "create",
      "path": "src/components/ComponentName.jsx",
      "content": "// Full component code here",
      "description": "Created ComponentName component"
    }
  ],
  "implementedComponents": ["ComponentName1", "ComponentName2"],
  "errors": ["optional error messages"],
  "nextAgent": "vaf-unit-test"
}

### For MODIFICATION mode (type: "edit"):
{
  "status": "success" | "partial" | "failed",
  "fileOperations": [
    {
      "type": "edit",
      "path": "src/App.jsx",
      "content": "",
      "description": "Modified App to render LoginForm",
      "edits": [
        {
          "oldContent": "import SomeComponent from './SomeComponent';",
          "newContent": "import LoginForm from './components/LoginForm';"
        },
        {
          "oldContent": "return <SomeComponent />;",
          "newContent": "return <LoginForm />;"
        }
      ]
    }
  ],
  "implementedComponents": ["App"],
  "errors": ["optional error messages"],
  "nextAgent": "vaf-unit-test"
}

**CRITICAL for EDIT operations:**
- edits array contains find/replace pairs
- oldContent must EXACTLY match text in the existing file
- Keep edits minimal and targeted
- Don't replace entire file - just the specific lines that need to change

## CODE GENERATION RULES

### File Structure (CRITICAL - PATH RULES)
- Use the exact file extension provided in context (.jsx or .tsx)
- **USE THE EXACT PATHS FROM ARCHITECTURE** - if architect says src/pages/LoginPage.jsx, use that path NOT src/components/LoginPage.jsx
- One component per file
- **For CSS Variables/Plain CSS**: Also create CSS files (e.g., Button.css alongside Button.jsx)

### Import Path Rules (VERY IMPORTANT)
- ALWAYS check the architecture.components array for the actual file path of each component
- If a component's path is "src/pages/X.jsx", import it from "./pages/X" (NOT "./components/X")
- If a component's path is "src/components/Y.jsx", import it from "./components/Y"
- NEVER guess import paths - ALWAYS derive them from the architecture.components array
- The import path should be relative to the importing file's location

### CSS Variables File Import (CRITICAL)
- If you create a CSS variables file (e.g., src/styles/variables.css), you MUST also:
  1. Add an import for it in main.jsx/main.tsx: import './styles/variables.css';
  2. Or add an import in the root App component at the top
- CSS variables MUST be imported globally for them to work

### React Patterns
- Use functional components with hooks
- Use destructured props
- Export as default
- Include PropTypes for JavaScript or interface for TypeScript

### Accessibility
- Include aria-label where needed
- Add role attributes from design specs
- Ensure keyboard navigation works

## IMPORTANT
1. Generate COMPLETE code - no placeholders or "// TODO" comments
2. Use EXACT file paths from architecture
3. Use CORRECT file extension from project context
4. Include ALL imports needed
5. Make code production-ready and working
6. **Create CSS files when using CSS variables** - include them in fileOperations

Now generate the component code for the provided architecture.`;
}

// =============================================================================
// FRONTEND AGENT SYSTEM PROMPT (LEGACY - kept for reference)
// =============================================================================

const FRONTEND_SYSTEM_PROMPT = `You are VAF-FRONTEND, the Frontend Engineer agent in a multi-agent software factory.

## YOUR ROLE
Generate production-ready React component code based on architecture specifications and design tokens.

## YOUR RESPONSIBILITIES
1. Generate complete, working React component code
2. Follow the provided design specifications exactly
3. Use correct file extensions based on project context
4. Include proper imports and exports
5. Implement all props defined in architecture
6. Apply styling according to the project's styling approach
7. Include accessibility attributes

## OUTPUT FORMAT
You must respond with valid JSON (no markdown, no explanation):

### For CREATION mode (type: "create"):
{
  "status": "success" | "partial" | "failed",
  "fileOperations": [
    {
      "type": "create",
      "path": "src/components/ComponentName.jsx",
      "content": "// Full component code here",
      "description": "Created ComponentName component"
    }
  ],
  "implementedComponents": ["ComponentName1", "ComponentName2"],
  "errors": ["optional error messages"],
  "nextAgent": "vaf-unit-test"
}

### For MODIFICATION mode (type: "edit"):
{
  "status": "success" | "partial" | "failed",
  "fileOperations": [
    {
      "type": "edit",
      "path": "src/App.jsx",
      "content": "",
      "description": "Modified App to render LoginForm",
      "edits": [
        {
          "oldContent": "import SomeComponent from './SomeComponent';",
          "newContent": "import LoginForm from './components/LoginForm';"
        },
        {
          "oldContent": "return <SomeComponent />;",
          "newContent": "return <LoginForm />;"
        }
      ]
    }
  ],
  "implementedComponents": ["App"],
  "errors": ["optional error messages"],
  "nextAgent": "vaf-unit-test"
}

**CRITICAL for EDIT operations:**
- edits array contains find/replace pairs
- oldContent must EXACTLY match text in the existing file
- Keep edits minimal and targeted
- Don't replace entire file - just the specific lines that need to change

## CODE GENERATION RULES

### File Structure (CRITICAL - PATH RULES)
- Use the exact file extension provided in context (.jsx or .tsx)
- **USE THE EXACT PATHS FROM ARCHITECTURE** - if architect specifies src/pages/MyPage.jsx, use that exact path
- One component per file
- NEVER assume a component goes in /components/ if the architecture says it goes in /pages/

### Import Path Rules (VERY IMPORTANT)
- ALWAYS derive import paths from the architecture.components array
- Each component has a "path" field - use that to calculate the relative import
- Example: If Component A at "src/App.jsx" imports Component B at "src/pages/Dashboard.jsx", the import is "./pages/Dashboard"
- Example: If Component A at "src/App.jsx" imports Component B at "src/components/Button.jsx", the import is "./components/Button"
- NEVER hardcode or guess paths - always derive from architecture

### CSS Variables File Import (CRITICAL)
- If creating CSS variables file (src/styles/variables.css), MUST import it in main entry file
- Add: import './styles/variables.css'; to main.jsx/main.tsx
- CSS variables only work if imported globally

### React Patterns
- Use functional components with hooks
- Use destructured props
- Export as default
- Include PropTypes for JavaScript or interface for TypeScript

### Styling
- Use Tailwind CSS classes from design tokens
- Apply hover, focus, and disabled states
- Ensure responsive design

### Accessibility
- Include aria-label where needed
- Add role attributes from design specs
- Ensure keyboard navigation works

### JavaScript (.jsx) Example:
\`\`\`jsx
import React from 'react';
import PropTypes from 'prop-types';

function Button({ children, variant = 'primary', disabled = false, loading = false, onClick }) {
  const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400 disabled:bg-gray-100',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={\`\${baseClasses} \${variantClasses[variant]}\`}
      aria-busy={loading}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
};

export default Button;
\`\`\`

### TypeScript (.tsx) Example:
\`\`\`tsx
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

function Button({ children, variant = 'primary', disabled = false, loading = false, onClick }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400 disabled:bg-gray-100',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={\`\${baseClasses} \${variantClasses[variant]}\`}
      aria-busy={loading}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}

export default Button;
\`\`\`

## IMPORTANT
1. Generate COMPLETE code - no placeholders or "// TODO" comments
2. Use EXACT file paths from architecture
3. Use CORRECT file extension from project context
4. Include ALL imports needed
5. Make code production-ready and working

Now generate the component code for the provided architecture.`;

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json() as FrontendRequest;
    const { workItemId, architecture, designSpecs, workItemContext, fixErrors, taskMode, targetFiles, existingFileContents } = body;

    if (!workItemId || !architecture) {
      return NextResponse.json(
        { error: 'workItemId and architecture are required' },
        { status: 400 }
      );
    }

    const isFixRequest = !!fixErrors;
    const effectiveTaskMode = taskMode || 'creation';

    // Default context if not provided - defaults to plain CSS (not Tailwind)
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
      styling: 'CSS',  // Default to plain CSS, not Tailwind
      routingPattern: 'react-router' as const,
      existingComponents: [],
    };

    // Detect styling approach from context and design specs
    const stylingApproach = detectStylingApproach(ctx.styling);
    const hasCSSVars = hasCSSVariableTokens(designSpecs || []);

    console.log('[VAF-FRONTEND] Processing request:', {
      workItemId,
      componentCount: architecture.components.length,
      implementationOrder: architecture.implementationOrder,
      language: ctx.language,
      taskMode: effectiveTaskMode,
      targetFiles: targetFiles?.length || 0,
      hasExistingContent: !!existingFileContents?.length,
      extension: ctx.componentExtension,
    });

    // Build context info with EXPLICIT instructions
    const contextInfo = `
## PROJECT CONTEXT (CRITICAL - MUST FOLLOW)
- Language: ${ctx.language.toUpperCase()}
- File Extension: ${ctx.componentExtension} (ALL component files MUST use this extension)
- Framework: ${ctx.framework} (${ctx.frameworkType})
- Styling: ${ctx.styling}

### CRITICAL FILE EXTENSION RULES
- React components: Use ${ctx.componentExtension} extension
- Hooks: Use ${ctx.language === 'typescript' ? '.ts' : '.js'} extension
- Utilities: Use ${ctx.language === 'typescript' ? '.ts' : '.js'} extension

${ctx.language === 'javascript' ? `
### JAVASCRIPT PROJECT - DO NOT USE TYPESCRIPT
- Do NOT use TypeScript syntax (no : type annotations)
- Do NOT use interfaces or type imports
- USE PropTypes for prop validation
- File extension is .jsx NOT .tsx
` : `
### TYPESCRIPT PROJECT
- USE TypeScript syntax with proper type annotations
- USE interfaces for props
- File extension is .tsx
`}
`;

    // Build architecture details
    const architectureInfo = `
## ARCHITECTURE TO IMPLEMENT

### Summary
${architecture.summary}

### Components (implement in this order)
${architecture.implementationOrder.map((name, i) => {
  const comp = architecture.components.find(c => c.name === name);
  if (!comp) return `${i + 1}. ${name} - (not found)`;
  return `
${i + 1}. **${comp.name}** (${comp.type})
   - Path: ${comp.path}
   - Description: ${comp.description}
   ${comp.props ? `- Props: ${comp.props.map(p => `${p.name}: ${p.type}${p.required ? ' (required)' : ''}`).join(', ')}` : ''}
   ${comp.children ? `- Uses: ${comp.children.join(', ')}` : ''}
`;
}).join('\n')}

### State Management
Approach: ${architecture.stateManagement.approach}

### Data Flow
${architecture.dataFlow}
`;

    // Build design specs with styling-aware labels
    const tokenLabel = stylingApproach === 'tailwind' ? 'Tailwind Classes' : 'Design Tokens';
    const designInfo = designSpecs && designSpecs.length > 0 ? `
## DESIGN SPECIFICATIONS

**Styling Approach: ${stylingApproach.toUpperCase()}**
${hasCSSVars ? '\n**Note: Design tokens contain CSS variables. You MUST create a CSS file with these variables.**\n' : ''}

${designSpecs.map(spec => `
### ${spec.component}
- Variants: ${spec.variants.join(', ')}
- States: ${spec.states.join(', ')}
- ${tokenLabel}:
${Object.entries(spec.tokens).map(([key, value]) => `  - ${key}: ${value}`).join('\n')}
- Accessibility:
  - Role: ${spec.accessibility.role || 'default'}
  - Focusable: ${spec.accessibility.focusable}
  ${spec.accessibility.keyboardNav ? `- Keyboard: ${spec.accessibility.keyboardNav.join(', ')}` : ''}
`).join('\n')}
` : '';

    // Build fix error context if this is a fix request
    const fixErrorInfo = isFixRequest && fixErrors ? `
## BUILD ERROR - FIX REQUIRED

The previous code generation resulted in build errors. You must fix these errors.

### Build Errors:
\`\`\`
${fixErrors.errors}
\`\`\`

### Previous Files (that have errors):
${fixErrors.previousFiles.map(f => `
**${f.path}**:
\`\`\`
${f.content.substring(0, 1000)}${f.content.length > 1000 ? '\n... (truncated)' : ''}
\`\`\`
`).join('\n')}

### Instructions:
1. Analyze the build errors carefully
2. Identify which files have issues
3. Fix the syntax errors, missing imports, or type errors
4. Return ONLY the fixed files (not all files)
5. Ensure the code compiles without errors
` : '';

    // Build modification mode context
    const modificationContext = effectiveTaskMode === 'modification' && existingFileContents?.length ? `
## MODIFICATION MODE (CRITICAL)
This is a MODIFICATION request - you must EDIT existing files, NOT create new ones.

### Existing File Contents (use these for edit operations):
${existingFileContents.map(f => `
**${f.path}:**
\`\`\`
${f.content}
\`\`\`
`).join('\n')}

### Instructions for MODIFICATION:
1. Use type: "edit" (NOT "create") for existing files
2. Include edits array with { oldContent, newContent } pairs
3. oldContent must EXACTLY match text from the existing file above
4. Make minimal, targeted changes - don't replace entire files
5. Only modify what's necessary to achieve the requirement
` : '';

    // Build styling-specific instructions
    const stylingInstruction = stylingApproach === 'tailwind'
      ? 'Apply the Tailwind classes from the design specifications above to each component.'
      : hasCSSVars
        ? 'Create CSS files with the CSS variables from design specs. Use inline styles or CSS classes to apply them. NEVER use CSS variables as className strings.'
        : 'Apply the design tokens using the appropriate styling approach for this project.';

    const userMessage = isFixRequest ? `${contextInfo}
${designInfo}
${fixErrorInfo}

Fix the build errors and return the corrected file operations.
IMPORTANT: ${stylingInstruction}
Use ${ctx.componentExtension} extension for all React components.
Return JSON only.` : effectiveTaskMode === 'modification' ? `${contextInfo}
${designInfo}
${modificationContext}
${architectureInfo}

Generate EDIT operations for the existing files. Use type: "edit" with edits array.
IMPORTANT: ${stylingInstruction}
Do NOT create new files - only edit existing ones.
Return JSON only.` : `${contextInfo}
${architectureInfo}
${designInfo}

Generate the component code. Create file operations for ALL components in the implementation order.
IMPORTANT: ${stylingInstruction}
Use ${ctx.componentExtension} extension for all React components.
Return JSON only.`;

    // Build dynamic system prompt based on styling approach
    const dynamicSystemPrompt = buildSystemPrompt(stylingApproach, ctx.language);

    console.log('[VAF-FRONTEND] Using styling approach:', {
      detected: stylingApproach,
      fromContext: ctx.styling,
      hasCSSVariables: hasCSSVars,
    });

    // Call Gemini AI with higher token limit for code generation
    const response = await ai.generate({
      model: MODELS.FLASH,
      system: dynamicSystemPrompt,
      prompt: userMessage,
      config: {
        temperature: 0.2, // Lower temperature for more consistent code
        maxOutputTokens: 8192, // Higher limit for multiple components
      },
    });

    const responseText = response.text || '{}';

    // Parse the JSON response
    let frontendResponse: Omit<FrontendResponse, 'workItemId'>;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      frontendResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[VAF-FRONTEND] Failed to parse response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse Frontend response', raw: responseText },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!frontendResponse.fileOperations || !Array.isArray(frontendResponse.fileOperations)) {
      return NextResponse.json(
        { error: 'Invalid frontend response structure - missing fileOperations', raw: responseText },
        { status: 500 }
      );
    }

    // Post-process: Ensure correct file extensions
    frontendResponse.fileOperations = frontendResponse.fileOperations.map(op => {
      let path = op.path;

      // Fix extension if wrong
      if (ctx.language === 'javascript') {
        path = path.replace(/\.tsx$/, '.jsx').replace(/\.ts$/, '.js');
      } else {
        path = path.replace(/\.jsx$/, '.tsx').replace(/\.js$/, '.ts');
      }

      return { ...op, path };
    });

    console.log('[VAF-FRONTEND] Generated file operations:', {
      workItemId,
      operationCount: frontendResponse.fileOperations.length,
      files: frontendResponse.fileOperations.map(op => op.path),
      status: frontendResponse.status,
    });

    // Return the complete response
    return NextResponse.json({
      workItemId,
      ...frontendResponse,
      nextAgent: frontendResponse.nextAgent || 'vaf-validator',
    });

  } catch (error) {
    console.error('[VAF-FRONTEND] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service not configured. Please add GEMINI_API_KEY to environment.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Frontend agent failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    agent: 'VAF-FRONTEND',
    role: 'Frontend Engineer',
    endpoint: '/api/agents/frontend',
    methods: ['POST'],
    description: 'Generates React component code based on architecture and design specs',
    hierarchy: {
      level: 2,
      reportsTo: ['vaf-architect'],
      delegatesTo: [],
    },
    inputContract: {
      workItemId: 'string (required)',
      architecture: 'Architecture object (required)',
      designSpecs: 'ComponentDesignSpec[] (optional)',
      workItemContext: 'WorkItemContext (optional)',
    },
    outputContract: {
      workItemId: 'string',
      status: 'success | partial | failed',
      fileOperations: 'FileOperation[]',
      implementedComponents: 'string[]',
      nextAgent: 'vaf-unit-test | vaf-validator',
    },
  });
}
