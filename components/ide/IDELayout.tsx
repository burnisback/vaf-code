'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileExplorer } from './FileExplorer';
import { EditorTabs, OpenFile } from './EditorTabs';
import { MonacoEditorWrapper } from './MonacoEditorWrapper';
import { PreviewPanel } from './PreviewPanel';
import { TerminalPanel } from './TerminalPanel';
import { StatusBar } from './StatusBar';
import { WebContainerProvider, useWebContainer, LoadingState } from '@/lib/webcontainer/context';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import {
  Send,
  Eye,
  Code,
  Database,
  Terminal,
  RefreshCw,
  AlertCircle,
  Loader2,
  GitBranch,
  Brain,
  Users,
  ChevronRight
} from 'lucide-react';
import { WorkflowTab } from '@/components/workflow/WorkflowTab';
import type { ProjectSummaryWithHashes } from '@/lib/ai/projectAnalyzer';

// =============================================================================
// ORCHESTRATOR TYPES
// =============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'orchestrator' | 'pm' | 'architect' | 'designer' | 'frontend';
  content: string;
  orchestratorData?: OrchestratorResponse;
  pmData?: PMResponse;
  architectData?: ArchitectResponse;
  designerData?: DesignerResponse;
  frontendData?: FrontendResponse;
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
  quickFix?: {  // NEW: for direct fixes that bypass the full pipeline
    type: 'install-dependency';
    packages: string[];
    message: string;
  };
  analysis: {
    requestType: 'question' | 'task' | 'ambiguous' | 'complex';
    taskMode?: 'creation' | 'modification';  // NEW: distinguishes create vs modify
    primaryIntent: string;
    complexity: 'simple' | 'moderate' | 'complex';
    reasoning: string;
    targetFiles?: string[];  // NEW: files to modify (for modification mode)
  };
  agents: AgentAssignment[];
  userMessage?: string;
}

// =============================================================================
// WORK ITEM CONTEXT - Normalized project info for all agents
// =============================================================================

interface WorkItemContext {
  // Language & Extensions
  language: 'javascript' | 'typescript';
  componentExtension: '.jsx' | '.tsx' | '.js' | '.ts';

  // Framework & Structure
  framework: string;
  frameworkType: 'vite' | 'nextjs' | 'cra' | 'other';
  componentDir: string;
  pageDir: string;
  hookDir: string;
  utilDir: string;
  apiDir: string;

  // Styling
  styling: string;

  // Routing
  routingPattern: 'file-based' | 'react-router' | 'tanstack-router' | 'none';

  // Existing patterns
  existingComponents: string[];
}

/**
 * Extract normalized project context from projectSummary
 * This ensures all agents use consistent file extensions and paths
 */
function extractWorkItemContext(projectSummary: ProjectSummaryWithHashes | null): WorkItemContext {
  // Default context for when no project summary exists
  const defaultContext: WorkItemContext = {
    language: 'javascript',
    componentExtension: '.jsx',
    framework: 'React',
    frameworkType: 'vite',
    componentDir: 'src/components',
    pageDir: 'src/pages',
    hookDir: 'src/hooks',
    utilDir: 'src/lib',
    apiDir: 'src/api',
    styling: 'CSS',
    routingPattern: 'react-router',
    existingComponents: [],
  };

  if (!projectSummary) return defaultContext;

  // Detect language from file extensions
  const files = projectSummary.files || [];
  const hasTypeScript = files.some(f =>
    f.path.endsWith('.tsx') || f.path.endsWith('.ts')
  );
  const hasJSX = files.some(f => f.path.endsWith('.jsx'));

  // Determine component extension
  let componentExtension: '.jsx' | '.tsx' | '.js' | '.ts' = '.jsx';
  if (hasTypeScript) {
    componentExtension = '.tsx';
  } else if (hasJSX) {
    componentExtension = '.jsx';
  }

  // Detect framework type
  const framework = projectSummary.technology?.framework || 'React';
  let frameworkType: 'vite' | 'nextjs' | 'cra' | 'other' = 'other';
  const frameworkLower = framework.toLowerCase();
  if (frameworkLower.includes('vite')) {
    frameworkType = 'vite';
  } else if (frameworkLower.includes('next')) {
    frameworkType = 'nextjs';
  } else if (frameworkLower.includes('create-react-app') || frameworkLower.includes('cra')) {
    frameworkType = 'cra';
  }

  // Detect directories from existing files
  let componentDir = 'src/components';
  let pageDir = frameworkType === 'nextjs' ? 'src/app' : 'src/pages';
  let hookDir = 'src/hooks';
  let utilDir = 'src/lib';
  let apiDir = frameworkType === 'nextjs' ? 'src/app/api' : 'src/api';

  // Check actual file paths to detect patterns
  for (const file of files) {
    const path = file.path;
    if (path.includes('/components/') && !componentDir.includes(path.split('/components/')[0])) {
      componentDir = path.split('/components/')[0] + '/components';
    }
    if (path.includes('/pages/')) {
      pageDir = path.split('/pages/')[0] + '/pages';
    }
    if (path.includes('/app/') && frameworkType === 'nextjs') {
      pageDir = path.split('/app/')[0] + '/app';
    }
    if (path.includes('/hooks/')) {
      hookDir = path.split('/hooks/')[0] + '/hooks';
    }
  }

  // Detect styling
  const styling = projectSummary.technology?.styling?.join(', ') || 'CSS';

  // Detect routing pattern
  let routingPattern: 'file-based' | 'react-router' | 'tanstack-router' | 'none' = 'none';
  if (frameworkType === 'nextjs') {
    routingPattern = 'file-based';
  } else {
    // Check for react-router in files
    const hasReactRouter = files.some(f =>
      f.path.includes('Router') || f.path.includes('routes')
    );
    if (hasReactRouter) {
      routingPattern = 'react-router';
    }
  }

  // Extract existing component names
  const existingComponents = files
    .filter(f => f.path.includes('/components/') && f.type === 'file')
    .map(f => {
      const fileName = f.path.split('/').pop() || '';
      return fileName.replace(/\.(jsx|tsx|js|ts)$/, '');
    })
    .filter(name => name && name[0] === name[0].toUpperCase()); // Only PascalCase

  return {
    language: hasTypeScript ? 'typescript' : 'javascript',
    componentExtension,
    framework,
    frameworkType,
    componentDir,
    pageDir,
    hookDir,
    utilDir,
    apiDir,
    styling,
    routingPattern,
    existingComponents,
  };
}

// =============================================================================
// AGENT DISPLAY INFO
// =============================================================================

// =============================================================================
// PRD TYPES (from PM Agent)
// =============================================================================

interface UserStory {
  id: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  priority: 'must-have' | 'should-have' | 'nice-to-have';
}

interface PRD {
  title: string;
  summary: string;
  userStories: UserStory[];
  outOfScope: string[];
  assumptions: string[];
}

interface PMResponse {
  workItemId: string;
  status: 'success' | 'needs-clarification';
  prd: PRD;
  taskMode?: 'creation' | 'modification';  // NEW
  targetFiles?: string[];  // NEW
  clarificationQuestions?: string[];
  nextAgent: string;
}

// =============================================================================
// ARCHITECTURE TYPES (from Architect Agent)
// =============================================================================

interface ComponentSpec {
  name: string;
  type: 'page' | 'container' | 'presentational' | 'hook' | 'utility' | 'api';
  path: string;
  description: string;
  operationType?: 'create' | 'edit';  // Whether to create new or edit existing
  editInstructions?: string;  // Instructions for edit operations
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

interface ArchitectResponse {
  workItemId: string;
  status: 'success' | 'needs-clarification';
  architecture: Architecture;
  taskMode?: 'creation' | 'modification';  // NEW: pass through from PM
  targetFiles?: string[];  // NEW: files to modify (for modification mode)
  clarificationQuestions?: string[];
  nextAgent: string;
}

// =============================================================================
// DESIGNER TYPES (from Designer Agent)
// =============================================================================

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

interface DesignerResponse {
  workItemId: string;
  status: 'success' | 'needs-clarification';
  styleGuide: StyleGuide;
  componentSpecs: ComponentDesignSpec[];
  recommendations: string[];
  nextAgent: string;
}

// =============================================================================
// FRONTEND TYPES (from Frontend Agent)
// =============================================================================

interface FileOperation {
  type: 'create' | 'edit' | 'delete';
  path: string;
  content: string;
  description: string;
  edits?: Array<{ oldContent: string; newContent: string }>;  // NEW: for edit operations
}

// =============================================================================
// ERROR ANALYSIS TYPES (for AI-powered error fixing)
// =============================================================================

interface DependencyFix {
  type: 'install-dependency';
  packages: string[];
  reason: string;
}

interface CodeFix {
  type: 'code-fix';
  file: string;
  issue: string;
  suggestedFix: string;
}

interface ErrorAnalysisResponse {
  workItemId: string;
  status: 'fixable' | 'needs-investigation' | 'unfixable';
  rootCause: string;
  fixes: (DependencyFix | CodeFix)[];
  allAffectedFiles: string[];
  fixOrder: string[];
  additionalContext?: string;
}

interface FrontendResponse {
  workItemId: string;
  status: 'success' | 'partial' | 'failed';
  fileOperations: FileOperation[];
  implementedComponents: string[];
  errors?: string[];
  nextAgent: string;
}

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
  'vaf-ui': { name: 'UI Engineer', icon: '🎯', color: 'text-indigo-400' },
  'vaf-integrations': { name: 'Integrations', icon: '🔗', color: 'text-emerald-400' },
  'vaf-e2e': { name: 'E2E Testing', icon: '🧪', color: 'text-lime-400' },
  'vaf-security-review': { name: 'Security Review', icon: '🔒', color: 'text-rose-400' },
  'vaf-devops': { name: 'DevOps', icon: '🚀', color: 'text-sky-400' },
  'vaf-docs': { name: 'Documentation', icon: '📚', color: 'text-amber-400' },
  'vaf-ux': { name: 'UX Lead', icon: '🎨', color: 'text-pink-400' },
  'vaf-ai': { name: 'AI Engineer', icon: '🤖', color: 'text-violet-400' },
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
            {data.agents.map((agent) => {
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

                      {/* Input Parameters */}
                      <div className="p-3 rounded-lg bg-[var(--color-surface-tertiary)] border border-[var(--color-border-default)]">
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Input Parameters:</p>
                        <div className="space-y-2 text-xs font-mono">
                          {/* Project Info */}
                          {agent.context.projectInfo && (
                            <div className="flex gap-2">
                              <span className="text-[var(--color-text-tertiary)]">framework:</span>
                              <span className="text-green-400">{agent.context.projectInfo.framework || 'N/A'}</span>
                            </div>
                          )}
                          {agent.context.projectInfo && (
                            <div className="flex gap-2">
                              <span className="text-[var(--color-text-tertiary)]">architecture:</span>
                              <span className="text-green-400">{agent.context.projectInfo.architecture || 'N/A'}</span>
                            </div>
                          )}
                          {/* Relevant Directories */}
                          {agent.context.relevantDirectories && agent.context.relevantDirectories.length > 0 && (
                            <div>
                              <span className="text-[var(--color-text-tertiary)]">directories:</span>
                              <div className="ml-2 mt-1 space-y-0.5">
                                {agent.context.relevantDirectories.map((dir, i) => (
                                  <div key={i} className="text-cyan-400">{dir}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Relevant Files */}
                      {agent.context.relevantFiles.length > 0 && (
                        <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)]">
                          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Relevant Files:</p>
                          <div className="space-y-2">
                            {agent.context.relevantFiles.slice(0, 5).map((file, i) => (
                              <div key={i} className="text-xs">
                                <div className="font-mono text-cyan-400">{file.path}</div>
                                <div className="text-[var(--color-text-tertiary)] ml-2">{file.purpose}</div>
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
// PRD DISPLAY COMPONENT
// =============================================================================

function PRDDisplay({ data }: { data: PMResponse }) {
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  const priorityColors = {
    'must-have': 'bg-red-500/20 text-red-400 border-red-500/30',
    'should-have': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'nice-to-have': 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="font-semibold text-[var(--color-text-primary)]">VAF-PM: Product Requirements</span>
            <span className={`ml-auto px-2 py-0.5 text-xs rounded-full ${
              data.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
            }`}>
              {data.status === 'success' ? 'Complete' : 'Needs Clarification'}
            </span>
          </div>
        </div>

        {/* PRD Summary */}
        <div className="p-4 border-b border-[var(--color-border-default)]">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            {data.prd.title}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {data.prd.summary}
          </p>
        </div>

        {/* User Stories */}
        <div className="border-b border-[var(--color-border-default)]">
          <div className="px-4 py-2 bg-[var(--color-surface-tertiary)]">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              User Stories ({data.prd.userStories.length})
            </span>
          </div>

          <div className="divide-y divide-[var(--color-border-default)]">
            {data.prd.userStories.map((story) => {
              const isExpanded = expandedStory === story.id;

              return (
                <div key={story.id} className="bg-[var(--color-surface-primary)]">
                  <button
                    onClick={() => setExpandedStory(isExpanded ? null : story.id)}
                    className="w-full px-4 py-3 flex items-start justify-between hover:bg-[var(--color-surface-secondary)] transition-colors text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{story.id}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${priorityColors[story.priority]}`}>
                          {story.priority}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-primary)]">
                        As a <span className="font-medium text-blue-400">{story.asA}</span>,
                        I want <span className="font-medium text-green-400">{story.iWant}</span>
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform mt-1 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* So That */}
                      <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)]">
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">So that:</p>
                        <p className="text-sm text-[var(--color-text-primary)]">{story.soThat}</p>
                      </div>

                      {/* Acceptance Criteria */}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Acceptance Criteria:</p>
                        <ul className="space-y-1">
                          {story.acceptanceCriteria.map((criteria, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                              <span className="text-green-400 mt-0.5">✓</span>
                              {criteria}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Out of Scope & Assumptions */}
        <div className="p-4 space-y-3">
          {data.prd.outOfScope.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Out of Scope:</p>
              <ul className="text-xs text-[var(--color-text-tertiary)] space-y-0.5">
                {data.prd.outOfScope.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {data.prd.assumptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Assumptions:</p>
              <ul className="text-xs text-[var(--color-text-tertiary)] space-y-0.5">
                {data.prd.assumptions.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Next Step */}
        <div className="px-4 py-2 bg-[var(--color-surface-tertiary)] border-t border-[var(--color-border-default)]">
          <p className="text-xs text-[var(--color-text-tertiary)] text-center">
            Next: <span className="text-purple-400 font-medium">VAF-ARCHITECT</span> will create technical design
          </p>
        </div>

        {/* Clarification Questions (if any) */}
        {data.clarificationQuestions && data.clarificationQuestions.length > 0 && (
          <div className="px-4 py-3 bg-orange-500/10 border-t border-orange-500/20">
            <p className="text-xs font-medium text-orange-400 mb-2">Questions for Clarification:</p>
            <ul className="text-sm text-orange-300 space-y-1">
              {data.clarificationQuestions.map((q, i) => (
                <li key={i}>• {q}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ARCHITECTURE DISPLAY COMPONENT
// =============================================================================

function ArchitectureDisplay({ data }: { data: ArchitectResponse }) {
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  const typeColors: Record<string, string> = {
    'page': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'container': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'presentational': 'bg-green-500/20 text-green-400 border-green-500/30',
    'hook': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'utility': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    'api': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  const typeIcons: Record<string, string> = {
    'page': '📄',
    'container': '📦',
    'presentational': '🎨',
    'hook': '🪝',
    'utility': '🔧',
    'api': '🔌',
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏗️</span>
            <span className="font-semibold text-[var(--color-text-primary)]">VAF-ARCHITECT: Technical Design</span>
            <span className={`ml-auto px-2 py-0.5 text-xs rounded-full ${
              data.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
            }`}>
              {data.status === 'success' ? 'Complete' : 'Needs Clarification'}
            </span>
          </div>
        </div>

        {/* Architecture Summary */}
        <div className="p-4 border-b border-[var(--color-border-default)]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {data.architecture.summary}
          </p>
        </div>

        {/* Components */}
        <div className="border-b border-[var(--color-border-default)]">
          <div className="px-4 py-2 bg-[var(--color-surface-tertiary)]">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Components ({data.architecture.components.length})
            </span>
          </div>

          <div className="divide-y divide-[var(--color-border-default)]">
            {data.architecture.components.map((component) => {
              const isExpanded = expandedComponent === component.name;

              return (
                <div key={component.name} className="bg-[var(--color-surface-primary)]">
                  <button
                    onClick={() => setExpandedComponent(isExpanded ? null : component.name)}
                    className="w-full px-4 py-3 flex items-start justify-between hover:bg-[var(--color-surface-secondary)] transition-colors text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{typeIcons[component.type] || '📦'}</span>
                        <span className="font-mono text-sm font-medium text-[var(--color-text-primary)]">
                          {component.name}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${typeColors[component.type]}`}>
                          {component.type}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-tertiary)] font-mono">
                        {component.path}
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform mt-1 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Description */}
                      <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)]">
                        <p className="text-sm text-[var(--color-text-primary)]">{component.description}</p>
                      </div>

                      {/* Props */}
                      {component.props && component.props.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Props:</p>
                          <div className="space-y-1">
                            {component.props.map((prop, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                <span className="text-cyan-400">{prop.name}</span>
                                <span className="text-[var(--color-text-tertiary)]">:</span>
                                <span className="text-green-400">{prop.type}</span>
                                {prop.required && (
                                  <span className="text-red-400 text-[10px]">required</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Children & Dependencies */}
                      <div className="flex gap-4 text-xs">
                        {component.children && component.children.length > 0 && (
                          <div>
                            <span className="text-[var(--color-text-secondary)]">Children: </span>
                            <span className="text-blue-400">{component.children.join(', ')}</span>
                          </div>
                        )}
                        {component.dependencies && component.dependencies.length > 0 && (
                          <div>
                            <span className="text-[var(--color-text-secondary)]">Deps: </span>
                            <span className="text-yellow-400">{component.dependencies.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Implementation Order */}
        <div className="p-4 border-b border-[var(--color-border-default)]">
          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Implementation Order:</p>
          <div className="flex flex-wrap gap-2">
            {data.architecture.implementationOrder.map((name, i) => (
              <div key={name} className="flex items-center gap-1">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-xs font-mono text-[var(--color-text-primary)]">{name}</span>
                {i < data.architecture.implementationOrder.length - 1 && (
                  <span className="text-[var(--color-text-tertiary)] mx-1">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* State Management & API */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--color-text-secondary)]">State:</span>
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
              {data.architecture.stateManagement.approach}
            </span>
          </div>

          {data.architecture.apiEndpoints && data.architecture.apiEndpoints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">API Endpoints:</p>
              <div className="space-y-1">
                {data.architecture.apiEndpoints.map((endpoint, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      endpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                      endpoint.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                      endpoint.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {endpoint.method}
                    </span>
                    <span className="text-cyan-400">{endpoint.path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.architecture.dataFlow && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Data Flow:</p>
              <p className="text-xs text-[var(--color-text-tertiary)] italic">{data.architecture.dataFlow}</p>
            </div>
          )}
        </div>

        {/* Next Step */}
        <div className="px-4 py-2 bg-[var(--color-surface-tertiary)] border-t border-[var(--color-border-default)]">
          <p className="text-xs text-[var(--color-text-tertiary)] text-center">
            Next: <span className="text-pink-400 font-medium">VAF-DESIGNER</span> will create style specs
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESIGNER OUTPUT COMPONENT
// =============================================================================

function DesignerOutput({ data }: { data: DesignerResponse }) {
  const [expandedSpec, setExpandedSpec] = useState<string | null>(null);

  const categoryColors: Record<string, string> = {
    'color': 'bg-pink-500/20 text-pink-400',
    'spacing': 'bg-blue-500/20 text-blue-400',
    'typography': 'bg-purple-500/20 text-purple-400',
    'shadow': 'bg-gray-500/20 text-gray-400',
    'border': 'bg-yellow-500/20 text-yellow-400',
    'other': 'bg-green-500/20 text-green-400',
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎨</span>
            <span className="font-semibold text-[var(--color-text-primary)]">VAF-DESIGNER: Style Specifications</span>
            <span className={`ml-auto px-2 py-0.5 text-xs rounded-full ${
              data.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
            }`}>
              {data.status === 'success' ? 'Complete' : 'Needs Clarification'}
            </span>
          </div>
        </div>

        {/* Style Guide */}
        {data.styleGuide && (
          <div className="p-4 border-b border-[var(--color-border-default)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Style Guide</span>
              <span className={`px-2 py-0.5 text-xs rounded ${
                data.styleGuide.created ? 'bg-green-500/20 text-green-400' :
                data.styleGuide.exists ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
              }`}>
                {data.styleGuide.created ? 'Created' : data.styleGuide.exists ? 'Exists' : 'None'}
              </span>
            </div>

            {data.styleGuide.tokens && data.styleGuide.tokens.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.styleGuide.tokens.slice(0, 8).map((token, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-surface-tertiary)]">
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${categoryColors[token.category] || categoryColors.other}`}>
                      {token.category}
                    </span>
                    <span className="text-xs font-mono text-[var(--color-text-secondary)]">{token.name}:</span>
                    <span className="text-xs font-mono text-cyan-400">{token.value}</span>
                  </div>
                ))}
                {data.styleGuide.tokens.length > 8 && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    +{data.styleGuide.tokens.length - 8} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Component Specs */}
        <div className="border-b border-[var(--color-border-default)]">
          <div className="px-4 py-2 bg-[var(--color-surface-tertiary)]">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Component Specs ({data.componentSpecs.length})
            </span>
          </div>

          <div className="divide-y divide-[var(--color-border-default)]">
            {data.componentSpecs.map((spec) => {
              const isExpanded = expandedSpec === spec.component;

              return (
                <div key={spec.component} className="bg-[var(--color-surface-primary)]">
                  <button
                    onClick={() => setExpandedSpec(isExpanded ? null : spec.component)}
                    className="w-full px-4 py-3 flex items-start justify-between hover:bg-[var(--color-surface-secondary)] transition-colors text-left"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-medium text-[var(--color-text-primary)]">
                          {spec.component}
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {spec.variants.length} variants • {spec.states.length} states
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform mt-1 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Variants & States */}
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Variants:</p>
                          <div className="flex flex-wrap gap-1">
                            {spec.variants.map((v, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
                                {v}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">States:</p>
                          <div className="flex flex-wrap gap-1">
                            {spec.states.map((s, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Tokens */}
                      <div>
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Tailwind Classes:</p>
                        <div className="p-2 rounded bg-[var(--color-surface-tertiary)] space-y-1">
                          {Object.entries(spec.tokens).map(([key, value], i) => (
                            <div key={i} className="flex items-center gap-2 text-xs font-mono">
                              <span className="text-[var(--color-text-tertiary)]">{key}:</span>
                              <span className="text-cyan-400">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Accessibility */}
                      {spec.accessibility && (
                        <div>
                          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Accessibility:</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {spec.accessibility.role && (
                              <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                                role=&quot;{spec.accessibility.role}&quot;
                              </span>
                            )}
                            {spec.accessibility.focusable && (
                              <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                                focusable
                              </span>
                            )}
                            {spec.accessibility.keyboardNav && spec.accessibility.keyboardNav.length > 0 && (
                              <span className="text-[var(--color-text-tertiary)]">
                                Keys: {spec.accessibility.keyboardNav.join(', ')}
                              </span>
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

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div className="p-4 border-b border-[var(--color-border-default)]">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Recommendations:</p>
            <ul className="space-y-1">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <span className="text-pink-400">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Step */}
        <div className="px-4 py-2 bg-[var(--color-surface-tertiary)] border-t border-[var(--color-border-default)]">
          <p className="text-xs text-[var(--color-text-tertiary)] text-center">
            Next: <span className="text-green-400 font-medium">VAF-FRONTEND</span> will implement components
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FILE OPERATIONS DISPLAY COMPONENT
// =============================================================================

function FileOperationsDisplay({
  data,
  fileStatuses
}: {
  data: FrontendResponse;
  fileStatuses?: Map<string, 'pending' | 'writing' | 'success' | 'error'>;
}) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const statusColors = {
    success: 'bg-green-500/20 text-green-400',
    partial: 'bg-yellow-500/20 text-yellow-400',
    failed: 'bg-red-500/20 text-red-400',
  };

  const opTypeColors = {
    create: 'bg-green-500/20 text-green-400 border-green-500/30',
    edit: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  // Calculate overall progress
  const totalFiles = data.fileOperations.length;
  const completedFiles = fileStatuses
    ? Array.from(fileStatuses.values()).filter(s => s === 'success').length
    : 0;
  const isWriting = fileStatuses
    ? Array.from(fileStatuses.values()).some(s => s === 'writing' || s === 'pending')
    : false;

  // Get status for a file
  const getFileStatus = (path: string) => fileStatuses?.get(path) || 'pending';

  // Status icon component
  const StatusIcon = ({ status }: { status: 'pending' | 'writing' | 'success' | 'error' }) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-gray-500" />;
      case 'writing':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'success':
        return <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px]">&#10003;</div>;
      case 'error':
        return <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[10px]">&#10005;</div>;
    }
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-2">
            <span className="text-lg">&#128421;&#65039;</span>
            <span className="font-semibold text-[var(--color-text-primary)]">VAF-FRONTEND: Code Generated</span>
            {isWriting ? (
              <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Writing {completedFiles}/{totalFiles}
              </span>
            ) : (
              <span className={`ml-auto px-2 py-0.5 text-xs rounded-full ${statusColors[data.status]}`}>
                {data.status === 'success' ? 'Complete' : data.status === 'partial' ? 'Partial' : 'Failed'}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {fileStatuses && totalFiles > 0 && (
          <div className="px-4 py-2 border-b border-[var(--color-border-default)]">
            <div className="h-1.5 bg-[var(--color-surface-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${(completedFiles / totalFiles) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-[var(--color-text-secondary)]">Files: </span>
              <span className="text-green-400 font-medium">{completedFiles}/{totalFiles}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)]">Components: </span>
              <span className="text-blue-400 font-medium">{data.implementedComponents?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* File Operations */}
        <div className="divide-y divide-[var(--color-border-default)]">
          {data.fileOperations.map((op, i) => {
            const isExpanded = expandedFile === op.path;
            const status = getFileStatus(op.path);

            return (
              <div key={i} className="bg-[var(--color-surface-primary)]">
                <button
                  onClick={() => setExpandedFile(isExpanded ? null : op.path)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-surface-secondary)] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon status={status} />
                    <span className={`px-2 py-0.5 text-xs rounded border ${opTypeColors[op.type]}`}>
                      {op.type}
                    </span>
                    <span className="font-mono text-sm text-[var(--color-text-primary)]">{op.path}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-[var(--color-text-secondary)] mb-2">{op.description}</p>
                    <div className="rounded bg-[var(--color-surface-tertiary)] p-3 overflow-x-auto">
                      <pre className="text-xs font-mono text-[var(--color-text-primary)] whitespace-pre-wrap">
                        {op.content.length > 2000 ? op.content.substring(0, 2000) + '\n\n... (truncated)' : op.content}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Errors */}
        {data.errors && data.errors.length > 0 && (
          <div className="p-4 border-t border-[var(--color-border-default)] bg-red-500/5">
            <p className="text-xs font-medium text-red-400 mb-2">Errors:</p>
            <ul className="space-y-1">
              {data.errors.map((err, i) => (
                <li key={i} className="text-xs text-red-300">{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Next Step */}
        <div className="px-4 py-2 bg-[var(--color-surface-tertiary)] border-t border-[var(--color-border-default)]">
          <p className="text-xs text-[var(--color-text-tertiary)] text-center">
            {isWriting ? 'Writing files to project...' : 'Files written. Check File Explorer to view.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Loading Overlay Component
function LoadingOverlay({ projectName }: { projectName?: string }) {
  const { loadingState, loadingMessage, error, retryInit } = useWebContainer();

  if (loadingState === 'ready') return null;

  const getProgressPercentage = (state: LoadingState): number => {
    switch (state) {
      case 'idle': return 0;
      case 'booting': return 20;
      case 'mounting': return 40;
      case 'installing': return 60;
      case 'starting': return 80;
      case 'ready': return 100;
      case 'error': return 0;
      default: return 0;
    }
  };

  const progress = getProgressPercentage(loadingState);

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--color-surface-primary)]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Failed to Initialize
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            {error}
          </p>
          <button
            onClick={retryInit}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-accent-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--color-surface-primary)]">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-accent-primary)]/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[var(--color-accent-primary)] animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          {projectName ? `Setting up "${projectName}"` : 'Setting up your project'}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {loadingMessage}
        </p>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-[var(--color-surface-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent-primary)] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex justify-between mt-4 text-xs text-[var(--color-text-tertiary)]">
          <span className={loadingState === 'booting' ? 'text-[var(--color-accent-primary)]' : ''}>Boot</span>
          <span className={loadingState === 'mounting' ? 'text-[var(--color-accent-primary)]' : ''}>Setup</span>
          <span className={loadingState === 'installing' ? 'text-[var(--color-accent-primary)]' : ''}>Install</span>
          <span className={loadingState === 'starting' ? 'text-[var(--color-accent-primary)]' : ''}>Start</span>
        </div>
      </div>
    </div>
  );
}

type WorkspaceTab = 'preview' | 'code' | 'database' | 'workflow';

// AI Chat Panel Component with VAF-ORCHESTRATOR Integration
function ChatPanel() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m powered by the VAF-ORCHESTRATOR. Send me a request and I\'ll analyze it and determine which specialized agents should handle it.'
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [executedOps, setExecutedOps] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());
  const [fileWriteStatuses, setFileWriteStatuses] = useState<Map<string, 'pending' | 'writing' | 'success' | 'error'>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { webcontainer, triggerFilesystemRefresh } = useWebContainer();

  // Load project summary from WebContainer
  const loadProjectSummary = useCallback(async () => {
    if (!webcontainer) return null;

    try {
      const content = await webcontainer.fs.readFile('docs/project-summary.json', 'utf-8');
      return JSON.parse(content as string);
    } catch {
      console.log('[ChatPanel] No project summary found');
      return null;
    }
  }, [webcontainer]);

  // Parse file operations from content (kept for future use)
  const parseOperations = useCallback((content: string) => {
    const FILE_OP_REGEX = /<<<FILE_OPERATION>>>([\s\S]*?)<<<END_FILE_OPERATION>>>/g;
    const operations: Array<{ type: string; path: string; content?: string; description?: string; edits?: Array<{ oldContent: string; newContent: string }>; reason?: string }> = [];
    let textWithoutOps = content;
    let match;

    FILE_OP_REGEX.lastIndex = 0;
    while ((match = FILE_OP_REGEX.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        operations.push(parsed);
        textWithoutOps = textWithoutOps.replace(match[0], '');
      } catch {
        // Skip malformed JSON
      }
    }

    return { operations, textWithoutOps: textWithoutOps.trim() };
  }, []);

  // Execute a file operation (kept for future use)
  const executeOperation = useCallback(async (op: { type: string; path: string; content?: string; edits?: Array<{ oldContent: string; newContent: string }> }) => {
    if (!webcontainer) return false;

    try {
      if (op.type === 'write' && op.content) {
        // Ensure directory exists
        const dirPath = op.path.substring(0, op.path.lastIndexOf('/'));
        if (dirPath) {
          try {
            await webcontainer.fs.mkdir(dirPath, { recursive: true });
          } catch { /* dir might exist */ }
        }
        await webcontainer.fs.writeFile(op.path, op.content);
        return true;
      } else if (op.type === 'edit' && op.edits) {
        const fileData = await webcontainer.fs.readFile(op.path);
        let fileContent = new TextDecoder().decode(fileData);
        for (const edit of op.edits) {
          if (fileContent.includes(edit.oldContent)) {
            fileContent = fileContent.replace(edit.oldContent, edit.newContent);
          }
        }
        await webcontainer.fs.writeFile(op.path, fileContent);
        return true;
      } else if (op.type === 'delete') {
        await webcontainer.fs.rm(op.path, { recursive: true });
        return true;
      }
    } catch (err) {
      console.error('[ChatPanel] Operation failed:', op.path, err);
    }
    return false;
  }, [webcontainer]);

  // Loading state message
  const [loadingMessage, setLoadingMessage] = useState('');

  // Handle sending message to orchestrator
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const messageId = `msg-${Date.now()}`;
    const workItemId = `WI-${Date.now()}`;

    setInput('');
    setMessages(prev => [...prev, { id: messageId, role: 'user', content: userMessage }]);
    setIsLoading(true);
    setLoadingMessage('Orchestrator analyzing request...');
    setExecutedOps(new Map());

    try {
      // Step 1: Load project summary and extract normalized context
      const projectSummary = await loadProjectSummary();
      const workItemContext = extractWorkItemContext(projectSummary);

      console.log('[ChatPanel] WorkItemContext:', workItemContext);

      // Build conversation history from previous messages
      const conversationHistory = messages
        .filter(msg => msg.role === 'user' || msg.role === 'frontend')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          filesCreated: msg.role === 'frontend' && msg.frontendData
            ? msg.frontendData.fileOperations.map(op => op.path)
            : undefined,
        }));

      // Step 2: Call VAF-ORCHESTRATOR
      const response = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          projectSummary,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Orchestrator failed: ${response.status}`);
      }

      const orchestratorResponse: OrchestratorResponse = await response.json();

      // Quick-fix bypass: Handle dependency installation directly
      if (orchestratorResponse.quickFix?.type === 'install-dependency') {
        const packages = orchestratorResponse.quickFix.packages;
        console.log('[VAF-ORCHESTRATOR] Quick-fix: Installing dependencies:', packages);

        setMessages(prev => [...prev, {
          id: `quickfix-${Date.now()}`,
          role: 'assistant',
          content: `📦 ${orchestratorResponse.quickFix?.message || `Installing: ${packages.join(', ')}`}`,
        }]);

        setLoadingMessage(`Installing ${packages.join(', ')}...`);

        try {
          const installProcess = await webcontainer?.spawn('npm', ['install', ...packages]);
          let installOutput = '';
          installProcess?.output.pipeTo(new WritableStream({
            write(chunk) { installOutput += chunk; }
          }));

          const installExitCode = await installProcess?.exit;

          if (installExitCode === 0) {
            setMessages(prev => [...prev, {
              id: `quickfix-success-${Date.now()}`,
              role: 'assistant',
              content: `✅ Successfully installed: ${packages.join(', ')}. Rebuilding...`,
            }]);

            // Auto-rebuild after successful dependency installation
            setLoadingMessage('Rebuilding project...');
            try {
              const buildProcess = await webcontainer?.spawn('npm', ['run', 'build']);
              let buildOutput = '';
              buildProcess?.output.pipeTo(new WritableStream({
                write(chunk) { buildOutput += chunk; }
              }));

              const buildExitCode = await buildProcess?.exit;

              if (buildExitCode === 0) {
                setMessages(prev => [...prev, {
                  id: `rebuild-success-${Date.now()}`,
                  role: 'assistant',
                  content: `✅ **Build successful!** Your changes are ready.`,
                }]);
              } else {
                // Build still failed - show error details
                const errorLines = buildOutput.split('\n').filter(line =>
                  line.includes('error') || line.includes('Error') ||
                  line.includes('failed') || line.includes('Cannot') ||
                  line.includes('✘') || line.includes('×')
                ).slice(0, 5);
                const errorSummary = errorLines.length > 0
                  ? errorLines.map(l => l.trim()).join('\n')
                  : buildOutput.substring(0, 300);

                setMessages(prev => [...prev, {
                  id: `rebuild-failed-${Date.now()}`,
                  role: 'assistant',
                  content: `⚠️ **Build still has errors:**\n\`\`\`\n${errorSummary}\n\`\`\`\n\nDescribe the error in chat and I'll help fix it.`,
                }]);
              }
            } catch (buildError) {
              console.error('[VAF-ORCHESTRATOR] Auto-rebuild error:', buildError);
              setMessages(prev => [...prev, {
                id: `rebuild-error-${Date.now()}`,
                role: 'assistant',
                content: `⚠️ Rebuild encountered an error. Please try running the build manually.`,
              }]);
            }
          } else {
            setMessages(prev => [...prev, {
              id: `quickfix-error-${Date.now()}`,
              role: 'assistant',
              content: `❌ Failed to install ${packages.join(', ')}. Error: ${installOutput.substring(0, 200)}`,
            }]);
          }
        } catch (installError) {
          console.error('[VAF-ORCHESTRATOR] Quick-fix install error:', installError);
          setMessages(prev => [...prev, {
            id: `quickfix-error-${Date.now()}`,
            role: 'assistant',
            content: `❌ Install failed: ${installError instanceof Error ? installError.message : 'Unknown error'}`,
          }]);
        }

        setIsLoading(false);
        setLoadingMessage('');
        return; // Skip the rest of the pipeline
      }

      // Step 3: Add orchestrator response to messages
      setMessages(prev => [...prev, {
        id: `orchestrator-${Date.now()}`,
        role: 'orchestrator',
        content: orchestratorResponse.analysis.primaryIntent,
        orchestratorData: orchestratorResponse,
      }]);

      // Step 4: Check if PM agent is assigned and execute
      const pmAgent = orchestratorResponse.agents.find(a => a.agentId === 'vaf-pm');
      if (pmAgent) {
        setLoadingMessage('PM creating requirements...');

        // Call PM Agent with normalized context and taskMode
        const pmResponse = await fetch('/api/agents/pm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workItemId,
            userRequest: userMessage,
            workItemContext, // Pass normalized context
            taskMode: orchestratorResponse.analysis.taskMode || 'creation',
            targetFiles: orchestratorResponse.analysis.targetFiles || [],
          }),
        });

        if (!pmResponse.ok) {
          const errorData = await pmResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `PM Agent failed: ${pmResponse.status}`);
        }

        const pmData: PMResponse = await pmResponse.json();

        // Add PM response to messages
        setMessages(prev => [...prev, {
          id: `pm-${Date.now()}`,
          role: 'pm',
          content: `Generated PRD: ${pmData.prd.title}`,
          pmData,
        }]);

        // Step 5: Call Architect Agent with PRD
        if (pmData.status === 'success' && pmData.nextAgent === 'vaf-architect') {
          setLoadingMessage('Architect designing components...');

          const architectResponse = await fetch('/api/agents/architect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workItemId,
              prd: pmData.prd,
              workItemContext, // Pass normalized context with correct file extensions
              taskMode: pmData.taskMode || orchestratorResponse.analysis.taskMode || 'creation',
              targetFiles: pmData.targetFiles || orchestratorResponse.analysis.targetFiles || [],
            }),
          });

          if (!architectResponse.ok) {
            const errorData = await architectResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Architect Agent failed: ${architectResponse.status}`);
          }

          const architectData: ArchitectResponse = await architectResponse.json();

          // Add Architect response to messages
          setMessages(prev => [...prev, {
            id: `architect-${Date.now()}`,
            role: 'architect',
            content: `Architecture: ${architectData.architecture.components.length} components designed`,
            architectData,
          }]);

          // Step 6: Call Designer Agent for design specs
          if (architectData.status === 'success') {
            setLoadingMessage('Designer creating style specs...');

            // Read existing style guide if it exists
            let existingStyleGuide: string | undefined;
            try {
              const styleGuidePath = 'docs/design/style-guide.md';
              existingStyleGuide = await webcontainer?.fs.readFile(styleGuidePath, 'utf-8');
              console.log('[VAF-DESIGNER] Found existing style guide');
            } catch {
              console.log('[VAF-DESIGNER] No existing style guide found');
            }

            const designerResponse = await fetch('/api/agents/designer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                workItemId,
                components: architectData.architecture.components,
                workItemContext,
                existingStyleGuide,
                taskMode: architectData.taskMode || orchestratorResponse.analysis.taskMode || 'creation',
                targetFiles: architectData.targetFiles || orchestratorResponse.analysis.targetFiles || [],
              }),
            });

            if (!designerResponse.ok) {
              const errorData = await designerResponse.json().catch(() => ({}));
              throw new Error(errorData.error || `Designer Agent failed: ${designerResponse.status}`);
            }

            const designerData: DesignerResponse = await designerResponse.json();

            // Add Designer response to messages
            setMessages(prev => [...prev, {
              id: `designer-${Date.now()}`,
              role: 'designer',
              content: `Design specs: ${designerData.componentSpecs.length} components styled`,
              designerData,
            }]);

            // Write style guide to file for persistence
            if (designerData.styleGuide && webcontainer) {
              try {
                await webcontainer.fs.mkdir('docs/design', { recursive: true });

                // Determine styling approach for documentation
                const stylingApproach = workItemContext?.styling?.toLowerCase() || '';
                let styleTokensHeader = 'Style Tokens';
                if (stylingApproach.includes('tailwind')) {
                  styleTokensHeader = 'Tailwind Classes';
                } else if (stylingApproach.includes('css module') || stylingApproach.includes('css-module')) {
                  styleTokensHeader = 'CSS Module Classes';
                } else if (stylingApproach.includes('styled-component') || stylingApproach.includes('emotion')) {
                  styleTokensHeader = 'Styled Components';
                } else if (stylingApproach.includes('sass') || stylingApproach.includes('scss')) {
                  styleTokensHeader = 'SCSS Classes';
                } else if (stylingApproach.includes('css')) {
                  styleTokensHeader = 'CSS Classes';
                }

                // Generate markdown style guide
                const styleGuideContent = `# Project Style Guide
Generated by VAF-DESIGNER

## Design Tokens

${designerData.styleGuide.tokens?.map(t => `### ${t.name}
- **Category**: ${t.category}
- **Value**: \`${t.value}\`
`).join('\n') || 'No tokens defined'}

## Component Specifications

${designerData.componentSpecs.map(spec => `### ${spec.component}
- **Variants**: ${spec.variants.join(', ')}
- **States**: ${spec.states.join(', ')}

#### ${styleTokensHeader}
${Object.entries(spec.tokens).map(([key, value]) => `- \`${key}\`: \`${value}\``).join('\n')}

#### Accessibility
- Role: ${spec.accessibility.role || 'default'}
- Focusable: ${spec.accessibility.focusable}
${spec.accessibility.keyboardNav ? `- Keyboard Navigation: ${spec.accessibility.keyboardNav.join(', ')}` : ''}
`).join('\n---\n\n')}

## Recommendations
${designerData.recommendations?.map(r => `- ${r}`).join('\n') || 'None'}

---
*Last updated: ${new Date().toISOString()}*
`;

                await webcontainer.fs.writeFile('docs/design/style-guide.md', styleGuideContent);
                console.log('[VAF-DESIGNER] Wrote style guide to docs/design/style-guide.md');

                // Update styling config with custom color tokens (only if project uses Tailwind)
                const colorTokens = designerData.styleGuide.tokens?.filter(t => t.category === 'color') || [];
                if (colorTokens.length > 0) {
                  // Check if project uses Tailwind CSS
                  const usesTailwindFromContext = workItemContext?.styling?.toLowerCase().includes('tailwind') || false;
                  let hasTailwindConfig = false;
                  let hasTailwindDep = false;

                  // Check for tailwind.config.js existence
                  try {
                    await webcontainer.fs.readFile('tailwind.config.js', 'utf-8');
                    hasTailwindConfig = true;
                  } catch {
                    // Config doesn't exist
                  }

                  // Check package.json for tailwindcss dependency
                  if (!hasTailwindConfig) {
                    try {
                      const pkgData = await webcontainer.fs.readFile('package.json', 'utf-8');
                      const pkgContent = typeof pkgData === 'string' ? pkgData : new TextDecoder().decode(pkgData);
                      hasTailwindDep = pkgContent.includes('"tailwindcss"') || pkgContent.includes("'tailwindcss'");
                    } catch {
                      // No package.json
                    }
                  }

                  const projectUsesTailwind = usesTailwindFromContext || hasTailwindConfig || hasTailwindDep;
                  console.log('[VAF-DESIGNER] Tailwind detection:', { usesTailwindFromContext, hasTailwindConfig, hasTailwindDep, projectUsesTailwind });

                  if (!projectUsesTailwind) {
                    // Project doesn't use Tailwind - create CSS custom properties instead
                    console.log('[VAF-DESIGNER] Project does not use Tailwind - creating CSS variables');
                    try {
                      const customColors: Record<string, string> = {};
                      for (const token of colorTokens) {
                        const colorName = token.name.replace(/^(bg-|text-)/, '');
                        if (token.value.startsWith('#') || token.value.startsWith('rgb')) {
                          customColors[colorName] = token.value;
                        }
                      }

                      if (Object.keys(customColors).length > 0) {
                        const cssVariables = `:root {\n${Object.entries(customColors)
                          .map(([name, value]) => `  --color-${name}: ${value};`)
                          .join('\n')}\n}\n`;

                        await webcontainer.fs.mkdir('src/styles', { recursive: true });
                        await webcontainer.fs.writeFile('src/styles/variables.css', cssVariables);
                        console.log('[VAF-DESIGNER] Created CSS variables:', Object.keys(customColors));
                      }
                    } catch (cssError) {
                      console.error('[VAF-DESIGNER] Failed to create CSS variables:', cssError);
                    }
                  } else {
                    // Project uses Tailwind - update tailwind.config.js
                    try {
                      let tailwindConfig = '';
                      try {
                        const configData = await webcontainer.fs.readFile('tailwind.config.js', 'utf-8');
                        tailwindConfig = typeof configData === 'string' ? configData : new TextDecoder().decode(configData);
                      } catch {
                        // Only create config if Tailwind dependency exists
                        if (hasTailwindDep) {
                          tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
                        } else {
                          console.log('[VAF-DESIGNER] No tailwind.config.js and no tailwindcss dep - skipping');
                          return;
                        }
                      }

                      // Build custom colors object from designer tokens
                      const customColors: Record<string, string> = {};
                      for (const token of colorTokens) {
                        // Token name like "space-dark" with value "#121212" or "bg-blue-500"
                        const colorName = token.name.replace(/^(bg-|text-)/, ''); // Remove Tailwind prefixes if present
                        // If value is a hex color, use it directly; otherwise it's a Tailwind class reference
                        if (token.value.startsWith('#') || token.value.startsWith('rgb')) {
                          customColors[colorName] = token.value;
                        }
                      }

                      if (Object.keys(customColors).length > 0) {
                        // Check if config already has extend.colors
                        if (tailwindConfig.includes('extend:')) {
                          if (tailwindConfig.includes('colors:')) {
                            // Merge with existing colors - find colors object and add to it
                            const colorsMatch = tailwindConfig.match(/colors:\s*\{([^}]*)\}/);
                            if (colorsMatch) {
                              const existingColors = colorsMatch[1];
                              const newColorsStr = Object.entries(customColors)
                                .map(([name, value]) => `'${name}': '${value}'`)
                                .join(',\n        ');
                              const updatedColors = existingColors.trim()
                                ? `${existingColors.trim()},\n        ${newColorsStr}`
                                : newColorsStr;
                              tailwindConfig = tailwindConfig.replace(
                                /colors:\s*\{[^}]*\}/,
                                `colors: {\n        ${updatedColors}\n      }`
                              );
                            }
                          } else {
                            // Add colors to extend
                            const newColorsStr = Object.entries(customColors)
                              .map(([name, value]) => `'${name}': '${value}'`)
                              .join(',\n        ');
                            tailwindConfig = tailwindConfig.replace(
                              /extend:\s*\{/,
                              `extend: {\n      colors: {\n        ${newColorsStr}\n      },`
                            );
                          }
                        } else {
                          // Add extend with colors
                          const newColorsStr = Object.entries(customColors)
                            .map(([name, value]) => `'${name}': '${value}'`)
                            .join(',\n        ');
                          tailwindConfig = tailwindConfig.replace(
                            /theme:\s*\{/,
                            `theme: {\n    extend: {\n      colors: {\n        ${newColorsStr}\n      }\n    },`
                          );
                        }

                        await webcontainer.fs.writeFile('tailwind.config.js', tailwindConfig);
                        console.log('[VAF-DESIGNER] Updated tailwind.config.js with custom colors:', Object.keys(customColors));
                      }
                    } catch (tailwindError) {
                      console.error('[VAF-DESIGNER] Failed to update tailwind.config.js:', tailwindError);
                    }
                  }
                }
              } catch (styleGuideError) {
                console.error('[VAF-DESIGNER] Failed to write style guide:', styleGuideError);
              }
            }

            // Step 7: Call Frontend Agent to generate code
            if (designerData.status === 'success') {
              setLoadingMessage('Frontend generating code...');

              // Get effective taskMode from architect response
              const effectiveTaskMode = architectData.taskMode || orchestratorResponse.analysis.taskMode || 'creation';
              const effectiveTargetFiles = architectData.targetFiles || orchestratorResponse.analysis.targetFiles || [];

              // Read existing file contents for modification OR when any component needs editing
              let existingFileContents: Array<{ path: string; content: string }> = [];

              // Check if any component has operationType 'edit'
              const hasEditOperations = architectData.architecture.components?.some(
                (c: ComponentSpec) => c.operationType === 'edit'
              );

              // Collect all file paths that need to be read
              const filesToRead = new Set<string>();

              // Add targetFiles
              effectiveTargetFiles.forEach((f: string) => filesToRead.add(f));

              // Add paths of components with operationType 'edit'
              architectData.architecture.components?.forEach((c: ComponentSpec) => {
                if (c.operationType === 'edit' && c.path) {
                  filesToRead.add(c.path);
                }
              });

              // Read files if in modification mode OR if there are edit operations
              if ((effectiveTaskMode === 'modification' || hasEditOperations || filesToRead.size > 0) && webcontainer) {
                setLoadingMessage('Reading existing files...');
                for (const filePath of filesToRead) {
                  try {
                    const fileData = await webcontainer.fs.readFile(filePath);
                    const content = new TextDecoder().decode(fileData);
                    existingFileContents.push({ path: filePath, content });
                    console.log(`[VAF-FRONTEND] Read existing file: ${filePath} (${content.length} chars)`);
                  } catch (readError) {
                    console.warn(`[VAF-FRONTEND] Could not read file ${filePath}:`, readError);
                  }
                }
                setLoadingMessage('Frontend generating edits...');
              }

              const frontendResponse = await fetch('/api/agents/frontend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  workItemId,
                  architecture: architectData.architecture,
                  designSpecs: designerData.componentSpecs,
                  workItemContext,
                  taskMode: effectiveTaskMode,
                  targetFiles: effectiveTargetFiles,
                  existingFileContents: existingFileContents.length > 0 ? existingFileContents : undefined,
                }),
              });

              if (!frontendResponse.ok) {
                const errorData = await frontendResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `Frontend Agent failed: ${frontendResponse.status}`);
              }

              const frontendData: FrontendResponse = await frontendResponse.json();

              // Initialize file statuses as pending
              const initialStatuses = new Map<string, 'pending' | 'writing' | 'success' | 'error'>();
              frontendData.fileOperations.forEach(op => {
                initialStatuses.set(op.path, 'pending');
              });
              setFileWriteStatuses(initialStatuses);

              // Add Frontend response to messages IMMEDIATELY (shows pending files)
              setMessages(prev => [...prev, {
                id: `frontend-${Date.now()}`,
                role: 'frontend',
                content: `Generating ${frontendData.fileOperations.length} files...`,
                frontendData,
              }]);

              // Step 8: Execute file operations with real-time status updates
              if (frontendData.fileOperations.length > 0) {
                setLoadingMessage('Writing files to project...');

                // Process files one by one with visible updates
                for (let i = 0; i < frontendData.fileOperations.length; i++) {
                  const op = frontendData.fileOperations[i];

                  if (op.type === 'create' || op.type === 'edit') {
                    // Mark as writing and wait for React to render
                    setFileWriteStatuses(prev => {
                      const newMap = new Map(prev);
                      newMap.set(op.path, 'writing');
                      return newMap;
                    });

                    // Wait for state to update and render
                    await new Promise(resolve => setTimeout(resolve, 300));

                    try {
                      // Ensure directory exists
                      const dirPath = op.path.substring(0, op.path.lastIndexOf('/'));
                      if (dirPath && webcontainer) {
                        await webcontainer.fs.mkdir(dirPath, { recursive: true });
                      }
                      // Write the file (create) or apply edits (edit)
                      if (webcontainer) {
                        if (op.type === 'edit' && op.edits && op.edits.length > 0) {
                          // For edit operations, read existing file and apply edits
                          try {
                            const existingData = await webcontainer.fs.readFile(op.path);
                            let fileContent = new TextDecoder().decode(existingData);
                            let editSuccessCount = 0;
                            let editFailCount = 0;

                            for (const edit of op.edits) {
                              if (fileContent.includes(edit.oldContent)) {
                                fileContent = fileContent.replace(edit.oldContent, edit.newContent);
                                editSuccessCount++;
                              } else {
                                editFailCount++;
                                console.warn(`[VAF-FRONTEND] Edit pattern not found in ${op.path}:`, edit.oldContent.substring(0, 100));
                                // Add to chat as warning
                                setMessages(prev => {
                                  const lastMsg = prev[prev.length - 1];
                                  if (lastMsg?.role === 'frontend') {
                                    return prev; // Don't spam warnings
                                  }
                                  return prev;
                                });
                              }
                            }

                            if (editFailCount > 0) {
                              console.warn(`[VAF-FRONTEND] ${editFailCount}/${op.edits.length} edits failed for ${op.path} - patterns not found in file`);
                            }

                            await webcontainer.fs.writeFile(op.path, fileContent);
                            console.log(`[VAF-FRONTEND] Applied ${editSuccessCount}/${op.edits.length} edits to ${op.path}`);
                          } catch (readError) {
                            console.error(`[VAF-FRONTEND] Could not read file for editing ${op.path}:`, readError);
                            // Fallback: write content directly if file doesn't exist
                            if (op.content) {
                              await webcontainer.fs.writeFile(op.path, op.content);
                              console.log(`[VAF-FRONTEND] Created file ${op.path} (edit target didn't exist)`);
                            }
                          }
                        } else {
                          // For create operations, write content directly
                          await webcontainer.fs.writeFile(op.path, op.content);
                        }
                      }
                      console.log(`[VAF-FRONTEND] Wrote file: ${op.path}`);

                      // Mark as success
                      setFileWriteStatuses(prev => {
                        const newMap = new Map(prev);
                        newMap.set(op.path, 'success');
                        return newMap;
                      });
                    } catch (writeError) {
                      console.error(`[VAF-FRONTEND] Failed to write ${op.path}:`, writeError);
                      // Mark as error
                      setFileWriteStatuses(prev => {
                        const newMap = new Map(prev);
                        newMap.set(op.path, 'error');
                        return newMap;
                      });
                    }

                    // Wait between files for visual feedback
                    await new Promise(resolve => setTimeout(resolve, 200));
                  }
                }

                // POST-PROCESSING: Ensure CSS variables are imported in main entry file
                const cssVariablesFile = frontendData.fileOperations.find(op =>
                  op.path.includes('variables.css') || op.path.includes('globals.css')
                );

                if (cssVariablesFile && webcontainer) {
                  // Check if main.jsx or main.tsx exists and add import if missing
                  const mainFiles = ['src/main.jsx', 'src/main.tsx', 'src/index.jsx', 'src/index.tsx'];

                  for (const mainFile of mainFiles) {
                    try {
                      const mainContent = await webcontainer.fs.readFile(mainFile, 'utf-8');
                      const cssImportPath = cssVariablesFile.path.replace('src/', './');
                      const importStatement = `import '${cssImportPath}';`;

                      // Check if import already exists
                      if (!mainContent.includes(cssVariablesFile.path) && !mainContent.includes(cssImportPath)) {
                        // Add import after the first line (usually React import)
                        const lines = mainContent.split('\n');
                        const insertIndex = lines.findIndex(line => line.trim().startsWith('import')) + 1;
                        lines.splice(Math.max(1, insertIndex), 0, importStatement);
                        await webcontainer.fs.writeFile(mainFile, lines.join('\n'));
                        console.log(`[VAF-FRONTEND] Added CSS variables import to ${mainFile}`);
                      }
                      break; // Found and processed main file
                    } catch {
                      // Main file doesn't exist at this path, try next
                      continue;
                    }
                  }
                }

                // Trigger file explorer refresh
                triggerFilesystemRefresh();

                // Update project summary with new files
                try {
                  const summaryPath = 'docs/project-summary.json';
                  let currentSummary: ProjectSummaryWithHashes | null = null;

                  try {
                    const summaryContent = await webcontainer?.fs.readFile(summaryPath, 'utf-8');
                    if (summaryContent) {
                      currentSummary = JSON.parse(summaryContent);
                    }
                  } catch {
                    // Summary doesn't exist yet, create new one
                    currentSummary = {
                      name: 'Generated Project',
                      description: 'Auto-generated project',
                      generatedAt: new Date().toISOString(),
                      files: [],
                      technology: {
                        framework: workItemContext.framework,
                        language: workItemContext.language,
                        styling: [],
                        stateManagement: [],
                        testing: [],
                      },
                      structure: {
                        hasTests: false,
                        hasDocs: false,
                        hasConfig: true,
                      },
                      architecture: {
                        pattern: 'component-based',
                        entryPoints: ['src/main.jsx'],
                        keyModules: [],
                      },
                      insights: {
                        strengths: [],
                        suggestions: [],
                      },
                    } as unknown as ProjectSummaryWithHashes;
                  }

                  if (currentSummary) {
                    // Add new files to the summary
                    const existingPaths = new Set(currentSummary.files?.map(f => f.path) || []);

                    for (const op of frontendData.fileOperations) {
                      if (!existingPaths.has(op.path)) {
                        const fileCategory = op.path.includes('/components/') ? 'component' :
                                            op.path.includes('/hooks/') ? 'hook' :
                                            op.path.includes('/pages/') ? 'page' :
                                            op.path.includes('/lib/') ? 'utility' : 'other';

                        currentSummary.files = currentSummary.files || [];
                        currentSummary.files.push({
                          path: op.path,
                          type: 'file',
                          purpose: op.description,
                          category: fileCategory,
                        });
                      }
                    }

                    // Write updated summary
                    await webcontainer?.fs.mkdir('docs', { recursive: true });
                    await webcontainer?.fs.writeFile(summaryPath, JSON.stringify(currentSummary, null, 2));
                    console.log('[VAF-FRONTEND] Updated project summary with new files');
                  }
                } catch (summaryError) {
                  console.error('[VAF-FRONTEND] Failed to update project summary:', summaryError);
                }

                // Step 9: Build validation and AI-powered auto-fix loop
                setLoadingMessage('Validating build...');

                let buildSuccess = false;
                let retryCount = 0;
                const maxRetries = 3;
                let lastBuildErrors = '';

                while (!buildSuccess && retryCount < maxRetries) {
                  try {
                    const buildProcess = await webcontainer?.spawn('npm', ['run', 'build']);
                    let buildOutput = '';

                    buildProcess?.output.pipeTo(new WritableStream({
                      write(chunk) {
                        buildOutput += chunk;
                      }
                    }));

                    const exitCode = await buildProcess?.exit;

                    if (exitCode === 0) {
                      buildSuccess = true;
                      console.log('[VAF-FRONTEND] Build succeeded!');
                      setMessages(prev => prev.map(msg =>
                        msg.role === 'frontend' && msg.frontendData
                          ? { ...msg, content: `Generated ${frontendData.fileOperations.length} files - Build successful!` }
                          : msg
                      ));
                    } else {
                      retryCount++;
                      lastBuildErrors = buildOutput;
                      console.log(`[VAF-FRONTEND] Build failed (attempt ${retryCount}/${maxRetries}):`, buildOutput.substring(0, 500));

                      if (retryCount <= maxRetries) {
                        // Use AI-powered error analysis via Architect agent
                        setLoadingMessage('Analyzing build errors with AI...');

                        setMessages(prev => [...prev, {
                          id: `error-analysis-${Date.now()}`,
                          role: 'assistant',
                          content: `🔍 **Build failed** - Analyzing errors with AI...`
                        }]);

                        try {
                          const analysisResponse = await fetch('/api/agents/architect/analyze-errors', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              workItemId,
                              buildErrors: buildOutput,
                              affectedFiles: frontendData.fileOperations.map(op => op.path),
                            }),
                          });

                          if (!analysisResponse.ok) {
                            throw new Error('Error analysis failed');
                          }

                          const analysis: ErrorAnalysisResponse = await analysisResponse.json();
                          console.log('[VAF-FRONTEND] Error analysis:', analysis);

                          // Update message with analysis results
                          setMessages(prev => prev.map(msg =>
                            msg.id?.startsWith('error-analysis-')
                              ? {
                                  ...msg,
                                  content: `🔍 **Error Analysis (attempt ${retryCount}/${maxRetries}):**\n\n**Root Cause:** ${analysis.rootCause}\n\n**Affected Files:** ${analysis.allAffectedFiles?.join(', ') || 'Unknown'}\n\n**Fix Plan:** ${analysis.fixOrder?.join(' → ') || 'Analyzing...'}`
                                }
                              : msg
                          ));

                          // Process fixes based on analysis
                          for (const fix of analysis.fixes || []) {
                            if (fix.type === 'install-dependency') {
                              // Dependency fix - install packages
                              console.log('[VAF-FRONTEND] Installing packages:', fix.packages);
                              setLoadingMessage(`Installing ${fix.packages.join(', ')}...`);

                              setMessages(prev => [...prev, {
                                id: `dep-install-${Date.now()}`,
                                role: 'assistant',
                                content: `📦 Installing: ${fix.packages.join(', ')}\n*Reason: ${fix.reason}*`
                              }]);

                              const installProcess = await webcontainer?.spawn('npm', ['install', ...fix.packages]);
                              let installOutput = '';
                              installProcess?.output.pipeTo(new WritableStream({
                                write(chunk) { installOutput += chunk; }
                              }));

                              const installExitCode = await installProcess?.exit;

                              if (installExitCode === 0) {
                                setMessages(prev => prev.map(msg =>
                                  msg.id?.startsWith('dep-install-')
                                    ? { ...msg, content: `✅ Installed: ${fix.packages.join(', ')}` }
                                    : msg
                                ));
                                retryCount--; // Don't count dependency install as a code fix retry
                              } else {
                                setMessages(prev => prev.map(msg =>
                                  msg.id?.startsWith('dep-install-')
                                    ? { ...msg, content: `❌ Failed to install: ${fix.packages.join(', ')}\n\`\`\`\n${installOutput.substring(0, 200)}\n\`\`\`` }
                                    : msg
                                ));
                              }
                            } else if (fix.type === 'code-fix') {
                              // Code fix - call frontend agent with specific guidance from Architect
                              console.log('[VAF-FRONTEND] Applying code fix to:', fix.file);
                              setLoadingMessage(`Fixing ${fix.file}...`);

                              setMessages(prev => [...prev, {
                                id: `code-fix-${Date.now()}`,
                                role: 'assistant',
                                content: `🔧 **Fixing ${fix.file}:**\n*Issue:* ${fix.issue}\n*Fix:* ${fix.suggestedFix}`
                              }]);

                              // Call frontend agent with specific fix instructions from Architect
                              // IMPORTANT: Preserve taskMode and targetFiles for error recovery
                              const fixResponse = await fetch('/api/agents/frontend', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  workItemId,
                                  architecture: architectData.architecture,
                                  designSpecs: designerData.componentSpecs,
                                  workItemContext,
                                  taskMode: effectiveTaskMode,  // Preserve task mode during error recovery
                                  targetFiles: effectiveTargetFiles,  // Preserve target files during error recovery
                                  fixErrors: {
                                    errors: `File: ${fix.file}\nIssue: ${fix.issue}\nSuggested Fix: ${fix.suggestedFix}\n\nFull error output:\n${buildOutput}`,
                                    previousFiles: frontendData.fileOperations,
                                  },
                                }),
                              });

                              if (fixResponse.ok) {
                                const fixData: FrontendResponse = await fixResponse.json();
                                const fixedFiles: string[] = [];

                                for (const op of fixData.fileOperations) {
                                  if (op.type === 'create' && op.content) {
                                    setFileWriteStatuses(prev => new Map(prev).set(op.path, 'writing'));
                                    try {
                                      const dirPath = op.path.substring(0, op.path.lastIndexOf('/'));
                                      if (dirPath) {
                                        await webcontainer?.fs.mkdir(dirPath, { recursive: true });
                                      }
                                      await webcontainer?.fs.writeFile(op.path, op.content);
                                      setFileWriteStatuses(prev => new Map(prev).set(op.path, 'success'));
                                      fixedFiles.push(op.path);
                                    } catch {
                                      setFileWriteStatuses(prev => new Map(prev).set(op.path, 'error'));
                                    }
                                  } else if (op.type === 'edit' && op.edits) {
                                    let currentContent = '';
                                    try {
                                      currentContent = await webcontainer?.fs.readFile(op.path, 'utf-8') || '';
                                    } catch { currentContent = ''; }

                                    let newContent = currentContent;
                                    for (const edit of op.edits) {
                                      if (newContent.includes(edit.oldContent)) {
                                        newContent = newContent.replace(edit.oldContent, edit.newContent);
                                      }
                                    }

                                    if (newContent !== currentContent) {
                                      await webcontainer?.fs.writeFile(op.path, newContent);
                                      fixedFiles.push(op.path);
                                    }
                                  }
                                }

                                triggerFilesystemRefresh();

                                if (fixedFiles.length > 0) {
                                  setMessages(prev => prev.map(msg =>
                                    msg.id?.startsWith('code-fix-')
                                      ? { ...msg, content: `✅ **Fixed ${fixedFiles.length} file(s):**\n${fixedFiles.map(f => `• ${f}`).join('\n')}` }
                                      : msg
                                  ));
                                }
                              }
                            }
                          }

                          // If analysis says unfixable, break out
                          if (analysis.status === 'unfixable') {
                            console.log('[VAF-FRONTEND] Error marked as unfixable by Architect');
                            break;
                          }

                        } catch (analysisError) {
                          console.error('[VAF-FRONTEND] Error analysis failed:', analysisError);
                          setMessages(prev => prev.map(msg =>
                            msg.id?.startsWith('error-analysis-')
                              ? { ...msg, content: `⚠️ Error analysis failed: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}` }
                              : msg
                          ));
                        }
                      }
                    }
                  } catch (buildError) {
                    console.error('[VAF-FRONTEND] Build process error:', buildError);
                    retryCount++;
                  }
                }

                // Final status message
                if (!buildSuccess) {
                  const errorLines = lastBuildErrors.split('\n').filter(line =>
                    line.includes('error') || line.includes('Error') ||
                    line.includes('failed') || line.includes('Failed') ||
                    line.includes('Cannot') || line.includes('✘')
                  ).slice(0, 5);
                  const finalErrorSummary = errorLines.length > 0
                    ? errorLines.map(l => l.trim()).join('\n')
                    : lastBuildErrors.substring(0, 300);

                  setMessages(prev => [...prev, {
                    id: `build-failed-${Date.now()}`,
                    role: 'assistant',
                    content: `❌ **Build failed after ${maxRetries} attempts**\n\n**Errors:**\n\`\`\`\n${finalErrorSummary}\n\`\`\`\n\n**Suggestions:**\n• Paste the full error in chat for more help\n• Check the terminal for complete error details\n• The error may require manual investigation`
                  }]);
                }
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Pipeline error:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure you've run "Analyze Project" first in the Workflow tab.`
      }]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [input, isLoading, loadProjectSummary]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Render message content with file operations
  const renderContent = (content: string, showOperations: boolean = true) => {
    const { operations, textWithoutOps } = parseOperations(content);

    return (
      <>
        {textWithoutOps && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2">{textWithoutOps}</p>
        )}
        {showOperations && operations.length > 0 && (
          <div className="space-y-2 mt-2">
            {operations.map((op, i) => (
              <FileOperationCard key={`${op.path}-${i}`} operation={op} status={executedOps.get(op.path) || 'success'} />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-primary)]">
      {/* Chat Header */}
      <div className="h-14 border-b border-[var(--color-border-default)] flex items-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-[var(--color-text-primary)]">VAF-ORCHESTRATOR</span>
        </div>
      </div>

      {/* Messages Area */}
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
            ) : msg.role === 'pm' && msg.pmData ? (
              <PRDDisplay data={msg.pmData} />
            ) : msg.role === 'architect' && msg.architectData ? (
              <ArchitectureDisplay data={msg.architectData} />
            ) : msg.role === 'designer' && msg.designerData ? (
              <DesignerOutput data={msg.designerData} />
            ) : msg.role === 'frontend' && msg.frontendData ? (
              <FileOperationsDisplay data={msg.frontendData} fileStatuses={fileWriteStatuses} />
            ) : (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl px-4 py-3 bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)]">
                  {renderContent(msg.content)}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-3 bg-[var(--color-surface-secondary)] border border-purple-500/30">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-sm text-purple-400">{loadingMessage || 'Processing...'}</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--color-border-default)]">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe what you want to build..."
            rows={3}
            disabled={isLoading}
            className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] text-sm px-4 py-3 pr-12 rounded-xl border border-[var(--color-border-default)] focus:border-purple-500 focus:outline-none resize-none placeholder-[var(--color-text-tertiary)] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// File Operation Card Component (inline for simplicity)
function FileOperationCard({ operation, status }: {
  operation: { type: string; path: string; content?: string; description?: string };
  status: 'pending' | 'success' | 'error';
}) {
  const [expanded, setExpanded] = useState(false);

  const icons: Record<string, { icon: string; color: string; bg: string }> = {
    write: { icon: '📄', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    edit: { icon: '✏️', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    delete: { icon: '🗑️', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  };

  const style = icons[operation.type] || icons.write;

  return (
    <div className={`rounded-lg border ${style.bg} overflow-hidden`}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-black/5"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{style.icon}</span>
        <span className={`text-xs font-medium ${style.color}`}>
          {operation.type === 'write' ? 'Creating' : operation.type === 'edit' ? 'Editing' : 'Deleting'}
        </span>
        <span className="text-xs font-mono text-[var(--color-text-secondary)] truncate flex-1">
          {operation.path}
        </span>
        {status === 'pending' && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
        {status === 'success' && <span className="text-green-400">✓</span>}
        {status === 'error' && <span className="text-red-400">✗</span>}
      </div>
      {expanded && operation.content && (
        <pre className="p-2 bg-[#1e1e1e] text-xs font-mono text-[#d4d4d4] overflow-x-auto max-h-48">
          {operation.content.substring(0, 500)}{operation.content.length > 500 ? '...' : ''}
        </pre>
      )}
    </div>
  );
}

// Code View Component
function CodeView({
  openFiles,
  activeFile,
  onFileSelect,
  onTabClick,
  onTabClose,
  onContentChange
}: {
  openFiles: OpenFile[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onContentChange: (path: string) => void;
}) {
  return (
    <div className="h-full flex">
      {/* File Explorer */}
      <div className="w-56 h-full flex flex-col border-r border-[var(--color-border-default)] bg-[var(--color-surface-primary)]">
        <div className="h-10 border-b border-[var(--color-border-default)] flex items-center px-3">
          <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">Files</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <FileExplorer onFileSelect={onFileSelect} selectedFile={activeFile} />
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 h-full flex flex-col bg-[var(--color-surface-secondary)]">
        <div className="h-10 border-b border-[var(--color-border-default)] flex items-center px-2 bg-[var(--color-surface-primary)]">
          <EditorTabs
            files={openFiles}
            activeFile={activeFile}
            onTabClick={onTabClick}
            onTabClose={onTabClose}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <MonacoEditorWrapper
            filePath={activeFile}
            onContentChange={onContentChange}
          />
        </div>
      </div>
    </div>
  );
}

// Database Placeholder
function DatabaseView() {
  return (
    <div className="h-full flex items-center justify-center bg-[var(--color-surface-primary)]">
      <div className="text-center">
        <Database className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-tertiary)]" />
        <h3 className="text-lg font-medium text-[var(--color-text-secondary)] mb-2">Database</h3>
        <p className="text-sm text-[var(--color-text-tertiary)]">Connect to Supabase or other databases</p>
      </div>
    </div>
  );
}

interface IDELayoutInnerProps {
  template?: string;
  projectName?: string;
}

function IDELayoutInner({ template, projectName }: IDELayoutInnerProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('preview');
  const { loadingState } = useWebContainer();

  // Log template info
  React.useEffect(() => {
    if (template) {
      console.log(`[IDELayout] Initializing with template: ${template}, project: ${projectName}`);
    }
  }, [template, projectName]);

  const handleFileSelect = useCallback((path: string) => {
    if (!openFiles.find(f => f.path === path)) {
      const name = path.split('/').pop() || path;
      setOpenFiles(prev => [...prev, { path, name }]);
    }
    setActiveFile(path);
    setActiveTab('code'); // Switch to code view when selecting a file
  }, [openFiles]);

  const handleTabClick = useCallback((path: string) => {
    setActiveFile(path);
  }, []);

  const handleTabClose = useCallback((path: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== path));
    if (activeFile === path) {
      const remaining = openFiles.filter(f => f.path !== path);
      setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  }, [activeFile, openFiles]);

  const handleContentChange = useCallback((path: string) => {
    setOpenFiles(prev => prev.map(f =>
      f.path === path ? { ...f, isDirty: true } : f
    ));
  }, []);

  const renderWorkspaceContent = () => {
    switch (activeTab) {
      case 'preview':
        return <PreviewPanel />;
      case 'code':
        return (
          <CodeView
            openFiles={openFiles}
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onContentChange={handleContentChange}
          />
        );
      case 'database':
        return <DatabaseView />;
      case 'workflow':
        return <WorkflowTab />;
      default:
        return null;
    }
  };

  // Don't render IDE panels while loading - show only the loading overlay
  if (loadingState !== 'ready') {
    return <LoadingOverlay projectName={projectName} />;
  }

  return (
    <div className="h-screen w-screen flex bg-[var(--color-surface-primary)] overflow-hidden">
      {/* LEFT: Chat Panel */}
      <div className="w-[380px] h-full flex-shrink-0 border-r border-[var(--color-border-default)]">
        <ChatPanel />
      </div>

      {/* RIGHT: Workspace */}
      <div className="flex-1 h-full flex flex-col">
        {/* Tab Bar */}
        <div className="h-12 bg-[var(--color-surface-primary)] border-b border-[var(--color-border-default)] flex items-center px-2">
          <div className="flex">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'preview'
                  ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/50'
              }`}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'code'
                  ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/50'
              }`}
            >
              <Code className="w-4 h-4" />
              Code
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'database'
                  ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/50'
              }`}
            >
              <Database className="w-4 h-4" />
              Database
            </button>
            <button
              onClick={() => setActiveTab('workflow')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'workflow'
                  ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/50'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Workflow
            </button>
          </div>
        </div>

        {/* Workspace Content + Terminal */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <PanelGroup orientation="vertical" style={{ height: '100%' }}>
            {/* Content Area */}
            <Panel defaultSize={70} minSize={30}>
              <div className="h-full">
                {renderWorkspaceContent()}
              </div>
            </Panel>

            <PanelResizeHandle className="h-1 bg-[var(--color-border-default)] hover:bg-[var(--color-accent-primary)] transition-colors cursor-row-resize" />

            {/* Terminal - Always Visible */}
            <Panel defaultSize={30} minSize={15}>
              <div className="h-full flex flex-col bg-[var(--color-surface-primary)]">
                {/* Terminal Header */}
                <div className="h-9 border-b border-[var(--color-border-default)] flex items-center px-3 bg-[var(--color-surface-secondary)]">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                    <span className="text-xs font-medium text-[var(--color-text-tertiary)]">Terminal</span>
                  </div>
                </div>
                {/* Terminal Content */}
                <div className="flex-1 overflow-hidden">
                  <TerminalPanel />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Status Bar */}
        <StatusBar activeFile={activeFile} />
      </div>
    </div>
  );
}

interface IDELayoutProps {
  template?: string;
  projectName?: string;
}

export function IDELayout({ template = 'blank', projectName }: IDELayoutProps) {
  return (
    <WebContainerProvider template={template}>
      <IDELayoutInner template={template} projectName={projectName} />
    </WebContainerProvider>
  );
}
