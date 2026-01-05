'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { FileNode, useEditorStore } from '@/lib/store';
import { readFile } from '@/lib/webcontainer/manager';

function FileTreeItem({ node, level }: { node: FileNode; level: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const { currentFile, setCurrentFile, updateFileContent } = useEditorStore();

  const handleClick = async () => {
    if (node.type === 'directory') {
      setIsOpen(!isOpen);
    } else {
      setCurrentFile(node.path);
      try {
        const content = await readFile(node.path);
        updateFileContent(node.path, content);
      } catch (e) {
        console.error('Error reading file:', e);
      }
    }
  };

  const isSelected = currentFile === node.path;

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm ${
          isSelected ? 'bg-primary/10 text-primary' : ''
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {node.type === 'directory' ? (
          <>
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Folder className="w-4 h-4" />
          </>
        ) : (
          <File className="w-4 h-4 ml-4" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.type === 'directory' && isOpen && node.children?.map((child) => (
        <FileTreeItem key={child.path} node={child} level={level + 1} />
      ))}
    </div>
  );
}

export function FileTree() {
  const { files } = useEditorStore();

  return (
    <div className="h-full overflow-y-auto p-2">
      <h2 className="text-xs font-semibold text-foreground/60 mb-2 px-2">FILES</h2>
      {files.map((node) => (
        <FileTreeItem key={node.path} node={node} level={0} />
      ))}
    </div>
  );
}
