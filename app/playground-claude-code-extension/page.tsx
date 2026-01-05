'use client';

import { useState } from 'react';
import { AgentChat, Message } from '@/components/AgentChat';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  registered: boolean;
}

const SAMPLE_MCP_TOOLS: MCPTool[] = [
  {
    name: 'get_weather',
    description: 'Get current weather for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
      },
      required: ['location'],
    },
    registered: false,
  },
  {
    name: 'search_files',
    description: 'Search for files matching a pattern',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern' },
        path: { type: 'string', description: 'Directory to search' },
      },
      required: ['pattern'],
    },
    registered: false,
  },
  {
    name: 'run_query',
    description: 'Execute a database query',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL query to execute' },
      },
      required: ['sql'],
    },
    registered: false,
  },
];

const MCP_SERVER_CODE = `// mcp-server.ts - MCP Server Implementation
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'my-mcp-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Define your tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'get_weather',
      description: 'Get weather for a location',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_weather') {
    // Your tool implementation
    return {
      content: [{
        type: 'text',
        text: \`Weather in \${args.location}: 72°F, Sunny\`,
      }],
    };
  }

  throw new Error(\`Unknown tool: \${name}\`);
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);`;

const SKILL_CODE = `// .claude/commands/my-skill.md
---
name: my-skill
description: A custom skill for Claude Code
---

# My Custom Skill

When this skill is invoked, follow these steps:

1. First, analyze the user's request
2. Use the available tools to gather information
3. Synthesize the results

## Available Tools

You have access to:
- \`get_weather\`: Get weather information
- \`search_files\`: Find files in the codebase
- \`run_query\`: Execute database queries

## Example Usage

When the user asks about weather:
1. Call get_weather with the location
2. Format the response nicely
3. Offer follow-up suggestions`;

const CONFIG_CODE = `// .claude/settings.json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["ts-node", "mcp-server.ts"]
    }
  },
  "permissions": {
    "allow": [
      "Bash(npm:*)",
      "Read(**)",
      "Write(**)"
    ]
  }
}`;

export default function PlaygroundClaudeCodeExtension() {
  const [tools, setTools] = useState<MCPTool[]>(SAMPLE_MCP_TOOLS);
  const [activeTab, setActiveTab] = useState<'mcp' | 'skill' | 'config'>('mcp');

  const registerTool = (toolName: string) => {
    setTools((prev) =>
      prev.map((tool) =>
        tool.name === toolName ? { ...tool, registered: true } : tool
      )
    );
  };

  const simulateResponse = async (userMessage: string): Promise<Message[]> => {
    const registeredTools = tools.filter((t) => t.registered);
    const responses: Message[] = [];

    // Check if user is asking about weather
    if (userMessage.toLowerCase().includes('weather')) {
      const weatherTool = registeredTools.find((t) => t.name === 'get_weather');
      if (weatherTool) {
        responses.push({
          id: `tool-${Date.now()}`,
          role: 'tool',
          content: '',
          toolName: 'get_weather',
          toolInput: { location: 'San Francisco' },
          toolOutput: 'Temperature: 68°F, Conditions: Partly Cloudy, Humidity: 65%',
          timestamp: new Date(),
        });
        responses.push({
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content:
            "Based on the weather data, it's currently 68°F and partly cloudy in San Francisco with 65% humidity. Perfect weather for a walk!",
          timestamp: new Date(),
        });
      } else {
        responses.push({
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content:
            "I'd love to help with weather information, but the get_weather tool isn't registered yet. Try registering it from the MCP Tools panel!",
          timestamp: new Date(),
        });
      }
    }
    // Check if user is asking about files
    else if (
      userMessage.toLowerCase().includes('file') ||
      userMessage.toLowerCase().includes('search')
    ) {
      const searchTool = registeredTools.find((t) => t.name === 'search_files');
      if (searchTool) {
        responses.push({
          id: `tool-${Date.now()}`,
          role: 'tool',
          content: '',
          toolName: 'search_files',
          toolInput: { pattern: '**/*.tsx', path: 'src/' },
          toolOutput:
            'Found 12 files:\n- src/app/page.tsx\n- src/app/layout.tsx\n- src/components/AgentChat.tsx\n...',
          timestamp: new Date(),
        });
        responses.push({
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content:
            "I found 12 TypeScript React files in your project. The main ones are in src/app/ and src/components/. Would you like me to examine any specific file?",
          timestamp: new Date(),
        });
      } else {
        responses.push({
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content:
            "I can help search for files, but the search_files tool needs to be registered first. Enable it in the MCP Tools panel!",
          timestamp: new Date(),
        });
      }
    }
    // Default response
    else {
      const toolList =
        registeredTools.length > 0
          ? registeredTools.map((t) => t.name).join(', ')
          : 'none yet';
      responses.push({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `I'm a simulated Claude Code extension demo. I currently have these tools available: ${toolList}.\n\nTry asking me about:\n- "What's the weather like?"\n- "Search for files"\n- "Run a database query"`,
        timestamp: new Date(),
      });
    }

    return responses;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Option A: Extend Claude Code
          </h1>
          <p className="text-gray-400">
            Add custom capabilities to Claude Code using MCP servers and skills
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Configuration */}
          <div className="space-y-6">
            {/* MCP Tools Registration */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 text-purple-400">
                MCP Tools
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Register tools to make them available to Claude Code. Click a
                tool to enable it.
              </p>

              <div className="space-y-3">
                {tools.map((tool) => (
                  <div
                    key={tool.name}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      tool.registered
                        ? 'bg-green-900/20 border-green-700/50'
                        : 'bg-gray-800/50 border-gray-700 hover:border-purple-500/50'
                    }`}
                    onClick={() => !tool.registered && registerTool(tool.name)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm">{tool.name}</span>
                      {tool.registered ? (
                        <span className="text-xs bg-green-600 px-2 py-0.5 rounded">
                          Registered
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          Click to register
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{tool.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Examples */}
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="flex border-b border-gray-800">
                <button
                  onClick={() => setActiveTab('mcp')}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'mcp'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  MCP Server
                </button>
                <button
                  onClick={() => setActiveTab('skill')}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'skill'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Skill Definition
                </button>
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'config'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Configuration
                </button>
              </div>

              <div className="p-4">
                <pre className="text-xs bg-gray-950 p-4 rounded-lg overflow-x-auto max-h-80 overflow-y-auto">
                  <code className="text-gray-300">
                    {activeTab === 'mcp' && MCP_SERVER_CODE}
                    {activeTab === 'skill' && SKILL_CODE}
                    {activeTab === 'config' && CONFIG_CODE}
                  </code>
                </pre>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-3 text-purple-400">
                How MCP Extensions Work
              </h2>
              <ol className="space-y-2 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-purple-400 font-mono">1.</span>
                  Create an MCP server that implements your tools
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 font-mono">2.</span>
                  Register the server in .claude/settings.json
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 font-mono">3.</span>
                  Claude Code discovers your tools automatically
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 font-mono">4.</span>
                  When Claude needs your tool, it calls your server
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 font-mono">5.</span>
                  Your server executes and returns results
                </li>
              </ol>
            </div>
          </div>

          {/* Right Panel - Chat Demo */}
          <div className="h-[700px]">
            <AgentChat
              simulateResponse={simulateResponse}
              placeholder="Try: What's the weather? or Search for files..."
              systemPrompt="Claude Code with MCP extensions. Register tools on the left to enable capabilities."
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
              <li>• Leverage existing Claude Code infrastructure</li>
              <li>• Easy to add custom tools via MCP</li>
              <li>• Skills provide reusable workflows</li>
              <li>• Active community and ecosystem</li>
            </ul>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h3 className="font-semibold text-amber-400 mb-2">
              Cons
            </h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Tied to Claude Code&apos;s architecture</li>
              <li>• Limited control over agent behavior</li>
              <li>• Must follow MCP protocol</li>
              <li>• Depends on Claude Code updates</li>
            </ul>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h3 className="font-semibold text-blue-400 mb-2">
              Best For
            </h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Adding domain-specific tools</li>
              <li>• Custom integrations (APIs, DBs)</li>
              <li>• Team-specific workflows</li>
              <li>• Quick prototyping</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
