'use client';

import React from 'react';
import { X, FileCode } from 'lucide-react';

export interface OpenFile {
  path: string;
  name: string;
  isDirty?: boolean;
}

interface EditorTabsProps {
  files: OpenFile[];
  activeFile: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
}

export function EditorTabs({ files, activeFile, onTabClick, onTabClose }: EditorTabsProps) {
  if (files.length === 0) {
    return null;
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const colors: Record<string, string> = {
      ts: '#3178c6',
      tsx: '#3178c6',
      js: '#f7df1e',
      jsx: '#f7df1e',
      json: '#cbcb41',
      html: '#e34c26',
      css: '#264de4',
      md: '#083fa1',
    };
    return colors[ext] || '#808080';
  };

  return (
    <div className="flex bg-[#252526] border-b border-[#3e3e42] overflow-x-auto">
      {files.map(file => {
        const isActive = activeFile === file.path;
        return (
          <div
            key={file.path}
            className={`
              flex items-center gap-2 px-3 py-2 min-w-0 cursor-pointer
              border-r border-[#3e3e42] group
              ${isActive
                ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#007acc]'
                : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2a2d2e]'
              }
            `}
            onClick={() => onTabClick(file.path)}
          >
            <FileCode
              className="w-4 h-4 flex-shrink-0"
              style={{ color: getFileIcon(file.name) }}
            />
            <span className="truncate text-sm max-w-[120px]">
              {file.isDirty && <span className="text-white mr-1">●</span>}
              {file.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file.path);
              }}
              className={`
                p-0.5 rounded hover:bg-[#3e3e42] transition-colors
                ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
              `}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
