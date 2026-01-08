'use client';

/**
 * BoltFileExplorer
 *
 * Professional file tree component matching bolt.new design.
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { useBoltWebContainer } from '@/lib/bolt/webcontainer/context';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { BoltFileNode } from '@/lib/bolt/types';

// =============================================================================
// FILE ICON HELPER
// =============================================================================

const FILE_ICONS: Record<string, { color: string }> = {
  tsx: { color: 'text-blue-400' },
  ts: { color: 'text-blue-400' },
  jsx: { color: 'text-amber-400' },
  js: { color: 'text-amber-400' },
  json: { color: 'text-amber-500' },
  css: { color: 'text-pink-400' },
  scss: { color: 'text-pink-400' },
  html: { color: 'text-orange-400' },
  md: { color: 'text-zinc-400' },
  svg: { color: 'text-emerald-400' },
  png: { color: 'text-purple-400' },
  jpg: { color: 'text-purple-400' },
  gif: { color: 'text-purple-400' },
};

function getFileIcon(fileName: string): React.ReactNode {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const config = FILE_ICONS[ext] || { color: 'text-zinc-500' };
  return <File className={`w-4 h-4 ${config.color}`} />;
}

// =============================================================================
// FILE TREE NODE
// =============================================================================

interface FileTreeNodeProps {
  node: BoltFileNode;
  depth: number;
  onSelect: (path: string) => void;
  selectedPath: string | null;
  onToggle: (path: string) => void;
}

const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  onSelect,
  selectedPath,
  onToggle,
}: FileTreeNodeProps) {
  const isSelected = selectedPath === node.path;
  const isDirectory = node.type === 'directory';
  const isExpanded = node.isExpanded;

  const handleClick = () => {
    if (isDirectory) {
      onToggle(node.path);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-md mx-1 transition-colors ${
          isSelected
            ? 'bg-violet-500/15 text-violet-400'
            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Arrow */}
        {isDirectory ? (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Icon */}
        <span className="flex-shrink-0">
          {isDirectory ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400" />
            )
          ) : (
            getFileIcon(node.name)
          )}
        </span>

        {/* Name */}
        <span className="text-[13px] truncate">{node.name}</span>
      </div>

      {/* Children */}
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface BoltFileExplorerProps {
  onFileSelect: (path: string) => void;
  selectedPath: string | null;
}

export function BoltFileExplorer({ onFileSelect, selectedPath }: BoltFileExplorerProps) {
  const { webcontainer, filesystemVersion, isReady } = useBoltWebContainer();
  const [tree, setTree] = useState<BoltFileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['src']));

  // Build file tree from WebContainer
  const buildTree = useCallback(
    async (dirPath: string = '.'): Promise<BoltFileNode[]> => {
      if (!webcontainer) return [];

      try {
        const entries = await webcontainer.fs.readdir(dirPath, { withFileTypes: true });
        const nodes: BoltFileNode[] = [];

        for (const entry of entries) {
          // Skip node_modules and hidden files
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
            continue;
          }

          const fullPath = dirPath === '.' ? entry.name : `${dirPath}/${entry.name}`;
          const isDir = entry.isDirectory();

          const node: BoltFileNode = {
            name: entry.name,
            path: fullPath,
            type: isDir ? 'directory' : 'file',
            isExpanded: expandedPaths.has(fullPath),
          };

          if (isDir && expandedPaths.has(fullPath)) {
            node.children = await buildTree(fullPath);
          } else if (isDir) {
            node.children = [];
          }

          nodes.push(node);
        }

        // Sort: directories first, then alphabetically
        nodes.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        return nodes;
      } catch (error) {
        console.error('[BoltFileExplorer] Error reading directory:', dirPath, error);
        return [];
      }
    },
    [webcontainer, expandedPaths]
  );

  // Load tree when ready or filesystem changes
  useEffect(() => {
    if (!isReady || !webcontainer) return;

    const loadTree = async () => {
      setIsLoading(true);
      const nodes = await buildTree('.');
      setTree(nodes);
      setIsLoading(false);
    };

    loadTree();
  }, [isReady, webcontainer, filesystemVersion, buildTree]);

  // Handle directory toggle
  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    const nodes = await buildTree('.');
    setTree(nodes);
    setIsLoading(false);
  }, [buildTree]);

  // Update tree when expandedPaths changes
  useEffect(() => {
    if (!isReady || !webcontainer) return;

    const updateTree = async () => {
      const nodes = await buildTree('.');
      setTree(nodes);
    };

    updateTree();
  }, [expandedPaths, isReady, webcontainer, buildTree]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Files
        </span>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800/50 disabled:opacity-50 transition-colors"
          title="Refresh"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-2">
        {tree.length === 0 && !isLoading ? (
          <div className="px-3 py-8 text-center text-zinc-600 text-sm">
            No files found
          </div>
        ) : (
          tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              onSelect={onFileSelect}
              selectedPath={selectedPath}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}
