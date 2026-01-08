/**
 * File Tree Utilities
 *
 * Utilities for scanning and working with the WebContainer filesystem.
 */

import type { WebContainer } from '@webcontainer/api';

/**
 * Build a text representation of the file tree
 */
export async function buildFileTree(
  webcontainer: WebContainer,
  path: string = '.',
  indent: string = '',
  maxDepth: number = 5
): Promise<string> {
  if (maxDepth <= 0) return `${indent}...\n`;

  const lines: string[] = [];

  try {
    const entries = await webcontainer.fs.readdir(path, { withFileTypes: true });

    // Sort: directories first, then files
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      // Skip node_modules and hidden directories (except .env examples)
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        (entry.name.startsWith('.') && !entry.name.includes('.env'))
      ) {
        continue;
      }

      const fullPath = path === '.' ? entry.name : `${path}/${entry.name}`;

      if (entry.isDirectory()) {
        lines.push(`${indent}${entry.name}/`);
        const subTree = await buildFileTree(
          webcontainer,
          fullPath,
          indent + '  ',
          maxDepth - 1
        );
        lines.push(subTree);
      } else {
        lines.push(`${indent}${entry.name}`);
      }
    }
  } catch (error) {
    // Directory might not exist or be readable
    console.warn(`[FileTree] Could not read ${path}:`, error);
  }

  return lines.join('\n');
}

/**
 * Get a flat list of all file paths
 */
export async function getAllFilePaths(
  webcontainer: WebContainer,
  path: string = '.',
  maxDepth: number = 5
): Promise<string[]> {
  if (maxDepth <= 0) return [];

  const files: string[] = [];

  try {
    const entries = await webcontainer.fs.readdir(path, { withFileTypes: true });

    for (const entry of entries) {
      // Skip node_modules and hidden directories
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }

      const fullPath = path === '.' ? entry.name : `${path}/${entry.name}`;

      if (entry.isDirectory()) {
        const subFiles = await getAllFilePaths(webcontainer, fullPath, maxDepth - 1);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`[FileTree] Could not read ${path}:`, error);
  }

  return files;
}

/**
 * Read file content from WebContainer
 */
export async function readFileContent(
  webcontainer: WebContainer,
  path: string
): Promise<string | null> {
  try {
    const content = await webcontainer.fs.readFile(path, 'utf-8');
    return content;
  } catch (error) {
    console.warn(`[FileTree] Could not read file ${path}:`, error);
    return null;
  }
}

/**
 * Get relevant files for a given prompt
 * Analyzes the prompt to determine which files might be relevant
 */
export async function getRelevantFiles(
  webcontainer: WebContainer,
  prompt: string,
  maxFiles: number = 5
): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  const allPaths = await getAllFilePaths(webcontainer);

  // Keywords that suggest relevance
  const keywords = prompt.toLowerCase().split(/\s+/);

  // Score files based on relevance to prompt
  const scored = allPaths.map((path) => {
    const pathLower = path.toLowerCase();
    let score = 0;

    // Check for keyword matches
    for (const keyword of keywords) {
      if (keyword.length < 3) continue;
      if (pathLower.includes(keyword)) {
        score += 10;
      }
    }

    // Boost certain files
    if (pathLower.includes('app.tsx') || pathLower.includes('app.jsx')) {
      score += 5;
    }
    if (pathLower.includes('main.tsx') || pathLower.includes('main.jsx')) {
      score += 3;
    }
    if (pathLower.includes('index.tsx') || pathLower.includes('index.jsx')) {
      score += 2;
    }
    if (pathLower.endsWith('.css') && keywords.some((k) => k.includes('style'))) {
      score += 5;
    }

    return { path, score };
  });

  // Sort by score and take top N
  const topFiles = scored
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);

  // If no matches, include App.tsx and main files by default
  if (topFiles.length === 0) {
    const defaultFiles = ['src/App.tsx', 'src/main.tsx', 'src/App.jsx', 'src/main.jsx'];
    for (const path of defaultFiles) {
      if (allPaths.includes(path) && files.length < maxFiles) {
        const content = await readFileContent(webcontainer, path);
        if (content) {
          files.push({ path, content });
        }
      }
    }
    return files;
  }

  // Read content of top files
  for (const { path } of topFiles) {
    const content = await readFileContent(webcontainer, path);
    if (content) {
      files.push({ path, content });
    }
  }

  return files;
}

/**
 * Detect framework from file tree
 */
export function detectFramework(fileTree: string): string {
  if (fileTree.includes('next.config')) return 'Next.js';
  if (fileTree.includes('vite.config')) return 'Vite + React';
  if (fileTree.includes('angular.json')) return 'Angular';
  if (fileTree.includes('vue.config')) return 'Vue';
  return 'React + Vite';
}

/**
 * Detect styling approach from file tree
 */
export function detectStyling(fileTree: string): string {
  if (fileTree.includes('tailwind.config')) return 'Tailwind CSS';
  if (fileTree.includes('.scss') || fileTree.includes('.sass')) return 'SCSS';
  if (fileTree.includes('styled-components')) return 'Styled Components';
  if (fileTree.includes('.module.css')) return 'CSS Modules';
  return 'Tailwind CSS';
}
