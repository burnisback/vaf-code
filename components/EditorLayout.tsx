'use client';

import { useEffect } from 'react';
import { FileTree } from './FileTree';
import { CodeEditor } from './CodeEditor';
import { Preview } from './Preview';
import { Terminal } from './Terminal';
import { Chat } from './Chat';
import { useEditorStore } from '@/lib/store';
import { initializeProject } from '@/lib/webcontainer/manager';
import { buildFileTree } from '@/lib/webcontainer/filesystem';

export function EditorLayout() {
  const { setFiles, setPreviewUrl, addTerminalOutput, setWebContainerReady } = useEditorStore();

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        addTerminalOutput('Initializing WebContainer...\\n');
        const url = await initializeProject((output) => {
          if (mounted) addTerminalOutput(output);
        });

        if (mounted) {
          setPreviewUrl(url);
          setWebContainerReady(true);
          const files = await buildFileTree();
          setFiles(files);
        }
      } catch (error) {
        if (mounted) addTerminalOutput(`\\nError: ${error}\\n`);
      }
    }

    init();
    return () => { mounted = false; };
  }, [setFiles, setPreviewUrl, addTerminalOutput, setWebContainerReady]);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      <div className="w-64 border-r border-border bg-background">
        <FileTree />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-[60%] flex">
          <div className="flex-1 border-r border-border">
            <CodeEditor />
          </div>
          <div className="flex-1">
            <Preview />
          </div>
        </div>
        <div className="h-[40%] border-t border-border">
          <Terminal />
        </div>
      </div>
      <div className="w-80 border-l border-border bg-background">
        <Chat />
      </div>
    </div>
  );
}
