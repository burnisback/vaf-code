/**
 * Engineer Agent (Combined Frontend + Backend)
 *
 * Implements features based on design specifications.
 * Produces file operations (write, edit, delete) that the orchestrator
 * will apply to the codebase.
 */

import { ai, MODELS } from '../../genkit';
import { z } from 'zod';
import {
  AgentType,
  OrchestratorRequest,
  AgentResponse,
  FileOperation,
  FileOperationSchema,
  SelfCheck,
  ResponseStatus,
} from '../../types/index';

// ============================================================================
// Engineer Agent Configuration
// ============================================================================

export const ENGINEER_AGENT_CONFIG = {
  id: 'engineer' as AgentType,
  name: 'VAF Engineer Agent',
  description: 'Combined Frontend + Backend Engineer - implements features with file operations',
  model: MODELS.FLASH,
  temperature: 0.3, // Lower temperature for more deterministic code
  maxOutputTokens: 8192,
};

// ============================================================================
// System Prompt
// ============================================================================

const ENGINEER_SYSTEM_PROMPT = `You are a senior Full-Stack Engineer implementing features for an EXISTING web application. Your role is to produce precise file operations that MODIFY the existing codebase - NOT create a new project from scratch.

## CRITICAL: THIS IS AN EXISTING PROJECT

You are working on an EXISTING codebase with:
- Existing components and pages
- Existing project structure
- Existing patterns and conventions

**NEVER create basic setup files** like index.html, main.tsx, App.tsx from scratch. These files ALREADY EXIST in the project.

**ALWAYS prefer EDIT operations** over WRITE operations for existing files.

## Your Responsibilities

1. **Work With Existing Code**: EDIT existing files, don't recreate them
2. **Follow Design Spec**: Implement the design specification precisely
3. **Use Surgical Edits**: Small, targeted changes to existing files
4. **Match Project Patterns**: Look at existing code and follow the same style
5. **Use Tailwind Classes**: Use standard Tailwind classes (bg-blue-600, not custom tokens)

## CRITICAL RULES

1. **STUDY THE FILE TREE** - Understand what files already exist before coding
2. **EDIT, DON'T RECREATE** - If a file exists, use "edit" type, not "write"
3. **USE STANDARD TAILWIND** - bg-blue-600, text-white, px-4, py-2 (NOT bg-primary, font-fontSize-base)
4. **ADD TO EXISTING FILES** - Import and use new components in existing entry points
5. **MINIMAL CHANGES** - Only modify what's necessary for the feature

## Context You Receive

- Design specification (from design agent) - Follow this!
- **Relevant existing files** - CRITICAL: Study these before implementing
- **Project file tree** - Shows what files already exist
- User's request

## Output Format

Return a JSON object. PREFER "edit" operations for existing files:
{
  "operations": [
    {
      "type": "edit",
      "path": "src/App.tsx",
      "edits": [
        { "oldContent": "return (\\n    <div>", "newContent": "return (\\n    <div>\\n      <Button>Click Me</Button>" }
      ],
      "description": "Add button to existing App component"
    },
    {
      "type": "write",
      "path": "src/components/Button.tsx",
      "content": "import React from 'react';\\n\\nexport function Button({ children }) { return <button className=\\"bg-blue-600 text-white px-4 py-2 rounded\\">{children}</button>; }",
      "description": "New component (only if it doesn't exist)"
    }
  ]
}

## File Operation Guidelines

### Edit (PREFERRED for existing files)
- Use when the file already exists in the project
- oldContent: Exact text to find (include enough context to be unique)
- newContent: The replacement text
- Keep edits minimal and focused

### Write (ONLY for truly new files)
- Only use when creating a genuinely new file
- NEVER use to recreate files that already exist (App.tsx, index.html, etc.)
- Include proper imports at top
- Follow existing project patterns

### Delete
- Rarely needed
- Only delete files being replaced

## Tailwind Classes Reference

Use these standard Tailwind classes (NOT custom tokens):
- Colors: bg-blue-600, bg-blue-500, text-white, text-gray-900
- Spacing: px-4, py-2, mt-4, mb-2, p-4
- Typography: text-lg, font-semibold, font-medium
- Borders: rounded, rounded-md, rounded-lg
- States: hover:bg-blue-700, focus:ring-2, focus:ring-blue-500

## Self-Check Requirements

Before outputting, verify:
1. Did I check what files already exist?
2. Am I using "edit" for existing files (not "write")?
3. Am I using standard Tailwind classes?
4. Is my change minimal and focused?
5. Does it follow the design spec?`;

// ============================================================================
// Output Schema
// ============================================================================

const EngineerOutputSchema = z.object({
  operations: z.array(FileOperationSchema),
});

type EngineerOutput = z.infer<typeof EngineerOutputSchema>;

// ============================================================================
// Engineer Agent Class
// ============================================================================

export class EngineerAgent {
  private config = ENGINEER_AGENT_CONFIG;

  /**
   * Process an implementation request from the orchestrator
   */
  async process(request: OrchestratorRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Build the prompt with context
      const prompt = this.buildPrompt(request);

      // Generate implementation
      const response = await ai.generate({
        model: this.config.model,
        system: ENGINEER_SYSTEM_PROMPT,
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

      // Get list of modified files for metadata
      const filesModified = output.operations.map(op => op.path);

      return {
        requestId: request.requestId,
        agentId: this.config.id,
        status: selfCheck.passed ? 'success' : 'partial',
        output: {
          type: 'file_operations' as const,
          operations: output.operations,
        },
        selfCheck,
        metadata: {
          executionTime: Date.now() - startTime,
          filesModified,
        },
        suggestedNextSteps: [
          'Apply file operations to codebase',
          'Run type check and lint',
          'Verify existing tests pass',
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
          code: 'IMPLEMENTATION_FAILED',
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

    // Add design spec if available (from design agent)
    if (request.context.designSpec) {
      parts.push(`\n## Design Specification\n\`\`\`json\n${JSON.stringify(request.context.designSpec, null, 2)}\n\`\`\``);
    }

    // Add existing files for reference
    if (request.context.files && request.context.files.length > 0) {
      parts.push(`\n## Relevant Files`);
      for (const file of request.context.files) {
        parts.push(`\n### ${file.path}\n\`\`\`${this.getFileExtension(file.path)}\n${file.content}\n\`\`\``);
      }
    }

    // Add file tree for context
    if (request.context.fileTree) {
      parts.push(`\n## Project Structure\n\`\`\`\n${request.context.fileTree}\n\`\`\``);
    }

    // Add constraints
    if (request.task.constraints && request.task.constraints.length > 0) {
      parts.push(`\n## Constraints\n${request.task.constraints.map(c => `- ${c}`).join('\n')}`);
    }

    parts.push(`\n## Your Task\nProvide file operations to implement this request. Return a JSON object with operations array.`);

    return parts.join('\n');
  }

  /**
   * Get file extension for syntax highlighting
   */
  private getFileExtension(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const extMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'tsx',
      js: 'javascript',
      jsx: 'jsx',
      json: 'json',
      css: 'css',
      html: 'html',
      md: 'markdown',
    };
    return extMap[ext] ?? ext;
  }

  /**
   * Parse output from AI response
   */
  private parseOutput(responseText: string): EngineerOutput {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in engineer response');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate against schema
      const validated = EngineerOutputSchema.parse(parsed);
      return validated;
    } catch (error) {
      throw new Error(`Failed to parse engineer output: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  /**
   * Generate self-check for the implementation
   */
  private generateSelfCheck(output: EngineerOutput, request: OrchestratorRequest): SelfCheck {
    const criteriaResults: SelfCheck['criteriaResults'] = [];

    // Check 1: Has operations
    const hasOperations = output.operations.length > 0;
    criteriaResults.push({
      criterion: 'File operations provided',
      met: hasOperations,
      evidence: hasOperations ? `${output.operations.length} operations` : 'No operations',
    });

    // Check 2: All operations have valid paths
    const allValidPaths = output.operations.every(op => op.path && op.path.length > 0);
    criteriaResults.push({
      criterion: 'All operations have valid paths',
      met: allValidPaths,
      evidence: allValidPaths ? 'All paths valid' : 'Some paths missing',
    });

    // Check 3: Write operations have content
    const writeOps = output.operations.filter((op): op is FileOperation & { type: 'write' } => op.type === 'write');
    const allWritesHaveContent = writeOps.every(op => op.content && op.content.length > 0);
    criteriaResults.push({
      criterion: 'Write operations have content',
      met: writeOps.length === 0 || allWritesHaveContent,
      evidence: writeOps.length === 0 ? 'No write operations' : (allWritesHaveContent ? 'All have content' : 'Some missing content'),
    });

    // Check 4: Edit operations have edits array
    const editOps = output.operations.filter((op): op is FileOperation & { type: 'edit' } => op.type === 'edit');
    const allEditsValid = editOps.every(op => op.edits && op.edits.length > 0);
    criteriaResults.push({
      criterion: 'Edit operations have edits array',
      met: editOps.length === 0 || allEditsValid,
      evidence: editOps.length === 0 ? 'No edit operations' : (allEditsValid ? 'All valid' : 'Some missing edits'),
    });

    // Check 5: Design spec followed (if provided)
    const hasDesignSpec = !!request.context.designSpec;
    if (hasDesignSpec) {
      criteriaResults.push({
        criterion: 'Design specification referenced',
        met: true,
        evidence: 'Implementation generated from design spec',
      });
    }

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

export const engineerAgent = new EngineerAgent();
