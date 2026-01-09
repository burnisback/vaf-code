/**
 * Circular Dependency Detector
 *
 * Detects circular imports in the codebase that can cause:
 * - Undefined exports at runtime
 * - Initialization order issues
 * - Hard-to-debug runtime errors
 *
 * Uses graph traversal to find cycles in the import graph.
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export interface ImportInfo {
  /** Path being imported */
  importPath: string;
  /** Resolved absolute path */
  resolvedPath: string;
  /** Line number of import */
  line: number;
  /** Type of import */
  type: 'static' | 'dynamic' | 'require';
  /** Named imports if any */
  namedImports: string[];
}

export interface FileNode {
  /** File path */
  path: string;
  /** Imports from this file */
  imports: ImportInfo[];
  /** Files that import this file */
  importedBy: string[];
}

export interface CircularChain {
  /** Files involved in the cycle */
  files: string[];
  /** The import that completes the cycle */
  closingImport: ImportInfo;
  /** Severity: 'warning' for dynamic imports, 'error' for static */
  severity: 'warning' | 'error';
  /** Description of the cycle */
  description: string;
}

export interface CircularDependencyResult {
  /** Whether any circular dependencies were found */
  hasCircular: boolean;
  /** Number of cycles found */
  cycleCount: number;
  /** Detected circular chains */
  cycles: CircularChain[];
  /** All files in the dependency graph */
  files: FileNode[];
  /** Files that couldn't be parsed */
  parseErrors: Array<{ file: string; error: string }>;
  /** Time taken to analyze */
  analysisTime: number;
}

export interface CircularDependencyDetectorConfig {
  /** Root directory to scan */
  rootDir?: string;
  /** File extensions to analyze */
  extensions?: string[];
  /** Directories to skip */
  skipDirs?: string[];
  /** Whether to analyze node_modules */
  analyzeNodeModules?: boolean;
  /** Maximum depth for cycle detection */
  maxDepth?: number;
  /** Progress callback */
  onProgress?: (message: string) => void;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const DEFAULT_SKIP_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage'];

// =============================================================================
// CIRCULAR DEPENDENCY DETECTOR CLASS
// =============================================================================

export class CircularDependencyDetector {
  private webcontainer: WebContainer;
  private config: Required<CircularDependencyDetectorConfig>;
  private fileGraph: Map<string, FileNode> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor(webcontainer: WebContainer, config: CircularDependencyDetectorConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = {
      rootDir: config.rootDir || '',
      extensions: config.extensions || DEFAULT_EXTENSIONS,
      skipDirs: config.skipDirs || DEFAULT_SKIP_DIRS,
      analyzeNodeModules: config.analyzeNodeModules || false,
      maxDepth: config.maxDepth || 50,
      onProgress: config.onProgress || (() => {}),
    };
  }

  /**
   * Detect circular dependencies
   */
  async detect(): Promise<CircularDependencyResult> {
    const startTime = Date.now();

    const result: CircularDependencyResult = {
      hasCircular: false,
      cycleCount: 0,
      cycles: [],
      files: [],
      parseErrors: [],
      analysisTime: 0,
    };

    try {
      // Load alias configuration
      this.config.onProgress?.('Loading path aliases...');
      await this.loadAliases();

      // Build file graph
      this.config.onProgress?.('Building dependency graph...');
      await this.buildGraph();

      // Detect cycles
      this.config.onProgress?.('Detecting circular dependencies...');
      result.cycles = this.findCycles();
      result.hasCircular = result.cycles.length > 0;
      result.cycleCount = result.cycles.length;

      // Collect file nodes
      result.files = Array.from(this.fileGraph.values());

    } catch (error) {
      console.warn('[CircularDependencyDetector] Detection error:', error);
    }

    result.analysisTime = Date.now() - startTime;
    return result;
  }

  /**
   * Load path aliases from tsconfig or jsconfig
   */
  private async loadAliases(): Promise<void> {
    for (const configFile of ['tsconfig.json', 'jsconfig.json']) {
      try {
        const content = await this.webcontainer.fs.readFile(configFile, 'utf-8');
        const config = JSON.parse(content);

        if (config.compilerOptions?.paths) {
          for (const [alias, paths] of Object.entries(config.compilerOptions.paths)) {
            if (Array.isArray(paths) && paths.length > 0) {
              // Convert '@/*' to '@/' pattern
              const aliasPattern = alias.replace('/*', '/');
              const targetPattern = (paths[0] as string).replace('/*', '/');
              this.aliasMap.set(aliasPattern, targetPattern);
            }
          }
        }

        if (config.compilerOptions?.baseUrl) {
          this.aliasMap.set('./', config.compilerOptions.baseUrl + '/');
        }

        break; // Found config, stop looking
      } catch {
        // Config doesn't exist
      }
    }
  }

  /**
   * Build the dependency graph
   */
  private async buildGraph(): Promise<void> {
    const files = await this.getSourceFiles();

    for (const file of files) {
      const node = await this.analyzeFile(file);
      if (node) {
        this.fileGraph.set(file, node);
      }
    }

    // Build reverse references (importedBy)
    for (const [filePath, node] of this.fileGraph) {
      for (const imp of node.imports) {
        const targetNode = this.fileGraph.get(imp.resolvedPath);
        if (targetNode && !targetNode.importedBy.includes(filePath)) {
          targetNode.importedBy.push(filePath);
        }
      }
    }
  }

  /**
   * Get all source files
   */
  private async getSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    const rootDir = this.config.rootDir || '/';

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await this.webcontainer.fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;

          // Skip excluded directories
          if (this.config.skipDirs.includes(entry.name)) continue;
          if (entry.name.startsWith('.')) continue;

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (this.isSourceFile(entry.name)) {
            files.push(fullPath.replace(/^\//, ''));
          }
        }
      } catch {
        // Can't read directory
      }
    };

    await walk(rootDir);
    return files;
  }

  /**
   * Check if file is a source file
   */
  private isSourceFile(filename: string): boolean {
    return this.config.extensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Analyze a single file for imports
   */
  private async analyzeFile(filePath: string): Promise<FileNode | null> {
    try {
      const content = await this.webcontainer.fs.readFile(filePath, 'utf-8');

      const node: FileNode = {
        path: filePath,
        imports: [],
        importedBy: [],
      };

      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const imports = this.parseImportsFromLine(line, lineNum + 1, filePath);
        node.imports.push(...imports);
      }

      return node;
    } catch {
      return null;
    }
  }

  /**
   * Parse imports from a line of code
   */
  private parseImportsFromLine(line: string, lineNum: number, currentFile: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // Static imports: import X from './path'
    const staticImportPattern = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*\s*from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = staticImportPattern.exec(line)) !== null) {
      const importPath = match[1];
      if (this.isLocalImport(importPath)) {
        const resolved = this.resolvePath(currentFile, importPath);
        if (resolved) {
          imports.push({
            importPath,
            resolvedPath: resolved,
            line: lineNum,
            type: 'static',
            namedImports: this.extractNamedImports(match[0]),
          });
        }
      }
    }

    // Dynamic imports: import('./path')
    const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportPattern.exec(line)) !== null) {
      const importPath = match[1];
      if (this.isLocalImport(importPath)) {
        const resolved = this.resolvePath(currentFile, importPath);
        if (resolved) {
          imports.push({
            importPath,
            resolvedPath: resolved,
            line: lineNum,
            type: 'dynamic',
            namedImports: [],
          });
        }
      }
    }

    // Require: require('./path')
    const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requirePattern.exec(line)) !== null) {
      const importPath = match[1];
      if (this.isLocalImport(importPath)) {
        const resolved = this.resolvePath(currentFile, importPath);
        if (resolved) {
          imports.push({
            importPath,
            resolvedPath: resolved,
            line: lineNum,
            type: 'require',
            namedImports: [],
          });
        }
      }
    }

    return imports;
  }

  /**
   * Check if import is local (not from node_modules)
   */
  private isLocalImport(importPath: string): boolean {
    if (importPath.startsWith('.')) return true;
    if (importPath.startsWith('@/') || importPath.startsWith('~/')) return true;
    if (importPath.startsWith('src/')) return true;

    // Check aliases
    for (const alias of this.aliasMap.keys()) {
      if (importPath.startsWith(alias)) return true;
    }

    return false;
  }

  /**
   * Resolve import path to absolute path
   */
  private resolvePath(fromFile: string, importPath: string): string | null {
    let resolved: string;

    // Handle aliases
    for (const [alias, target] of this.aliasMap) {
      if (importPath.startsWith(alias)) {
        importPath = importPath.replace(alias, target);
        break;
      }
    }

    if (importPath.startsWith('.')) {
      // Relative import
      const fromDir = fromFile.replace(/\/[^/]+$/, '');
      resolved = this.normalizePath(`${fromDir}/${importPath}`);
    } else {
      // Absolute import (from src/ or aliased)
      resolved = importPath.replace(/^\//, '');
    }

    // Try adding extensions
    for (const ext of this.config.extensions) {
      const withExt = resolved.endsWith(ext) ? resolved : `${resolved}${ext}`;
      if (this.fileGraph.has(withExt) || this.fileExists(withExt)) {
        return withExt;
      }
    }

    // Try index files
    for (const ext of this.config.extensions) {
      const indexPath = `${resolved}/index${ext}`;
      if (this.fileGraph.has(indexPath) || this.fileExists(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Check if file exists (sync check against graph)
   */
  private fileExists(path: string): boolean {
    return this.fileGraph.has(path);
  }

  /**
   * Normalize a file path
   */
  private normalizePath(path: string): string {
    const parts = path.split('/');
    const result: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        result.pop();
      } else if (part !== '.' && part !== '') {
        result.push(part);
      }
    }

    return result.join('/');
  }

  /**
   * Extract named imports from import statement
   */
  private extractNamedImports(statement: string): string[] {
    const match = statement.match(/\{([^}]+)\}/);
    if (!match) return [];

    return match[1]
      .split(',')
      .map(s => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
  }

  /**
   * Find cycles using DFS
   */
  private findCycles(): CircularChain[] {
    const cycles: CircularChain[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];

    const dfs = (node: string): void => {
      if (inStack.has(node)) {
        // Found a cycle
        const cycleStart = stack.indexOf(node);
        const cycleFiles = stack.slice(cycleStart);
        cycleFiles.push(node);

        // Get the closing import
        const lastFile = cycleFiles[cycleFiles.length - 2];
        const lastNode = this.fileGraph.get(lastFile);
        const closingImport = lastNode?.imports.find(imp =>
          imp.resolvedPath === node
        );

        if (closingImport) {
          const severity = closingImport.type === 'dynamic' ? 'warning' : 'error';
          cycles.push({
            files: cycleFiles,
            closingImport,
            severity,
            description: this.describeCycle(cycleFiles, closingImport),
          });
        }
        return;
      }

      if (visited.has(node)) return;
      visited.add(node);
      inStack.add(node);
      stack.push(node);

      const fileNode = this.fileGraph.get(node);
      if (fileNode) {
        for (const imp of fileNode.imports) {
          if (this.fileGraph.has(imp.resolvedPath)) {
            dfs(imp.resolvedPath);
          }
        }
      }

      stack.pop();
      inStack.delete(node);
    };

    // Run DFS from each unvisited node
    for (const file of this.fileGraph.keys()) {
      if (!visited.has(file)) {
        dfs(file);
      }
    }

    // Deduplicate cycles (same cycle can be found from different starting points)
    const uniqueCycles = this.deduplicateCycles(cycles);

    return uniqueCycles;
  }

  /**
   * Remove duplicate cycles
   */
  private deduplicateCycles(cycles: CircularChain[]): CircularChain[] {
    const seen = new Set<string>();
    const unique: CircularChain[] = [];

    for (const cycle of cycles) {
      // Create a canonical representation of the cycle
      const sorted = [...cycle.files.slice(0, -1)].sort();
      const key = sorted.join('|');

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(cycle);
      }
    }

    return unique;
  }

  /**
   * Create description for a cycle
   */
  private describeCycle(files: string[], closingImport: ImportInfo): string {
    const chain = files.join(' → ');
    const importType = closingImport.type === 'dynamic' ? 'dynamic import' : 'static import';
    return `Circular dependency detected via ${importType}:\n${chain}`;
  }

  /**
   * Format result for display
   */
  formatResult(result: CircularDependencyResult): string {
    const lines: string[] = ['## Circular Dependency Analysis', ''];

    if (!result.hasCircular) {
      lines.push('✅ No circular dependencies detected.');
      lines.push('');
      lines.push(`Analyzed ${result.files.length} files in ${result.analysisTime}ms.`);
      return lines.join('\n');
    }

    lines.push(`❌ Found ${result.cycleCount} circular dependency cycle(s).`);
    lines.push('');

    // Group by severity
    const errors = result.cycles.filter(c => c.severity === 'error');
    const warnings = result.cycles.filter(c => c.severity === 'warning');

    if (errors.length > 0) {
      lines.push('### Static Import Cycles (Critical)');
      lines.push('These can cause undefined exports at runtime.');
      lines.push('');

      for (const cycle of errors.slice(0, 5)) {
        lines.push('```');
        lines.push(cycle.files.join('\n  → '));
        lines.push('```');
        lines.push('');
      }

      if (errors.length > 5) {
        lines.push(`... and ${errors.length - 5} more`);
        lines.push('');
      }
    }

    if (warnings.length > 0) {
      lines.push('### Dynamic Import Cycles (Warning)');
      lines.push('These are less critical but may indicate architectural issues.');
      lines.push('');

      for (const cycle of warnings.slice(0, 3)) {
        lines.push('```');
        lines.push(cycle.files.join('\n  → '));
        lines.push('```');
        lines.push('');
      }

      if (warnings.length > 3) {
        lines.push(`... and ${warnings.length - 3} more`);
        lines.push('');
      }
    }

    lines.push('### Recommendations');
    lines.push('1. Extract shared dependencies to a separate module');
    lines.push('2. Use dependency injection');
    lines.push('3. Restructure imports to break the cycle');

    return lines.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a circular dependency detector
 */
export function createCircularDependencyDetector(
  webcontainer: WebContainer,
  config?: CircularDependencyDetectorConfig
): CircularDependencyDetector {
  return new CircularDependencyDetector(webcontainer, config);
}

/**
 * Quick check for circular dependencies
 */
export async function hasCircularDependencies(webcontainer: WebContainer): Promise<boolean> {
  const detector = new CircularDependencyDetector(webcontainer);
  const result = await detector.detect();
  return result.hasCircular;
}

/**
 * Get circular dependencies with critical severity
 */
export async function getCriticalCircularDependencies(
  webcontainer: WebContainer
): Promise<CircularChain[]> {
  const detector = new CircularDependencyDetector(webcontainer);
  const result = await detector.detect();
  return result.cycles.filter(c => c.severity === 'error');
}
