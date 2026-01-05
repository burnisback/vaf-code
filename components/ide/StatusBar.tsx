'use client';

import React from 'react';
import { GitBranch, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useWebContainer } from '@/lib/webcontainer/context';

interface StatusBarProps {
  activeFile?: string | null;
  lineNumber?: number;
  columnNumber?: number;
}

export function StatusBar({ activeFile, lineNumber = 1, columnNumber = 1 }: StatusBarProps) {
  const { isReady, isBooting, error } = useWebContainer();

  const getLanguage = (path: string | null): string => {
    if (!path) return 'Plain Text';
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript React',
      js: 'JavaScript',
      jsx: 'JavaScript React',
      json: 'JSON',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      md: 'Markdown',
      yml: 'YAML',
      yaml: 'YAML',
    };
    return langMap[ext] || 'Plain Text';
  };

  return (
    <div className="h-6 bg-[#007acc] flex items-center justify-between px-3 text-white text-xs">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* WebContainer status */}
        <div className="flex items-center gap-1.5">
          {isBooting ? (
            <>
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              <span>Booting...</span>
            </>
          ) : error ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-300" />
              <span className="text-red-200">Error</span>
            </>
          ) : isReady ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>WebContainer Ready</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-yellow-300" />
              <span>Disconnected</span>
            </>
          )}
        </div>

        {/* Git branch (mock) */}
        <div className="flex items-center gap-1">
          <GitBranch className="w-3.5 h-3.5" />
          <span>main</span>
        </div>

        {/* Sync status */}
        <div className="flex items-center gap-1">
          <Check className="w-3.5 h-3.5" />
          <span>Synced</span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Cursor position */}
        {activeFile && (
          <span>Ln {lineNumber}, Col {columnNumber}</span>
        )}

        {/* Language */}
        <span>{getLanguage(activeFile ?? null)}</span>

        {/* Encoding */}
        <span>UTF-8</span>

        {/* Indentation */}
        <span>Spaces: 2</span>
      </div>
    </div>
  );
}
