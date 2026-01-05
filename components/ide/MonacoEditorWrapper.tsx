'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { useWebContainer } from '@/lib/webcontainer/context';

interface MonacoEditorWrapperProps {
  filePath: string | null;
  onContentChange?: (path: string, content: string) => void;
}

export function MonacoEditorWrapper({ filePath, onContentChange }: MonacoEditorWrapperProps) {
  const { webcontainer, isReady } = useWebContainer();
  const [content, setContent] = useState<string>('');
  const [language, setLanguage] = useState<string>('plaintext');
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine language from file extension
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      html: 'html',
      css: 'css',
      scss: 'scss',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
      svg: 'xml',
      sh: 'shell',
      bash: 'shell',
    };
    return langMap[ext] || 'plaintext';
  };

  // Load file content
  useEffect(() => {
    if (!filePath || !webcontainer || !isReady) {
      setContent('');
      return;
    }

    setLoading(true);
    setLanguage(getLanguage(filePath));

    webcontainer.fs.readFile(filePath, 'utf-8')
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to read file:', filePath, err);
        setContent(`// Error loading file: ${err.message}`);
        setLoading(false);
      });
  }, [filePath, webcontainer, isReady]);

  // Auto-save with debounce
  const saveFile = useCallback(async (path: string, newContent: string) => {
    if (!webcontainer || !isReady) return;

    try {
      await webcontainer.fs.writeFile(path, newContent);
      console.log('[Editor] Saved:', path);
    } catch (err) {
      console.error('[Editor] Save failed:', path, err);
    }
  }, [webcontainer, isReady]);

  const handleChange: OnChange = (value) => {
    if (!filePath || value === undefined) return;

    setContent(value);
    onContentChange?.(filePath, value);

    // Debounced auto-save (500ms)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveFile(filePath, value);
    }, 500);
  };

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Add Ctrl+S handler
    editor.addCommand(
      (window as any).monaco?.KeyMod.CtrlCmd | (window as any).monaco?.KeyCode.KeyS,
      () => {
        if (filePath) {
          saveFile(filePath, editor.getValue());
        }
      }
    );
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!filePath) {
    return (
      <div className="h-full bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-center text-[#808080]">
          <div className="text-lg mb-2">No file selected</div>
          <div className="text-sm">Select a file from the explorer to edit</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full bg-[#1e1e1e] flex items-center justify-center">
        <div className="text-[#808080]">Loading...</div>
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      theme="vs-dark"
      onChange={handleChange}
      onMount={handleMount}
      options={{
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        lineNumbers: 'on',
        renderLineHighlight: 'line',
        cursorBlinking: 'smooth',
        smoothScrolling: true,
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}
