import { z } from 'genkit';
import { ai, MODELS, ModelType } from '../genkit';

/**
 * Agent Base Infrastructure
 *
 * Defines the base interface and utilities for creating AI agents
 * in the Agentic Factory system.
 */

// Agent role types
export type AgentRole =
  | 'orchestrator'
  | 'pm'
  | 'architect'
  | 'ux'
  | 'frontend'
  | 'backend'
  | 'ui'
  | 'qa'
  | 'security'
  | 'devops'
  | 'researcher'
  | 'test-runner'
  | 'e2e'
  | 'integrations'
  | 'ai'
  | 'docs';

// Agent authority levels
export type AuthorityLevel = 'executive' | 'lead' | 'ic' | 'support';

// Decision types imported from governance (avoid duplicate exports)
// Use: import { DecisionType, Decision } from '../governance/types'

// Agent configuration interface
export interface AgentConfig {
  name: string;
  role: AgentRole;
  description: string;
  model: ModelType;
  authorityLevel: AuthorityLevel;
  canApprove: string[];  // Domains this agent can approve
  canReview: string[];   // Domains this agent can review
  systemPrompt: string;
  tools?: string[];      // Tool names this agent can use
}

// Agent input schema base
export const agentInputSchema = z.object({
  workItemId: z.string().optional().describe('The work item ID this task belongs to'),
  stage: z.string().optional().describe('Current pipeline stage'),
  task: z.string().describe('The task or question for the agent'),
  context: z.object({
    artifacts: z.record(z.string()).optional().describe('Existing artifacts by name'),
    files: z.array(z.string()).optional().describe('Relevant file paths'),
    previousDecisions: z.array(z.unknown()).optional().describe('Previous decisions in this stage'),
  }).optional(),
});

export type AgentInput = z.infer<typeof agentInputSchema>;

// Agent output schema base
export const agentOutputSchema = z.object({
  response: z.string().describe('The agent response text'),
  artifacts: z.record(z.string()).optional().describe('Generated artifacts by name'),
  fileOperations: z.array(z.object({
    type: z.enum(['create', 'update', 'delete']),
    path: z.string(),
    content: z.string().optional(),
  })).optional().describe('File operations to perform'),
  decision: z.object({
    type: z.enum(['REVIEW', 'APPROVAL', 'SIGNOFF', 'ESCALATION']),
    decision: z.enum(['APPROVED', 'CHANGES_REQUIRED', 'REJECTED', 'APPROVED_WITH_RISKS']),
    domain: z.string(),
    notes: z.string(),
    requiredChanges: z.array(z.string()).optional(),
    risks: z.array(z.string()).optional(),
  }).optional().describe('Decision object for governance'),
});

export type AgentOutput = z.infer<typeof agentOutputSchema>;

/**
 * Create an agent flow using Genkit
 */
export function createAgentFlow(config: AgentConfig) {
  const flowName = `vaf-${config.role}`;

  return ai.defineFlow(
    {
      name: flowName,
      inputSchema: agentInputSchema,
      outputSchema: agentOutputSchema,
    },
    async (input: AgentInput): Promise<AgentOutput> => {
      // Build the full prompt with system context
      const fullPrompt = buildAgentPrompt(config, input);

      try {
        const response = await ai.generate({
          model: config.model,
          prompt: fullPrompt,
          config: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        });

        // Parse the response
        return parseAgentResponse(response.text || '');
      } catch (error) {
        console.error(`[${flowName}] Error:`, error);
        throw error;
      }
    }
  );
}

/**
 * Build the full prompt for an agent
 */
function buildAgentPrompt(config: AgentConfig, input: AgentInput): string {
  let prompt = config.systemPrompt + '\n\n';

  // Add context if provided
  if (input.context) {
    if (input.context.artifacts && Object.keys(input.context.artifacts).length > 0) {
      prompt += '## Existing Artifacts\n\n';
      for (const [name, content] of Object.entries(input.context.artifacts)) {
        prompt += `### ${name}\n${content}\n\n`;
      }
    }

    if (input.context.files && input.context.files.length > 0) {
      prompt += `## Relevant Files\n${input.context.files.join('\n')}\n\n`;
    }
  }

  // Add work item context
  if (input.workItemId) {
    prompt += `## Work Item: ${input.workItemId}\n`;
    if (input.stage) {
      prompt += `Stage: ${input.stage}\n`;
    }
    prompt += '\n';
  }

  // Add the task
  prompt += `## Task\n${input.task}\n\n`;

  // Add output format instructions
  prompt += `## Response Format
Please structure your response as follows:

1. Your detailed response addressing the task
2. If creating artifacts, include them in clearly marked sections
3. If making a decision, include a DECISION block at the end

Example decision block:
\`\`\`decision
{
  "type": "REVIEW",
  "decision": "APPROVED",
  "domain": "requirements",
  "notes": "Requirements are complete and clear",
  "requiredChanges": [],
  "risks": []
}
\`\`\`
`;

  return prompt;
}

/**
 * Parse agent response into structured output
 */
function parseAgentResponse(responseText: string): AgentOutput {
  const output: AgentOutput = {
    response: responseText,
  };

  // Extract decision block if present
  const decisionMatch = responseText.match(/```decision\s*([\s\S]*?)```/);
  if (decisionMatch) {
    try {
      const decisionJson = JSON.parse(decisionMatch[1].trim());
      output.decision = {
        type: decisionJson.type,
        decision: decisionJson.decision,
        domain: decisionJson.domain,
        notes: decisionJson.notes || '',
        requiredChanges: decisionJson.requiredChanges,
        risks: decisionJson.risks,
      };
      // Remove decision block from response
      output.response = responseText.replace(/```decision\s*[\s\S]*?```/, '').trim();
    } catch {
      // Decision parsing failed, keep as is
    }
  }

  // Extract file operations if present
  const fileOpPattern = /```file:(create|update|delete):([^\n]+)\n([\s\S]*?)```/g;
  const fileOperations: AgentOutput['fileOperations'] = [];
  let match;

  while ((match = fileOpPattern.exec(responseText)) !== null) {
    fileOperations.push({
      type: match[1] as 'create' | 'update' | 'delete',
      path: match[2].trim(),
      content: match[1] !== 'delete' ? match[3].trim() : undefined,
    });
  }

  if (fileOperations.length > 0) {
    output.fileOperations = fileOperations;
  }

  // Extract artifacts
  const artifactPattern = /```artifact:([^\n]+)\n([\s\S]*?)```/g;
  const artifacts: Record<string, string> = {};

  while ((match = artifactPattern.exec(responseText)) !== null) {
    artifacts[match[1].trim()] = match[2].trim();
  }

  if (Object.keys(artifacts).length > 0) {
    output.artifacts = artifacts;
  }

  return output;
}

/**
 * Agent interface for type checking
 */
export interface Agent {
  config: AgentConfig;
  invoke: (input: AgentInput) => Promise<AgentOutput>;
}

/**
 * Create an agent instance
 */
export function createAgent(config: AgentConfig): Agent {
  const flow = createAgentFlow(config);

  return {
    config,
    invoke: async (input: AgentInput) => {
      return flow(input);
    },
  };
}
