'use client';

import { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/lib/store';

export function Terminal() {
  const { terminalOutput, clearTerminalOutput } = useEditorStore();
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-4 bg-background/50 justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Terminal</span>
        </div>
        <button
          onClick={clearTerminalOutput}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Clear terminal"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto bg-gray-900 p-4 font-mono text-sm text-green-400"
      >
        {terminalOutput.length === 0 ? (
          <span className="text-gray-500">Terminal output will appear here...</span>
        ) : (
          <pre className="whitespace-pre-wrap">{terminalOutput.join('')}</pre>
        )}
      </div>
    </div>
  );
}
