'use client';

import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '@/lib/store';
import { writeFile } from '@/lib/webcontainer/manager';

export function CodeEditor() {
  const { currentFile, fileContents, updateFileContent, theme } = useEditorStore();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const currentContent = currentFile ? fileContents[currentFile] || '' : '';

  const getLanguage = (file: string) => {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) return 'typescript';
    if (file.endsWith('.jsx') || file.endsWith('.js')) return 'javascript';
    if (file.endsWith('.css')) return 'css';
    if (file.endsWith('.html')) return 'html';
    if (file.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  const handleChange = (value: string | undefined) => {
    if (!currentFile || value === undefined) return;
    updateFileContent(currentFile, value);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        await writeFile(currentFile, value);
      } catch (e) {
        console.error('Error writing file:', e);
      }
    }, 500);
  };

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  if (!currentFile) {
    return (
      <div className="h-full flex items-center justify-center text-foreground/40">
        Select a file to edit
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-4 bg-background/50">
        <span className="text-sm font-medium truncate">{currentFile}</span>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          language={getLanguage(currentFile)}
          value={currentContent}
          onChange={handleChange}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true }}
        />
      </div>
    </div>
  );
}
