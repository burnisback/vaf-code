'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Undo2, Redo2, Brain, Users, ChevronRight, Loader2 } from 'lucide-react';
import { useWebContainer } from '@/lib/webcontainer/context';
import { useStreamingFileOperations } from '@/hooks/useStreamingFileOperations';
import { useOperationHistory, operationHistory } from '@/lib/ai/executor';
import { parseFileOperations } from '@/lib/ai/parser/fileOperations';
import {
  StreamingMessage,
  StreamingMessageLoading,
} from './chat/operations';
import type { FileOperationV2, OperationPhase, ExecutionResult } from '@/lib/ai/types';

// =============================================================================
// TYPES
// =============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'orchestrator';
  content: string;
  operations?: FileOperationV2[];
  executionResults?: Map<string, ExecutionResult>;
  phase?: OperationPhase;
  // Orchestrator-specific data
  orchestratorData?: OrchestratorResponse;
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
  success: boolean;
  analysis: {
    requestType: 'question' | 'task' | 'ambiguous' | 'complex';
    primaryIntent: string;
    complexity: 'simple' | 'moderate' | 'complex';
    reasoning: string;
  };
  agents: AgentAssignment[];
  userMessage?: string;
}

// =============================================================================
// AGENT INFO
// =============================================================================

const AGENT_DISPLAY_INFO: Record<string, { name: string; icon: string; color: string }> = {
  'vaf-pm': { name: 'Product Manager', icon: '📋', color: 'text-blue-400' },
  'vaf-architect': { name: 'Solution Architect', icon: '🏗️', color: 'text-purple-400' },
  'vaf-frontend': { name: 'Frontend Engineer', icon: '🖥️', color: 'text-green-400' },
  'vaf-backend': { name: 'Backend Engineer', icon: '⚙️', color: 'text-orange-400' },
  'vaf-designer': { name: 'UX/UI Designer', icon: '🎨', color: 'text-pink-400' },
  'vaf-qa': { name: 'Quality Assurance', icon: '✅', color: 'text-teal-400' },
  'vaf-researcher': { name: 'Researcher', icon: '🔍', color: 'text-yellow-400' },
  'vaf-filefinder': { name: 'File Finder', icon: '📁', color: 'text-cyan-400' },
  'vaf-validator': { name: 'Validator', icon: '🛡️', color: 'text-red-400' },
};

// =============================================================================
// ORCHESTRATOR DECISION COMPONENT
// =============================================================================

function OrchestratorDecision({ data }: { data: OrchestratorResponse }) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const complexityColors = {
    simple: 'bg-green-500/20 text-green-400 border-green-500/30',
    moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    complex: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const typeColors = {
    question: 'bg-blue-500/20 text-blue-400',
    task: 'bg-purple-500/20 text-purple-400',
    ambiguous: 'bg-orange-500/20 text-orange-400',
    complex: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-[var(--color-text-primary)]">VAF-ORCHESTRATOR Analysis</span>
          </div>
        </div>

        {/* Analysis Summary */}
        <div className="p-4 space-y-3">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColors[data.analysis.requestType]}`}>
              {data.analysis.requestType.toUpperCase()}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${complexityColors[data.analysis.complexity]}`}>
              {data.analysis.complexity} complexity
            </span>
          </div>

          {/* Intent */}
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">Primary Intent:</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{data.analysis.primaryIntent}</p>
          </div>

          {/* Reasoning */}
          <div className="text-xs text-[var(--color-text-tertiary)] italic">
            {data.analysis.reasoning}
          </div>
        </div>

        {/* Agent Assignments */}
        <div className="border-t border-[var(--color-border-default)]">
          <div className="px-4 py-2 bg-[var(--color-surface-tertiary)]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--color-accent-primary)]" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                Assigned Agents ({data.agents.length})
              </span>
            </div>
          </div>

          <div className="divide-y divide-[var(--color-border-default)]">
            {data.agents.map((agent, idx) => {
              const agentInfo = AGENT_DISPLAY_INFO[agent.agentId] || {
                name: agent.agentId,
                icon: '🤖',
                color: 'text-gray-400'
              };
              const isExpanded = expandedAgent === agent.agentId;

              return (
                <div key={agent.agentId} className="bg-[var(--color-surface-primary)]">
                  <button
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.agentId)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-surface-secondary)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{agentInfo.icon}</span>
                      <div className="text-left">
                        <p className={`text-sm font-medium ${agentInfo.color}`}>
                          {agentInfo.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          Priority {agent.priority} - {agent.executionMode}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Instructions */}
                      <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)]">
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Instructions:</p>
                        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                          {agent.instructions}
                        </p>
                      </div>

                      {/* Context */}
                      {agent.context.relevantFiles.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Relevant Files:</p>
                          <div className="space-y-1">
                            {agent.context.relevantFiles.slice(0, 5).map((file, i) => (
                              <div key={i} className="text-xs text-[var(--color-text-tertiary)] font-mono">
                                {file.path}
                              </div>
                            ))}
                            {agent.context.relevantFiles.length > 5 && (
                              <div className="text-xs text-[var(--color-text-tertiary)]">
                                +{agent.context.relevantFiles.length - 5} more files
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* User Message */}
        {data.userMessage && (
          <div className="px-4 py-3 bg-blue-500/10 border-t border-blue-500/20">
            <p className="text-sm text-blue-300">{data.userMessage}</p>
          </div>
        )}

        {/* Action hint */}
        <div className="px-4 py-2 bg-[var(--color-surface-tertiary)] border-t border-[var(--color-border-default)]">
          <p className="text-xs text-[var(--color-text-tertiary)] text-center">
            Agent execution coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN CHAT COMPONENT
// =============================================================================

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m powered by the VAF-ORCHESTRATOR. Send me a request and I\'ll analyze it and determine which specialized agents should handle it.'
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { webcontainer, triggerFilesystemRefresh } = useWebContainer();
  const { state: streamingState, processChunk, startStreaming, endStreaming, reset, retryOperation } = useStreamingFileOperations();
  const { canUndo, canRedo, undo, redo } = useOperationHistory();

  useEffect(() => {
    if (webcontainer) {
      operationHistory.setWebContainer(webcontainer);
    }
  }, [webcontainer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load project summary from WebContainer
  const loadProjectSummary = async () => {
    if (!webcontainer) return null;

    try {
      const content = await webcontainer.fs.readFile('docs/project-summary.json', 'utf-8');
      return JSON.parse(content);
    } catch {
      console.log('[Chat] No project summary found');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const messageId = `msg-${Date.now()}`;

    setInput('');
    setMessages(prev => [...prev, { id: messageId, role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Step 1: Load project summary
      const projectSummary = await loadProjectSummary();

      // Step 2: Call VAF-ORCHESTRATOR
      const response = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          projectSummary,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Orchestrator failed: ${response.status}`);
      }

      const orchestratorResponse: OrchestratorResponse = await response.json();

      // Step 3: Add orchestrator response to messages
      setMessages(prev => [...prev, {
        id: `orchestrator-${Date.now()}`,
        role: 'orchestrator',
        content: orchestratorResponse.analysis.primaryIntent,
        orchestratorData: orchestratorResponse,
      }]);

    } catch (error) {
      console.error('Orchestrator error:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Orchestrator error: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure you've run "Analyze Project" first.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-primary)]">
      {/* Header */}
      <div className="h-10 border-b border-[var(--color-border-default)] flex items-center justify-between px-4 bg-[var(--color-surface-secondary)]">
        <div className="flex items-center">
          <Brain className="w-4 h-4 mr-2 text-purple-400" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">VAF-ORCHESTRATOR</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 rounded hover:bg-[var(--color-surface-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Undo last file operation"
          >
            <Undo2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 rounded hover:bg-[var(--color-surface-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Redo file operation"
          >
            <Redo2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-[var(--color-accent-primary)] text-white">
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ) : msg.role === 'orchestrator' && msg.orchestratorData ? (
              <OrchestratorDecision data={msg.orchestratorData} />
            ) : msg.operations && msg.operations.length > 0 ? (
              <StreamingMessage
                textContent={msg.content}
                phase={msg.phase || 'complete'}
                operations={msg.operations}
                executionResults={msg.executionResults || new Map()}
                isStreaming={false}
                onRetryOperation={() => {}}
                onOpenFile={(path) => console.log('Open file:', path)}
              />
            ) : (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)]">
                  <p className="text-sm whitespace-pre-wrap text-[var(--color-text-primary)]">{msg.content}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-3 bg-[var(--color-surface-secondary)] border border-purple-500/30">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-sm text-purple-400">Orchestrator analyzing request...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-[var(--color-border-default)] p-4 bg-[var(--color-surface-secondary)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Describe what you want to build..."
            className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-[var(--color-text-tertiary)]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
