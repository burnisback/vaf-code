/**
 * File Tree Scanner for WebContainer
 * Scans WebContainer filesystem and generates structured file tree for AI context
 */

// WebContainer type - using any for flexibility with different WebContainer versions
type WebContainer = any;

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  extension?: string;
}

export interface FileTreeOptions {
  maxDepth: number;
  maxFiles: number;
  ignorePaths: string[];
  includeHidden: boolean;
}

const DEFAULT_OPTIONS: FileTreeOptions = {
  maxDepth: 5,
  maxFiles: 200,
  ignorePaths: ['node_modules', '.git', 'dist', '.next', 'build', 'out', '.turbo', 'coverage'],
  includeHidden: false,
};

/**
 * Check if a path should be ignored based on ignore patterns
 */
function shouldIgnore(path: string, ignorePaths: string[]): boolean {
  const pathParts = path.split('/').filter(Boolean);
  return pathParts.some(part => ignorePaths.includes(part));
}

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string | undefined {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1] : undefined;
}

/**
 * Scan WebContainer filesystem and generate structured file tree
 */
export async function scanFileTree(
  webcontainer: WebContainer,
  rootPath: string = '/',
  options?: Partial<FileTreeOptions>
): Promise<FileNode[]> {
  const opts: FileTreeOptions = { ...DEFAULT_OPTIONS, ...options };
  const fileCount = { current: 0 };

  async function scanDirectory(
    dirPath: string,
    depth: number
  ): Promise<FileNode[]> {
    if (depth > opts.maxDepth || fileCount.current >= opts.maxFiles) {
      return [];
    }

    const normalizedPath = dirPath === '/' ? '' : dirPath;

    try {
      const entries = await webcontainer.fs.readdir(normalizedPath || '.', {
        withFileTypes: true
      });

      const nodes: FileNode[] = [];

      for (const entry of entries) {
        if (fileCount.current >= opts.maxFiles) {
          break;
        }

        const name = entry.name;
        const fullPath = normalizedPath ? `${normalizedPath}/${name}` : name;

        if (!opts.includeHidden && name.startsWith('.')) {
          continue;
        }

        if (shouldIgnore(fullPath, opts.ignorePaths)) {
          continue;
        }

        const isDirectory = entry.isDirectory();

        if (isDirectory) {
          const children = await scanDirectory(fullPath, depth + 1);

          nodes.push({
            name,
            path: fullPath,
            type: 'directory',
            children: children.length > 0 ? children : undefined,
          });
        } else if (entry.isFile()) {
          fileCount.current++;

          nodes.push({
            name,
            path: fullPath,
            type: 'file',
            extension: getExtension(name),
          });
        }
      }

      // Sort: directories first, then files, both alphabetically
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return nodes;
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error);
      return [];
    }
  }

  return scanDirectory(rootPath, 0);
}

/**
 * Format file tree as indented string for system prompt
 */
export function formatFileTreeForPrompt(tree: FileNode[]): string {
  const lines: string[] = [];

  function formatNode(node: FileNode, indent: number): void {
    const prefix = '  '.repeat(indent);
    const suffix = node.type === 'directory' ? '/' : '';
    lines.push(`${prefix}${node.name}${suffix}`);

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        formatNode(child, indent + 1);
      }
    }
  }

  for (const node of tree) {
    formatNode(node, 0);
  }

  return lines.join('\n');
}

/**
 * Flatten tree to array of file paths
 */
export function flattenTree(tree: FileNode[]): string[] {
  const paths: string[] = [];

  function traverse(node: FileNode): void {
    if (node.type === 'file') {
      paths.push(node.path);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of tree) {
    traverse(node);
  }

  return paths;
}

/**
 * Get total file count in tree
 */
export function countFiles(tree: FileNode[]): number {
  let count = 0;

  function traverse(node: FileNode): void {
    if (node.type === 'file') {
      count++;
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of tree) {
    traverse(node);
  }

  return count;
}
