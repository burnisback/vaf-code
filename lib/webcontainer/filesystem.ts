import { FileNode } from '../store';
import { readdir } from './manager';

export async function buildFileTree(basePath = '.'): Promise<FileNode[]> {
  try {
    const entries = await readdir(basePath);
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;

      const fullPath = basePath === '.' ? entry : `${basePath}/${entry}`;
      const isDirectory = !entry.includes('.');

      const node: FileNode = {
        name: entry,
        type: isDirectory ? 'directory' : 'file',
        path: fullPath,
      };

      if (isDirectory) {
        node.children = await buildFileTree(fullPath);
      }

      nodes.push(node);
    }

    return nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  } catch {
    return [];
  }
}
