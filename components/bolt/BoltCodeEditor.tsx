'use client';

/**
 * BoltCodeEditor
 *
 * Professional Monaco editor with bolt.new styling.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import Editor, { OnMount, BeforeMount, OnChange } from '@monaco-editor/react';
import { useBoltWebContainer } from '@/lib/bolt/webcontainer/context';
import { Loader2, X } from 'lucide-react';
import type { BoltOpenFile } from '@/lib/bolt/types';

// =============================================================================
// THEME
// =============================================================================

const BOLT_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c084fc' },
    { token: 'string', foreground: '34d399' },
    { token: 'number', foreground: 'f472b6' },
    { token: 'type', foreground: '60a5fa' },
  ],
  colors: {
    'editor.background': '#0a0a0a',
    'editor.foreground': '#e4e4e7',
    'editorLineNumber.foreground': '#52525b',
    'editorLineNumber.activeForeground': '#a1a1aa',
    'editor.selectionBackground': '#8b5cf640',
    'editor.lineHighlightBackground': '#18181b',
    'editorCursor.foreground': '#a78bfa',
    'editor.inactiveSelectionBackground': '#8b5cf620',
  },
};

// =============================================================================
// LANGUAGE DETECTION
// =============================================================================

const LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  html: 'html',
  md: 'markdown',
  svg: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
};

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return LANGUAGES[ext] || 'plaintext';
}

// =============================================================================
// DEBOUNCE HOOK
// =============================================================================

function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
    }) as T,
    [delay]
  );
}

// =============================================================================
// EDITOR TAB
// =============================================================================

interface EditorTabProps {
  file: BoltOpenFile;
  isActive: boolean;
  isSaving?: boolean;
  onClick: () => void;
  onClose: () => void;
}

const EditorTab = memo(function EditorTab({ file, isActive, isSaving, onClick, onClose }: EditorTabProps) {
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-1.5 text-[13px] cursor-pointer border-r border-zinc-800/50 transition-colors ${
        isActive
          ? 'bg-[#0a0a0a] text-white'
          : 'bg-[#0f0f0f] text-zinc-500 hover:text-zinc-300'
      }`}
      onClick={onClick}
    >
      <span className="truncate max-w-[100px]">{file.name}</span>
      {/* Show saving indicator OR dirty indicator */}
      {isSaving ? (
        <Loader2 className="w-3 h-3 animate-spin text-violet-400 flex-shrink-0" />
      ) : file.isDirty ? (
        <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" title="Unsaved changes" />
      ) : null}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-700 transition-all"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface BoltCodeEditorProps {
  openFiles: BoltOpenFile[];
  activeFile: string | null;
  onFileChange: (path: string, content: string) => void;
  onFileClose: (path: string) => void;
  onFileSelect: (path: string) => void;
  onFileSave: (path: string) => void;
  /** Auto-save delay in ms (0 to disable). Default: 1500ms */
  autoSaveDelay?: number;
}

export function BoltCodeEditor({
  openFiles,
  activeFile,
  onFileChange,
  onFileClose,
  onFileSelect,
  onFileSave,
  autoSaveDelay = 1500,
}: BoltCodeEditorProps) {
  const { webcontainer, isReady } = useBoltWebContainer();
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<any>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for stable callback access
  const activeFileRef = useRef(activeFile);
  const contentRef = useRef(content);
  const onFileSaveRef = useRef(onFileSave);
  const onFileChangeRef = useRef(onFileChange);
  const openFilesRef = useRef(openFiles);

  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { onFileSaveRef.current = onFileSave; }, [onFileSave]);
  useEffect(() => { onFileChangeRef.current = onFileChange; }, [onFileChange]);
  useEffect(() => { openFilesRef.current = openFiles; }, [openFiles]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Debounced change handler - updates parent state
  const debouncedFileChange = useDebouncedCallback(
    (path: string, newContent: string) => onFileChangeRef.current(path, newContent),
    300
  );

  // Auto-save function - writes to WebContainer and triggers parent save
  const triggerAutoSave = useCallback(async (path: string, newContent: string) => {
    if (!webcontainer || !isReady || autoSaveDelay === 0) return;

    // Clear any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Schedule auto-save
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await webcontainer.fs.writeFile(path, newContent);
        // Trigger parent's save callback to clear dirty flag
        onFileSaveRef.current(path);
        console.log('[BoltCodeEditor] Auto-saved:', path);
      } catch (error) {
        console.error('[BoltCodeEditor] Auto-save error:', error);
      } finally {
        setIsSaving(false);
      }
    }, autoSaveDelay);
  }, [webcontainer, isReady, autoSaveDelay]);

  // Load file content - PRIORITIZE cached content for dirty files
  useEffect(() => {
    if (!activeFile || !webcontainer || !isReady) return;

    // Clear any pending auto-save when switching files
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const loadContent = async () => {
      // Check if we have cached content for this file (preserves unsaved changes)
      const cachedFile = openFilesRef.current.find(f => f.path === activeFile);

      // Use cached content if the file is dirty (has unsaved changes)
      if (cachedFile?.isDirty && cachedFile.content !== undefined) {
        console.log('[BoltCodeEditor] Using cached content for dirty file:', activeFile);
        setContent(cachedFile.content);
        contentRef.current = cachedFile.content;
        return;
      }

      // Otherwise, load from WebContainer
      setIsLoading(true);
      try {
        const fileContent = await webcontainer.fs.readFile(activeFile, 'utf-8');
        setContent(fileContent);
        contentRef.current = fileContent;
      } catch (error) {
        console.error('[BoltCodeEditor] Load error:', error);
        setContent(`// Error loading file: ${activeFile}`);
      }
      setIsLoading(false);
    };

    loadContent();
  }, [activeFile, webcontainer, isReady]);

  // Define theme before mount
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    monaco.editor.defineTheme('bolt', BOLT_THEME);
  }, []);

  // Editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Ctrl+S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentFile = activeFileRef.current;
      if (currentFile) onFileSaveRef.current(currentFile);
    });

    editor.focus();
  }, []);

  // Content change - update state, notify parent, and trigger auto-save
  const handleChange: OnChange = useCallback((value) => {
    if (value !== undefined && activeFileRef.current) {
      const path = activeFileRef.current;
      setContent(value);
      contentRef.current = value;
      // Notify parent of change (marks as dirty, caches content)
      debouncedFileChange(path, value);
      // Trigger auto-save
      triggerAutoSave(path, value);
    }
  }, [debouncedFileChange, triggerAutoSave]);

  // Empty state
  if (openFiles.length === 0) {
    return (
      <div className="h-full bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-zinc-500 text-sm">No file selected</p>
          <p className="text-zinc-600 text-xs mt-1">Choose a file from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Tabs */}
      <div className="flex items-center bg-[#0f0f0f] border-b border-zinc-800/50 overflow-x-auto flex-shrink-0">
        {openFiles.map((file) => (
          <EditorTab
            key={file.path}
            file={file}
            isActive={file.path === activeFile}
            isSaving={isSaving && file.path === activeFile}
            onClick={() => onFileSelect(file.path)}
            onClose={() => onFileClose(file.path)}
          />
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 relative min-h-0">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          </div>
        ) : (
          <Editor
            height="100%"
            language={activeFile ? getLanguage(activeFile) : 'plaintext'}
            value={content}
            onChange={handleChange}
            beforeMount={handleBeforeMount}
            onMount={handleEditorMount}
            theme="bolt"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              glyphMargin: false,
              folding: true,
              lineDecorationsWidth: 8,
              lineNumbersMinChars: 4,
              renderLineHighlight: 'line',
              tabSize: 2,
              insertSpaces: true,
              automaticLayout: true,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              contextmenu: false,
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
              },
            }}
          />
        )}
      </div>
    </div>
  );
}
