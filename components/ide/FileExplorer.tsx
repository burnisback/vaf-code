'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import { useWebContainer } from '@/lib/webcontainer/context';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
  selectedFile?: string | null;
}

export function FileExplorer({ onFileSelect, selectedFile }: FileExplorerProps) {
  const { webcontainer, isReady, filesystemVersion } = useWebContainer();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [loading, setLoading] = useState(false);

  const buildTree = useCallback(async (dirPath: string = '/'): Promise<FileNode[]> => {
    if (!webcontainer) return [];

    try {
      const entries = await webcontainer.fs.readdir(dirPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        const fullPath = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;

        // Skip node_modules and hidden files for cleaner view
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory()) {
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'directory',
            children: [], // Will be loaded on expand
          });
        } else {
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'file',
          });
        }
      }

      // Sort: directories first, then alphabetically
      return nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      console.error('Failed to read directory:', dirPath, err);
      return [];
    }
  }, [webcontainer]);

  const loadChildren = useCallback(async (node: FileNode): Promise<FileNode[]> => {
    if (node.type !== 'directory') return [];
    return buildTree(node.path);
  }, [buildTree]);

  const refreshTree = useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    const rootNodes = await buildTree('/');

    // Recursively load children for all expanded paths
    const loadExpandedChildren = async (nodes: FileNode[]): Promise<FileNode[]> => {
      const result: FileNode[] = [];
      for (const node of nodes) {
        if (node.type === 'directory' && expandedPaths.has(node.path)) {
          const children = await buildTree(node.path);
          const loadedChildren = await loadExpandedChildren(children);
          result.push({ ...node, children: loadedChildren });
        } else {
          result.push(node);
        }
      }
      return result;
    };

    const treeWithChildren = await loadExpandedChildren(rootNodes);
    setTree(treeWithChildren);
    setLoading(false);
  }, [isReady, buildTree, expandedPaths]);

  useEffect(() => {
    if (isReady) {
      refreshTree();
    }
  }, [isReady, refreshTree, filesystemVersion]);

  // Periodic polling to detect filesystem changes from terminal
  useEffect(() => {
    if (!isReady) return;

    const intervalId = setInterval(() => {
      refreshTree();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [isReady, refreshTree]);

  const toggleExpand = async (node: FileNode) => {
    const newExpanded = new Set(expandedPaths);

    if (expandedPaths.has(node.path)) {
      newExpanded.delete(node.path);
    } else {
      newExpanded.add(node.path);
      // Load children if not already loaded
      if (node.children?.length === 0) {
        const children = await loadChildren(node);
        setTree(prev => updateNodeChildren(prev, node.path, children));
      }
    }

    setExpandedPaths(newExpanded);
  };

  const updateNodeChildren = (nodes: FileNode[], path: string, children: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      if (node.path === path) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateNodeChildren(node.children, path, children) };
      }
      return node;
    });
  };

  const handleClick = (node: FileNode) => {
    if (node.type === 'directory') {
      toggleExpand(node);
    } else {
      onFileSelect(node.path);
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedFile === node.path;
    const paddingLeft = depth * 12 + 8;

    return (
      <div key={node.path}>
        <div
          className={`
            flex items-center gap-1 py-1 px-2 cursor-pointer text-sm
            hover:bg-[#2a2d2e] transition-colors
            ${isSelected ? 'bg-[#094771] text-white' : 'text-[#cccccc]'}
          `}
          style={{ paddingLeft }}
          onClick={() => handleClick(node)}
        >
          {node.type === 'directory' ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-[#c5c5c5]" />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0 text-[#c5c5c5]" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 flex-shrink-0 text-[#dcb67a]" />
              ) : (
                <Folder className="w-4 h-4 flex-shrink-0 text-[#dcb67a]" />
              )}
            </>
          ) : (
            <>
              <span className="w-4" /> {/* Spacer for alignment */}
              <FileIcon filename={node.name} />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </div>

        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isReady) {
    return (
      <div className="h-full bg-[#252526] flex items-center justify-center">
        <div className="text-[#808080] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#252526] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3e3e42]">
        <span className="text-xs font-semibold text-[#bbbbbb] uppercase tracking-wide">
          Explorer
        </span>
        <button
          onClick={refreshTree}
          disabled={loading}
          className="p-1 hover:bg-[#3e3e42] rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-[#808080] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto py-1">
        {tree.length === 0 ? (
          <div className="px-4 py-2 text-[#808080] text-sm">
            No files yet
          </div>
        ) : (
          tree.map(node => renderNode(node))
        )}
      </div>
    </div>
  );
}

// File icon component based on extension
function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const iconColors: Record<string, string> = {
    ts: '#3178c6',
    tsx: '#3178c6',
    js: '#f7df1e',
    jsx: '#f7df1e',
    json: '#cbcb41',
    html: '#e34c26',
    css: '#264de4',
    scss: '#c6538c',
    md: '#083fa1',
    svg: '#ffb13b',
    png: '#a074c4',
    jpg: '#a074c4',
    gif: '#a074c4',
  };

  const color = iconColors[ext] || '#808080';

  return <File className="w-4 h-4 flex-shrink-0" style={{ color }} />;
}
