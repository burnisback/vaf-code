/**
 * QA Agent (Combined Quality Assurance)
 *
 * Verifies implementations meet acceptance criteria.
 * Performs code review, checks for issues, and validates
 * that the work matches the original requirements.
 */

import { ai, MODELS } from '../../genkit';
import { z } from 'zod';
import {
  AgentType,
  OrchestratorRequest,
  AgentResponse,
  SelfCheck,
  ResponseStatus,
} from '../../types/index';

// ============================================================================
// QA Agent Configuration
// ============================================================================

export const QA_AGENT_CONFIG = {
  id: 'qa' as AgentType,
  name: 'VAF QA Agent',
  description: 'Quality Assurance - verifies implementations meet acceptance criteria',
  model: MODELS.FLASH,
  temperature: 0.2, // Low temperature for consistent verification
  maxOutputTokens: 4096,
};

// ============================================================================
// System Prompt
// ============================================================================

const QA_SYSTEM_PROMPT = `You are a senior QA Engineer responsible for verifying implementations. Your role is to ensure the work meets acceptance criteria and identify any issues.

## Your Responsibilities

1. **Verify Acceptance Criteria**: Check each criterion is met
2. **Code Review**: Look for bugs, edge cases, security issues
3. **Design Compliance**: Verify implementation matches design spec
4. **Accessibility**: Check for a11y issues
5. **Best Practices**: Ensure code follows standards

## CRITICAL RULES

1. **BE THOROUGH** - Check every acceptance criterion
2. **BE SPECIFIC** - Point to exact lines/locations of issues
3. **BE CONSTRUCTIVE** - Provide actionable feedback
4. **PRIORITIZE** - Rank issues by severity (critical, major, minor)

## Context You Receive

- Original user request
- Acceptance criteria
- Implementation (file operations or code)
- Design specification (if applicable)

## Output Format

You MUST return a JSON object with this structure:
{
  "summary": "overall assessment of the implementation",
  "findings": [
    {
      "category": "acceptance_criteria | bug | security | accessibility | performance | style",
      "description": "detailed description of finding",
      "severity": "info" | "warning" | "error" | "critical"
    }
  ],
  "recommendations": ["list of improvements"]
}

## Severity Guidelines

- **Critical**: Breaks functionality, security vulnerability, data loss risk
- **Major**: Significant bug, accessibility blocker, major deviation from spec
- **Minor**: Style issue, minor bug, enhancement suggestion

## Self-Check Requirements

After verification, validate your own analysis:
1. Did I check all acceptance criteria?
2. Did I review for security issues?
3. Did I check accessibility?
4. Are my findings accurate and actionable?`;

// ============================================================================
// Output Schema (matches AnalysisOutputSchema from types)
// ============================================================================

const QAOutputSchema = z.object({
  summary: z.string(),
  findings: z.array(z.object({
    category: z.string(),
    description: z.string(),
    severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  })),
  recommendations: z.array(z.string()).optional(),
});

type QAOutput = z.infer<typeof QAOutputSchema>;

// ============================================================================
// QA Agent Class
// ============================================================================

export class QAAgent {
  private config = QA_AGENT_CONFIG;

  /**
   * Process a verification request from the orchestrator
   */
  async process(request: OrchestratorRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Build the prompt with context
      const prompt = this.buildPrompt(request);

      // Generate verification
      const response = await ai.generate({
        model: this.config.model,
        system: QA_SYSTEM_PROMPT,
        prompt,
        config: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxOutputTokens,
        },
      });

      const responseText = response.text;

      // Parse the output
      const output = this.parseOutput(responseText);

      // Generate self-check
      const selfCheck = this.generateSelfCheck(output, request);

      // Determine response status based on findings
      const hasCritical = output.findings.some(f => f.severity === 'critical');
      const hasErrors = output.findings.some(f => f.severity === 'error');
      const status: ResponseStatus = hasCritical || hasErrors ? 'partial' : 'success';

      return {
        requestId: request.requestId,
        agentId: this.config.id,
        status,
        output: {
          type: 'analysis' as const,
          summary: output.summary,
          findings: output.findings,
          recommendations: output.recommendations,
        },
        selfCheck,
        metadata: {
          executionTime: Date.now() - startTime,
        },
        suggestedNextSteps: this.generateNextSteps(output),
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
          code: 'VERIFICATION_FAILED',
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
      `## Original Request\n${request.task.instruction}`,
      `\n## Acceptance Criteria to Verify\n${request.task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
    ];

    // Add design spec if available
    if (request.context.designSpec) {
      parts.push(`\n## Design Specification\n\`\`\`json\n${JSON.stringify(request.context.designSpec, null, 2)}\n\`\`\``);
    }

    // Add implementation files to review
    if (request.context.files && request.context.files.length > 0) {
      parts.push(`\n## Implementation to Verify`);
      for (const file of request.context.files) {
        parts.push(`\n### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``);
      }
    }

    // Add any prior decisions or context
    if (request.context.priorDecisions && request.context.priorDecisions.length > 0) {
      parts.push(`\n## Prior Decisions\n${request.context.priorDecisions.map(d => `- ${d}`).join('\n')}`);
    }

    parts.push(`\n## Your Task\nVerify the implementation meets all acceptance criteria. Return a JSON object with your findings.`);

    return parts.join('\n');
  }

  /**
   * Parse output from AI response
   */
  private parseOutput(responseText: string): QAOutput {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in QA response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate against schema
      const validated = QAOutputSchema.parse(parsed);
      return validated;
    } catch (error) {
      throw new Error(`Failed to parse QA output: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  /**
   * Generate self-check for the verification
   */
  private generateSelfCheck(output: QAOutput, request: OrchestratorRequest): SelfCheck {
    const criteriaResults: SelfCheck['criteriaResults'] = [];

    // Check 1: Findings provided
    const hasFindings = output.findings.length > 0;
    criteriaResults.push({
      criterion: 'Analysis findings provided',
      met: hasFindings,
      evidence: hasFindings ? `${output.findings.length} findings` : 'No findings',
    });

    // Check 2: Summary provided
    const hasSummary = Boolean(output.summary && output.summary.length > 20);
    criteriaResults.push({
      criterion: 'Summary assessment provided',
      met: hasSummary,
      evidence: hasSummary ? 'Summary provided' : 'Missing or too short',
    });

    // Check 3: Findings have categories
    const allHaveCategories = output.findings.every(f => f.category && f.category.length > 0);
    criteriaResults.push({
      criterion: 'All findings categorized',
      met: output.findings.length === 0 || allHaveCategories,
      evidence: allHaveCategories ? 'All categorized' : 'Some missing categories',
    });

    // Check 4: Findings have descriptions
    const allHaveDescriptions = output.findings.every(f => f.description && f.description.length > 10);
    criteriaResults.push({
      criterion: 'All findings have descriptions',
      met: output.findings.length === 0 || allHaveDescriptions,
      evidence: allHaveDescriptions ? 'All described' : 'Some missing descriptions',
    });

    // Calculate overall pass
    const passedCount = criteriaResults.filter(r => r.met).length;
    const passed = passedCount >= criteriaResults.length * 0.75; // 75% threshold for QA
    const confidence = passedCount / criteriaResults.length;

    return {
      passed,
      criteriaResults,
      confidence,
      concerns: passed ? undefined : ['Verification may be incomplete'],
      suggestedImprovements: passed ? undefined : ['Review failed criteria'],
    };
  }

  /**
   * Generate next steps based on QA findings
   */
  private generateNextSteps(output: QAOutput): string[] {
    const steps: string[] = [];

    const criticalFindings = output.findings.filter(f => f.severity === 'critical');
    const errorFindings = output.findings.filter(f => f.severity === 'error');
    const warningFindings = output.findings.filter(f => f.severity === 'warning');

    if (criticalFindings.length === 0 && errorFindings.length === 0) {
      steps.push('Implementation verified - ready for deployment');
      if (warningFindings.length > 0) {
        steps.push(`Consider addressing ${warningFindings.length} warning(s) in future iteration`);
      }
    } else {
      steps.push('Implementation needs rework');

      if (criticalFindings.length > 0) {
        steps.push(`Fix ${criticalFindings.length} critical issue(s) first`);
      }

      if (errorFindings.length > 0) {
        steps.push(`Address ${errorFindings.length} error(s)`);
      }
    }

    return steps;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const qaAgent = new QAAgent();
