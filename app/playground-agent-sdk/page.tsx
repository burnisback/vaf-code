'use client';

import { useState } from 'react';
import { AgentChat, Message } from '@/components/AgentChat';

const AGENTIC_LOOP_CODE = `// agent.ts - Agentic Loop Implementation
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Define your tools
const tools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_command',
    description: 'Run a shell command',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to run' },
      },
      required: ['command'],
    },
  },
];

// Execute a tool
async function executeTool(name: string, input: unknown): Promise<string> {
  switch (name) {
    case 'read_file':
      return fs.readFileSync(input.path, 'utf-8');
    case 'write_file':
      fs.writeFileSync(input.path, input.content);
      return 'File written successfully';
    case 'run_command':
      return execSync(input.command).toString();
    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
}

// The Agentic Loop
async function runAgent(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage }
  ];

  while (true) {
    // 1. Call the model
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools,
      messages,
    });

    // 2. Check if we're done
    if (response.stop_reason === 'end_turn') {
      // Extract final text response
      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.text || 'Task completed';
    }

    // 3. Handle tool use
    if (response.stop_reason === 'tool_use') {
      // Add assistant's response to messages
      messages.push({ role: 'assistant', content: response.content });

      // Execute each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Add tool results and continue loop
      messages.push({ role: 'user', content: toolResults });
    }
  }
}

// Usage
const result = await runAgent('Create a hello.txt file with "Hello World"');
console.log(result);`;

const TOOL_DEFINITION_CODE = `// tools.ts - Tool Definitions with JSON Schema
import Anthropic from '@anthropic-ai/sdk';

export const tools: Anthropic.Tool[] = [
  {
    name: 'search_codebase',
    description: 'Search for code patterns in the project',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query or regex pattern',
        },
        file_pattern: {
          type: 'string',
          description: 'Glob pattern for files to search (e.g., "*.ts")',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'edit_file',
    description: 'Make targeted edits to a file',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to edit',
        },
        old_text: {
          type: 'string',
          description: 'The exact text to replace',
        },
        new_text: {
          type: 'string',
          description: 'The new text to insert',
        },
      },
      required: ['path', 'old_text', 'new_text'],
    },
  },
];`;

const MULTI_TURN_CODE = `// multi-turn.ts - Handling Multi-Step Tasks
async function handleComplexTask(task: string) {
  console.log('Starting task:', task);

  let messages: Anthropic.MessageParam[] = [
    { role: 'user', content: task }
  ];

  let turnCount = 0;
  const maxTurns = 10; // Safety limit

  while (turnCount < maxTurns) {
    turnCount++;
    console.log(\`\\n--- Turn \${turnCount} ---\`);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: \`You are a coding assistant. Break down complex
               tasks into steps and use tools to accomplish them.\`,
      tools,
      messages,
    });

    // Log what the model is thinking
    for (const block of response.content) {
      if (block.type === 'text') {
        console.log('Thinking:', block.text);
      }
      if (block.type === 'tool_use') {
        console.log(\`Using tool: \${block.name}\`);
        console.log('Input:', JSON.stringify(block.input, null, 2));
      }
    }

    // Check if done
    if (response.stop_reason === 'end_turn') {
      const final = response.content.find(b => b.type === 'text');
      console.log('\\n✓ Task completed!');
      return final?.text;
    }

    // Process tool calls
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const results = await Promise.all(
        response.content
          .filter(b => b.type === 'tool_use')
          .map(async (block) => ({
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: await executeTool(block.name, block.input),
          }))
      );

      messages.push({ role: 'user', content: results });
    }
  }

  throw new Error('Max turns exceeded');
}`;

interface ConversationStep {
  type: 'thinking' | 'tool' | 'result' | 'response';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export default function PlaygroundAgentSDK() {
  const [activeTab, setActiveTab] = useState<'loop' | 'tools' | 'multi'>('loop');
  const [conversationSteps, setConversationSteps] = useState<ConversationStep[]>([]);

  const simulateResponse = async (userMessage: string): Promise<Message[]> => {
    const responses: Message[] = [];
    const steps: ConversationStep[] = [];

    // Simulate agentic loop for "create a file" request
    if (userMessage.toLowerCase().includes('create') && userMessage.toLowerCase().includes('file')) {
      // Step 1: Model thinks
      steps.push({
        type: 'thinking',
        content: 'I need to create a file. Let me use the write_file tool.',
      });

      // Step 2: Tool call
      steps.push({
        type: 'tool',
        content: '',
        toolName: 'write_file',
        toolInput: { path: 'hello.txt', content: 'Hello World!' },
      });

      responses.push({
        id: `tool-${Date.now()}`,
        role: 'tool',
        content: '',
        toolName: 'write_file',
        toolInput: { path: 'hello.txt', content: 'Hello World!' },
        toolOutput: 'File written successfully',
        timestamp: new Date(),
      });

      // Step 3: Model responds
      steps.push({
        type: 'response',
        content: "I've created the file hello.txt with the content 'Hello World!'",
      });

      responses.push({
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content:
          "I've created the file hello.txt with the content 'Hello World!'. The agentic loop completed in 1 tool call.",
        timestamp: new Date(),
      });
    }
    // Simulate multi-step task
    else if (userMessage.toLowerCase().includes('refactor') || userMessage.toLowerCase().includes('fix')) {
      // Step 1: Read file
      steps.push({
        type: 'thinking',
        content: 'First, I need to read the file to understand the current code.',
      });

      responses.push({
        id: `tool-${Date.now()}`,
        role: 'tool',
        content: '',
        toolName: 'read_file',
        toolInput: { path: 'src/component.tsx' },
        toolOutput: 'export function Component() {\n  return <div>Hello</div>\n}',
        timestamp: new Date(),
      });

      await new Promise((r) => setTimeout(r, 800));

      // Step 2: Search for usages
      steps.push({
        type: 'thinking',
        content: 'Let me check where this component is used.',
      });

      responses.push({
        id: `tool-${Date.now() + 1}`,
        role: 'tool',
        content: '',
        toolName: 'search_codebase',
        toolInput: { query: 'Component', file_pattern: '*.tsx' },
        toolOutput: 'Found 3 usages:\n- src/app/page.tsx:5\n- src/app/about.tsx:12\n- src/layouts/main.tsx:8',
        timestamp: new Date(),
      });

      await new Promise((r) => setTimeout(r, 800));

      // Step 3: Make the edit
      steps.push({
        type: 'thinking',
        content: 'Now I\'ll make the refactoring change.',
      });

      responses.push({
        id: `tool-${Date.now() + 2}`,
        role: 'tool',
        content: '',
        toolName: 'edit_file',
        toolInput: {
          path: 'src/component.tsx',
          old_text: 'return <div>Hello</div>',
          new_text: 'return <div className="greeting">Hello</div>',
        },
        toolOutput: 'File edited successfully',
        timestamp: new Date(),
      });

      await new Promise((r) => setTimeout(r, 500));

      // Final response
      responses.push({
        id: `msg-${Date.now() + 3}`,
        role: 'assistant',
        content:
          "I've completed the refactoring:\n\n1. Read the component file\n2. Found 3 usages across the codebase\n3. Updated the component with the className\n\nThe agentic loop completed in 3 tool calls.",
        timestamp: new Date(),
      });
    }
    // Default demo response
    else {
      responses.push({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `This is a simulated Agent SDK demo. The agentic loop works like this:

1. **User sends message** → Your message goes to Claude
2. **Model thinks** → Claude decides what tools to use
3. **Tool execution** → Your code runs the tools
4. **Loop continues** → Until Claude says "done"

Try asking me to:
- "Create a new file called test.txt"
- "Refactor the component"
- "Fix the bug in the code"`,
        timestamp: new Date(),
      });
    }

    setConversationSteps(steps);
    return responses;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Option B: Build with Agent SDK
          </h1>
          <p className="text-gray-400">
            Create your own agent from scratch using Anthropic&apos;s API
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Code Examples */}
          <div className="space-y-6">
            {/* Core Concept */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-3 text-blue-400">
                The Agentic Loop
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Send message to Claude</p>
                    <p className="text-sm text-gray-400">
                      Include tool definitions and conversation history
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Check stop_reason</p>
                    <p className="text-sm text-gray-400">
                      &quot;end_turn&quot; = done, &quot;tool_use&quot; = execute tools
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Execute tools</p>
                    <p className="text-sm text-gray-400">
                      Run the requested tools and collect results
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Send results back</p>
                    <p className="text-sm text-gray-400">
                      Add tool results to messages, loop back to step 1
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Code Examples Tabs */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="flex border-b border-gray-800">
                <button
                  onClick={() => setActiveTab('loop')}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'loop'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Agentic Loop
                </button>
                <button
                  onClick={() => setActiveTab('tools')}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'tools'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Tool Definitions
                </button>
                <button
                  onClick={() => setActiveTab('multi')}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'multi'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Multi-Turn
                </button>
              </div>

              <div className="p-4">
                <pre className="text-xs bg-gray-950 p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                  <code className="text-gray-300">
                    {activeTab === 'loop' && AGENTIC_LOOP_CODE}
                    {activeTab === 'tools' && TOOL_DEFINITION_CODE}
                    {activeTab === 'multi' && MULTI_TURN_CODE}
                  </code>
                </pre>
              </div>
            </div>

            {/* Execution Trace */}
            {conversationSteps.length > 0 && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h2 className="text-lg font-semibold mb-3 text-blue-400">
                  Execution Trace
                </h2>
                <div className="space-y-2">
                  {conversationSteps.map((step, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded text-sm ${
                        step.type === 'thinking'
                          ? 'bg-gray-800 text-gray-300'
                          : step.type === 'tool'
                            ? 'bg-amber-900/20 text-amber-300'
                            : 'bg-green-900/20 text-green-300'
                      }`}
                    >
                      {step.type === 'thinking' && `💭 ${step.content}`}
                      {step.type === 'tool' && `🔧 Tool: ${step.toolName}`}
                      {step.type === 'response' && `✓ ${step.content}`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Chat Demo */}
          <div className="h-[700px]">
            <AgentChat
              simulateResponse={simulateResponse}
              placeholder="Try: Create a file or Refactor the component..."
              systemPrompt="Agent SDK demo - I'll show you how the agentic loop executes step by step."
            />
          </div>
        </div>

        {/* Benefits Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h3 className="font-semibold text-green-400 mb-2">
              Pros
            </h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Full control over agent behavior</li>
              <li>• Custom tool implementations</li>
              <li>• No external dependencies</li>
              <li>• Direct API access</li>
            </ul>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h3 className="font-semibold text-amber-400 mb-2">
              Cons
            </h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• More code to write and maintain</li>
              <li>• Must handle edge cases yourself</li>
              <li>• No built-in safety features</li>
              <li>• Requires API key management</li>
            </ul>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h3 className="font-semibold text-blue-400 mb-2">
              Best For
            </h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Custom agent architectures</li>
              <li>• Specialized use cases</li>
              <li>• Maximum flexibility needs</li>
              <li>• Learning how agents work</li>
            </ul>
          </div>
        </div>

        {/* Comparison */}
        <div className="mt-8 bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-bold mb-4">Option A vs Option B</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-4">Aspect</th>
                  <th className="text-left py-2 px-4 text-purple-400">
                    Option A: Extend Claude Code
                  </th>
                  <th className="text-left py-2 px-4 text-blue-400">
                    Option B: Agent SDK
                  </th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-800">
                  <td className="py-2 px-4 font-medium">Setup Time</td>
                  <td className="py-2 px-4">Minutes (add MCP server)</td>
                  <td className="py-2 px-4">Hours (build from scratch)</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 px-4 font-medium">Flexibility</td>
                  <td className="py-2 px-4">Limited to MCP protocol</td>
                  <td className="py-2 px-4">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 px-4 font-medium">Maintenance</td>
                  <td className="py-2 px-4">Low (Anthropic maintains core)</td>
                  <td className="py-2 px-4">High (you maintain everything)</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 px-4 font-medium">Distribution</td>
                  <td className="py-2 px-4">npm package for MCP server</td>
                  <td className="py-2 px-4">Full application binary</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-medium">Best Use Case</td>
                  <td className="py-2 px-4">Adding tools to existing workflow</td>
                  <td className="py-2 px-4">Building a new product</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
