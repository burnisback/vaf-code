'use client';

import React, { useState, useCallback } from 'react';
import { FileExplorer } from './FileExplorer';
import { EditorTabs, OpenFile } from './EditorTabs';
import { MonacoEditorWrapper } from './MonacoEditorWrapper';
import { PreviewPanel } from './PreviewPanel';
import { TerminalPanel } from './TerminalPanel';
import { StatusBar } from './StatusBar';
import { WebContainerProvider, useWebContainer, LoadingState } from '@/lib/webcontainer/context';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import {
  Sparkles,
  Send,
  Eye,
  Code,
  Database,
  Terminal,
  RefreshCw,
  AlertCircle,
  Loader2
} from 'lucide-react';

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
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--color-surface-primary)]">
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--color-surface-primary)]">
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

type WorkspaceTab = 'preview' | 'code' | 'database';

// AI Chat Panel Component
function ChatPanel() {
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([
    { role: 'assistant', content: 'What would you like to build today?' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ll help you build that. Let me start by setting up the project structure...'
      }]);
    }, 500);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-primary)]">
      {/* Chat Header */}
      <div className="h-14 border-b border-[var(--color-border-default)] flex items-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent-primary)] to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-[var(--color-text-primary)]">VAF Code</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-[var(--color-accent-primary)] text-white'
                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)]'
            }`}>
              <p className="text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
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
            placeholder="How can I help you today?"
            rows={3}
            className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] text-sm px-4 py-3 pr-12 rounded-xl border border-[var(--color-border-default)] focus:border-[var(--color-accent-primary)] focus:outline-none resize-none placeholder-[var(--color-text-tertiary)]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="absolute right-3 bottom-3 p-2 bg-[var(--color-accent-primary)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
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
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[var(--color-surface-primary)] overflow-hidden relative">
      {/* Loading Overlay */}
      <LoadingOverlay projectName={projectName} />

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
