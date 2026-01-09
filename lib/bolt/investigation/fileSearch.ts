/**
 * File Search Utility
 *
 * Provides file search capabilities for the investigation layer.
 * Supports glob patterns, content search, and relevance scoring.
 */

import type { SearchResult, SearchOptions } from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
  '.turbo',
];

const DEFAULT_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.css',
  '.scss',
  '.md',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Check if a path should be excluded
 */
function shouldExclude(filePath: string, excludeDirs: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return excludeDirs.some(
    (dir) =>
      normalized.includes(`/${dir}/`) ||
      normalized.startsWith(`${dir}/`) ||
      normalized.endsWith(`/${dir}`)
  );
}

/**
 * Get file extension from path
 */
function getExtension(filePath: string): string {
  const match = filePath.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Calculate relevance score based on match quality
 */
function calculateRelevance(
  filePath: string,
  pattern: string,
  matchType: SearchResult['matchType']
): number {
  const normalizedPath = filePath.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  let score = 0;

  // Exact filename match
  const filename = normalizedPath.split('/').pop() || '';
  if (filename === normalizedPattern) {
    score = 1.0;
  }
  // Filename contains pattern
  else if (filename.includes(normalizedPattern)) {
    score = 0.8;
  }
  // Path contains pattern
  else if (normalizedPath.includes(normalizedPattern)) {
    score = 0.6;
  }
  // Partial match
  else {
    score = 0.4;
  }

  // Boost for certain file types
  const ext = getExtension(filePath);
  if (['.ts', '.tsx'].includes(ext)) {
    score = Math.min(1.0, score + 0.1);
  }

  // Boost for source files
  if (normalizedPath.includes('/src/')) {
    score = Math.min(1.0, score + 0.05);
  }

  // Slight penalty for test files
  if (normalizedPath.includes('.test.') || normalizedPath.includes('.spec.')) {
    score = Math.max(0.1, score - 0.15);
  }

  // Boost for content matches
  if (matchType === 'content') {
    score = Math.min(1.0, score + 0.15);
  }

  return Math.round(score * 100) / 100;
}

// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

/**
 * Search files by filename pattern
 */
export function searchByFilename(
  pattern: string,
  projectFiles: string[],
  options: SearchOptions = {}
): SearchResult[] {
  const {
    maxResults = 20,
    extensions = DEFAULT_EXTENSIONS,
    excludeDirs = DEFAULT_EXCLUDE_DIRS,
    caseSensitive = false,
  } = options;

  const results: SearchResult[] = [];
  const normalizedPattern = caseSensitive ? pattern : pattern.toLowerCase();

  // Check if pattern is a glob
  const isGlob = pattern.includes('*') || pattern.includes('?');
  const regex = isGlob ? globToRegex(pattern) : null;

  for (const filePath of projectFiles) {
    // Skip excluded directories
    if (shouldExclude(filePath, excludeDirs)) continue;

    // Check extension filter
    const ext = getExtension(filePath);
    if (extensions.length > 0 && !extensions.includes(ext)) continue;

    const normalizedPath = caseSensitive ? filePath : filePath.toLowerCase();
    const filename = normalizedPath.split('/').pop() || '';

    let isMatch = false;

    if (regex) {
      isMatch = regex.test(filename);
    } else {
      isMatch = filename.includes(normalizedPattern) ||
                normalizedPath.includes(normalizedPattern);
    }

    if (isMatch) {
      results.push({
        filePath,
        matchType: 'filename',
        relevance: calculateRelevance(filePath, pattern, 'filename'),
      });
    }

    if (results.length >= maxResults) break;
  }

  // Sort by relevance
  return results.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Search files by content pattern
 */
export function searchByContent(
  pattern: string,
  projectFiles: string[],
  fileContents: Map<string, string>,
  options: SearchOptions = {}
): SearchResult[] {
  const {
    maxResults = 20,
    extensions = DEFAULT_EXTENSIONS,
    excludeDirs = DEFAULT_EXCLUDE_DIRS,
    caseSensitive = false,
  } = options;

  const results: SearchResult[] = [];
  const flags = caseSensitive ? 'g' : 'gi';

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch {
    // If invalid regex, escape and search as literal
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(escaped, flags);
  }

  for (const filePath of projectFiles) {
    // Skip excluded directories
    if (shouldExclude(filePath, excludeDirs)) continue;

    // Check extension filter
    const ext = getExtension(filePath);
    if (extensions.length > 0 && !extensions.includes(ext)) continue;

    const content = fileContents.get(filePath);
    if (!content) continue;

    const matches = content.matchAll(regex);
    const lineNumbers: number[] = [];
    let matchContext = '';

    for (const match of matches) {
      if (match.index !== undefined) {
        // Calculate line number
        const beforeMatch = content.slice(0, match.index);
        const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
        lineNumbers.push(lineNumber);

        // Get context (line containing the match)
        if (!matchContext) {
          const lines = content.split('\n');
          const contextLine = lines[lineNumber - 1] || '';
          matchContext = contextLine.trim().slice(0, 100);
        }
      }
    }

    if (lineNumbers.length > 0) {
      results.push({
        filePath,
        matchType: 'content',
        matchContext,
        lineNumbers,
        relevance: calculateRelevance(filePath, pattern, 'content'),
      });
    }

    if (results.length >= maxResults) break;
  }

  // Sort by relevance
  return results.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Search for files related to a concept/feature
 * Uses heuristics to find relevant files
 */
export function searchByRelatedConcept(
  concept: string,
  projectFiles: string[],
  options: SearchOptions = {}
): SearchResult[] {
  const keywords = extractKeywords(concept);
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // Search for each keyword
  for (const keyword of keywords) {
    const keywordResults = searchByFilename(keyword, projectFiles, {
      ...options,
      maxResults: 5,
    });

    for (const result of keywordResults) {
      if (!seen.has(result.filePath)) {
        seen.add(result.filePath);
        results.push(result);
      }
    }
  }

  // Also search for component-like patterns
  const componentPatterns = extractComponentPatterns(concept);
  for (const pattern of componentPatterns) {
    const patternResults = searchByFilename(pattern, projectFiles, {
      ...options,
      maxResults: 3,
    });

    for (const result of patternResults) {
      if (!seen.has(result.filePath)) {
        seen.add(result.filePath);
        results.push(result);
      }
    }
  }

  // Sort by relevance and limit
  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, options.maxResults || 20);
}

/**
 * Extract keywords from a natural language concept
 */
export function extractKeywords(concept: string): string[] {
  // Remove common words
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might',
    'can', 'need', 'want', 'please', 'add', 'create', 'make',
    'update', 'change', 'modify', 'fix', 'implement', 'build',
    'i', 'we', 'you', 'it', 'this', 'that', 'with',
  ]);

  // Extract words
  const words = concept
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  // Keep unique words
  return [...new Set(words)];
}

/**
 * Extract component-like patterns from concept
 */
function extractComponentPatterns(concept: string): string[] {
  const patterns: string[] = [];

  // Look for PascalCase words (likely component names)
  const pascalCase = concept.match(/[A-Z][a-z]+(?:[A-Z][a-z]+)*/g);
  if (pascalCase) {
    patterns.push(...pascalCase);
  }

  // Look for camelCase words
  const camelCase = concept.match(/[a-z]+(?:[A-Z][a-z]+)+/g);
  if (camelCase) {
    patterns.push(...camelCase);
  }

  return patterns;
}

/**
 * Find files that are likely related based on imports
 */
export function findRelatedByImports(
  filePath: string,
  fileContents: Map<string, string>,
  depth: number = 1
): string[] {
  const related = new Set<string>();
  const content = fileContents.get(filePath);
  if (!content) return [];

  // Extract import paths
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // Skip external modules
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue;

    // Resolve relative path
    let resolvedPath = importPath;
    if (importPath.startsWith('.')) {
      const dir = filePath.split('/').slice(0, -1).join('/');
      resolvedPath = resolvePath(dir, importPath);
    } else if (importPath.startsWith('@/')) {
      resolvedPath = importPath.replace('@/', 'src/');
    }

    // Try common extensions
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']) {
      const fullPath = resolvedPath + ext;
      if (fileContents.has(fullPath)) {
        related.add(fullPath);
        break;
      }
      // Also try without extension if already present
      if (fileContents.has(resolvedPath)) {
        related.add(resolvedPath);
        break;
      }
    }
  }

  // Recurse if depth > 1
  if (depth > 1) {
    const currentRelated = [...related];
    for (const relatedFile of currentRelated) {
      const deeperRelated = findRelatedByImports(relatedFile, fileContents, depth - 1);
      for (const file of deeperRelated) {
        related.add(file);
      }
    }
  }

  return [...related];
}

/**
 * Resolve a relative path
 */
function resolvePath(basePath: string, relativePath: string): string {
  const parts = basePath.split('/');
  const relParts = relativePath.split('/');

  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  return parts.join('/');
}

