/**
 * Design Agent (Combined UI + UX)
 *
 * CRITICAL: This agent is invoked for ANY visual change, not just "complex" UI work.
 * Even simple requests like "add a button" need design input to ensure:
 * - Proper placement in layout
 * - Consistent use of design tokens
 * - Accessibility compliance
 * - Visual hierarchy maintenance
 */

import { ai, MODELS } from '../../genkit';
import { z } from 'zod';
import {
  AgentType,
  OrchestratorRequest,
  AgentResponse,
  DesignSpecOutput,
  DesignSpecOutputSchema,
  SelfCheck,
  ResponseStatus,
} from '../../types/index';

// ============================================================================
// Design Agent Configuration
// ============================================================================

export const DESIGN_AGENT_CONFIG = {
  id: 'design' as AgentType,
  name: 'VAF Design Agent',
  description: 'Combined UI + UX Designer - invoked for ANY visual change',
  model: MODELS.FLASH,
  temperature: 0.7, // Allow creativity in design
  maxOutputTokens: 4096,
};

// ============================================================================
// System Prompt
// ============================================================================

const DESIGN_SYSTEM_PROMPT = `You are a senior UI/UX Designer for an EXISTING web application. Your role is to provide design specifications using STANDARD TAILWIND CSS classes that engineers will implement exactly.

## CRITICAL: USE STANDARD TAILWIND CLASSES

You MUST specify REAL Tailwind CSS classes that work out of the box:
- Colors: bg-blue-600, bg-blue-500, text-white, text-gray-900, bg-gray-100
- Spacing: px-4, py-2, mt-4, mb-2, p-4, mx-auto
- Typography: text-lg, text-sm, font-semibold, font-medium
- Borders: rounded, rounded-md, rounded-lg, border, border-gray-300
- States: hover:bg-blue-700, focus:ring-2, focus:ring-blue-500, focus:outline-none

**DO NOT USE** custom tokens like bg-primary, text-background, font-fontSize-base - these don't exist!

## Your Responsibilities

1. **Component Specification**: Define component type, variant, and size
2. **Placement**: Specify exactly where the element should go in EXISTING layout
3. **Styling**: Provide REAL Tailwind classes the engineer can copy-paste
4. **Accessibility**: Include aria-label and focus states
5. **Responsive Design**: Consider different screen sizes

## Context You Receive

- Existing page structure (look at the files provided!)
- User's request
- You are modifying an EXISTING project, not creating from scratch

## Output Format

Return a JSON object with REAL Tailwind classes:
{
  "component": {
    "type": "Button|Input|Form|Card|etc",
    "variant": "primary|secondary|outline|ghost",
    "size": "sm|md|lg"
  },
  "placement": {
    "parentComponent": "Name of existing component to add this to",
    "position": "Where in that component (e.g., 'below the heading', 'in the header')",
    "spacing": "mt-4",
    "justification": "Why this location makes sense"
  },
  "styling": {
    "classes": ["bg-blue-600", "text-white", "px-4", "py-2", "rounded-md", "hover:bg-blue-700", "focus:ring-2", "focus:ring-blue-500"],
    "reasoning": "Blue primary button with hover and focus states"
  },
  "responsive": {
    "mobile": "Full width on mobile (w-full)",
    "tablet": "Auto width (w-auto)",
    "desktop": "Auto width (w-auto)"
  },
  "accessibility": {
    "ariaLabel": "Descriptive label for the action",
    "focusOrder": "Natural tab order",
    "contrastRatio": "4.5:1 minimum (blue-600 on white passes)"
  }
}

## Tailwind Classes Quick Reference

### Buttons
- Primary: bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700
- Secondary: bg-gray-200 text-gray-900 px-4 py-2 rounded-md hover:bg-gray-300
- Outline: border border-blue-600 text-blue-600 px-4 py-2 rounded-md hover:bg-blue-50

### Spacing
- Small gap: mt-2, mb-2, mx-2
- Medium gap: mt-4, mb-4, mx-4
- Large gap: mt-6, mb-6, mx-6

### Typography
- Heading: text-2xl font-bold
- Subheading: text-lg font-semibold
- Body: text-base
- Small: text-sm

## Self-Check Requirements

Verify before outputting:
1. Are ALL classes real Tailwind classes (not custom tokens)?
2. Did I consider where this goes in the EXISTING layout?
3. Are focus and hover states included?
4. Is there an appropriate aria-label?`;

// ============================================================================
// Design Agent Class
// ============================================================================

export class DesignAgent {
  private config = DESIGN_AGENT_CONFIG;

  /**
   * Process a design request from the orchestrator
   */
  async process(request: OrchestratorRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Build the prompt with context
      const prompt = this.buildPrompt(request);

      // Generate design specification
      const response = await ai.generate({
        model: this.config.model,
        system: DESIGN_SYSTEM_PROMPT,
        prompt,
        config: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxOutputTokens,
        },
      });

      const responseText = response.text;

      // Parse the design spec from response
      const designSpec = this.parseDesignSpec(responseText);

      // Generate self-check
      const selfCheck = this.generateSelfCheck(designSpec, request);

      return {
        requestId: request.requestId,
        agentId: this.config.id,
        status: selfCheck.passed ? 'success' : 'partial',
        output: {
          type: 'design_spec' as const,
          component: designSpec.component,
          placement: designSpec.placement,
          styling: designSpec.styling,
          responsive: designSpec.responsive,
          accessibility: designSpec.accessibility,
        },
        selfCheck,
        metadata: {
          executionTime: Date.now() - startTime,
        },
        suggestedNextSteps: [
          'Engineer should implement exactly as specified',
          'Verify accessibility in browser',
        ],
      };
    } catch (error) {
      return {
        requestId: request.requestId,
        agentId: this.config.id,
        status: 'error',
        selfCheck: {
          passed: false,
          criteriaResults: [],
          confidence: 0,
        },
        error: {
          code: 'DESIGN_GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
      };
    }
  }

  /**
   * Build the prompt from orchestrator request
   */
  private buildPrompt(request: OrchestratorRequest): string {
    const parts: string[] = [
      `## User Request\n${request.task.instruction}`,
      `\n## Acceptance Criteria\n${request.task.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`,
    ];

    // Add design system context if available
    if (request.context.designSystem) {
      parts.push(`\n## Design System\n\`\`\`json\n${JSON.stringify(request.context.designSystem, null, 2)}\n\`\`\``);
    }

    // Add page layout context if available
    if (request.context.files && request.context.files.length > 0) {
      const layoutFile = request.context.files[0];
      parts.push(`\n## Current Page Layout\nFile: ${layoutFile.path}\n\`\`\`tsx\n${layoutFile.content}\n\`\`\``);
    }

    // Add constraints
    if (request.task.constraints && request.task.constraints.length > 0) {
      parts.push(`\n## Constraints\n${request.task.constraints.map(c => `- ${c}`).join('\n')}`);
    }

    parts.push(`\n## Your Task\nProvide a complete design specification in JSON format.`);

    return parts.join('\n');
  }

  /**
   * Parse design spec from AI response
   */
  private parseDesignSpec(responseText: string): DesignSpecOutput {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in design response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate against schema
      const validated = DesignSpecOutputSchema.parse(parsed);
      return validated;
    } catch (error) {
      throw new Error(`Failed to parse design spec: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  /**
   * Generate self-check for the design spec
   */
  private generateSelfCheck(designSpec: DesignSpecOutput, request: OrchestratorRequest): SelfCheck {
    const criteriaResults: SelfCheck['criteriaResults'] = [];

    // Check 1: Component specified
    criteriaResults.push({
      criterion: 'Component type specified',
      met: !!designSpec.component.type,
      evidence: designSpec.component.type || 'No component type',
    });

    // Check 2: Placement justified
    criteriaResults.push({
      criterion: 'Placement justified',
      met: !!designSpec.placement.justification,
      evidence: designSpec.placement.justification || 'No justification',
    });

    // Check 3: Styling uses classes (not custom CSS)
    const hasClasses = designSpec.styling.classes.length > 0;
    criteriaResults.push({
      criterion: 'Uses design system classes',
      met: hasClasses,
      evidence: hasClasses ? `${designSpec.styling.classes.length} classes` : 'No classes defined',
    });

    // Check 4: Accessibility considered
    const hasA11y = designSpec.accessibility !== undefined;
    criteriaResults.push({
      criterion: 'Accessibility requirements included',
      met: hasA11y,
      evidence: hasA11y ? 'Accessibility spec provided' : 'No accessibility spec',
    });

    // Calculate overall pass
    const passedCount = criteriaResults.filter(r => r.met).length;
    const passed = passedCount >= criteriaResults.length * 0.8; // 80% threshold
    const confidence = passedCount / criteriaResults.length;

    return {
      passed,
      criteriaResults,
      confidence,
      concerns: passed ? undefined : ['Some criteria not fully met'],
      suggestedImprovements: passed ? undefined : ['Review failed criteria'],
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const designAgent = new DesignAgent();
