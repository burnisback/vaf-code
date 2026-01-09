/**
 * TypeScript Project References Handler
 *
 * Handles TypeScript projects that use project references (composite projects).
 * These require special handling:
 * - Use `tsc --build --noEmit` instead of `tsc --noEmit`
 * - May need to build in dependency order
 * - Can verify individual referenced projects
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export interface TsProjectReference {
  /** Path to the referenced tsconfig */
  path: string;
  /** Resolved absolute path */
  resolvedPath: string;
  /** Whether reference uses prepend option */
  prepend?: boolean;
}

export interface TsProjectInfo {
  /** Path to this tsconfig */
  configPath: string;
  /** Whether this is a composite project */
  isComposite: boolean;
  /** Whether this project uses project references */
  hasReferences: boolean;
  /** List of project references */
  references: TsProjectReference[];
  /** Include patterns */
  include: string[];
  /** Exclude patterns */
  exclude: string[];
  /** OutDir if specified */
  outDir?: string;
  /** RootDir if specified */
  rootDir?: string;
  /** Extended config if any */
  extends?: string;
}

export interface ProjectReferencesInfo {
  /** Root tsconfig path */
  rootConfig: string;
  /** Whether project uses references */
  usesReferences: boolean;
  /** Whether root is a solution-style tsconfig (references only, no files) */
  isSolutionStyle: boolean;
  /** All discovered project references */
  projects: TsProjectInfo[];
  /** Build order (topologically sorted) */
  buildOrder: string[];
  /** Recommended verification command */
  verifyCommand: string;
}

export interface TsProjectReferencesConfig {
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

// =============================================================================
// TS PROJECT REFERENCES HANDLER CLASS
// =============================================================================

export class TsProjectReferencesHandler {
  private webcontainer: WebContainer;
  private config: TsProjectReferencesConfig;

  constructor(webcontainer: WebContainer, config: TsProjectReferencesConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = config;
  }

  /**
   * Analyze the project for TypeScript project references
   */
  async analyze(rootConfigPath = 'tsconfig.json'): Promise<ProjectReferencesInfo> {
    this.config.onProgress?.('Analyzing TypeScript project structure...');

    const result: ProjectReferencesInfo = {
      rootConfig: rootConfigPath,
      usesReferences: false,
      isSolutionStyle: false,
      projects: [],
      buildOrder: [],
      verifyCommand: 'npx tsc --noEmit',
    };

    try {
      // Parse root tsconfig
      const rootInfo = await this.parseProjectConfig(rootConfigPath);
      if (!rootInfo) {
        return result;
      }

      result.projects.push(rootInfo);
      result.usesReferences = rootInfo.hasReferences;

      // Check if solution-style (no files, only references)
      if (rootInfo.hasReferences && rootInfo.include.length === 0) {
        result.isSolutionStyle = true;
      }

      // Recursively discover all referenced projects
      if (rootInfo.hasReferences) {
        this.config.onProgress?.('Discovering referenced projects...');
        await this.discoverReferences(rootInfo, result.projects);

        // Compute build order
        result.buildOrder = this.computeBuildOrder(result.projects);

        // Set appropriate verify command
        result.verifyCommand = 'npx tsc --build --noEmit';
      }

    } catch (error) {
      console.warn('[TsProjectReferencesHandler] Analysis error:', error);
    }

    return result;
  }

  /**
   * Parse a tsconfig.json file
   */
  private async parseProjectConfig(configPath: string): Promise<TsProjectInfo | null> {
    try {
      const content = await this.readFile(configPath);
      if (!content) return null;

      const config = JSON.parse(content);

      const info: TsProjectInfo = {
        configPath,
        isComposite: config.compilerOptions?.composite === true,
        hasReferences: Array.isArray(config.references) && config.references.length > 0,
        references: [],
        include: config.include || [],
        exclude: config.exclude || [],
        outDir: config.compilerOptions?.outDir,
        rootDir: config.compilerOptions?.rootDir,
        extends: config.extends,
      };

      // Parse references
      if (config.references && Array.isArray(config.references)) {
        for (const ref of config.references) {
          const refPath = typeof ref === 'string' ? ref : ref.path;
          if (refPath) {
            info.references.push({
              path: refPath,
              resolvedPath: this.resolvePath(configPath, refPath),
              prepend: typeof ref === 'object' ? ref.prepend : undefined,
            });
          }
        }
      }

      return info;
    } catch {
      return null;
    }
  }

  /**
   * Recursively discover all referenced projects
   */
  private async discoverReferences(
    project: TsProjectInfo,
    allProjects: TsProjectInfo[],
    visited = new Set<string>()
  ): Promise<void> {
    for (const ref of project.references) {
      if (visited.has(ref.resolvedPath)) continue;
      visited.add(ref.resolvedPath);

      const refProject = await this.parseProjectConfig(ref.resolvedPath);
      if (refProject) {
        allProjects.push(refProject);

        // Recurse into nested references
        if (refProject.hasReferences) {
          await this.discoverReferences(refProject, allProjects, visited);
        }
      }
    }
  }

  /**
   * Compute build order using topological sort
   */
  private computeBuildOrder(projects: TsProjectInfo[]): string[] {
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    // Initialize
    for (const project of projects) {
      graph.set(project.configPath, new Set());
      inDegree.set(project.configPath, 0);
    }

    // Build dependency graph
    for (const project of projects) {
      for (const ref of project.references) {
        // project depends on ref.resolvedPath
        const deps = graph.get(ref.resolvedPath);
        if (deps) {
          deps.add(project.configPath);
          inDegree.set(project.configPath, (inDegree.get(project.configPath) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const result: string[] = [];

    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      for (const dependent of graph.get(node) || []) {
        const newDegree = (inDegree.get(dependent) || 1) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    return result;
  }

  /**
   * Verify the project using appropriate command
   */
  async verify(info: ProjectReferencesInfo): Promise<{
    success: boolean;
    command: string;
    output: string;
    errors: Array<{ project: string; message: string; line?: number; file?: string }>;
  }> {
    this.config.onProgress?.(`Running: ${info.verifyCommand}`);

    try {
      const process = await this.webcontainer.spawn('npx',
        info.usesReferences
          ? ['tsc', '--build', '--noEmit', '--pretty', 'false']
          : ['tsc', '--noEmit', '--pretty', 'false']
      );

      let output = '';
      const errors: Array<{ project: string; message: string; line?: number; file?: string }> = [];

      // Collect output
      const outputPromise = new Promise<void>((resolve) => {
        process.output.pipeTo(new WritableStream({
          write(chunk) {
            output += chunk;
          },
          close() {
            resolve();
          },
        }));
      });

      const exitCode = await process.exit;
      await outputPromise;

      // Parse errors
      const errorPattern = /^(.+?)\((\d+),\d+\):\s+error\s+(TS\d+):\s+(.+)$/gm;
      let match;

      while ((match = errorPattern.exec(output)) !== null) {
        const file = match[1];
        const line = parseInt(match[2]);
        const code = match[3];
        const message = match[4];

        // Determine which project this file belongs to
        const project = this.findProjectForFile(file, info.projects);

        errors.push({
          project: project?.configPath || 'unknown',
          file,
          line,
          message: `${code}: ${message}`,
        });
      }

      return {
        success: exitCode === 0,
        command: info.verifyCommand,
        output,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        command: info.verifyCommand,
        output: error instanceof Error ? error.message : String(error),
        errors: [{ project: 'root', message: 'Failed to run TypeScript compiler' }],
      };
    }
  }

  /**
   * Verify a single project in isolation
   */
  async verifySingleProject(projectPath: string): Promise<{
    success: boolean;
    output: string;
    errorCount: number;
  }> {
    try {
      // Get directory of tsconfig
      const dir = projectPath.replace(/\/tsconfig\.json$/, '') || '.';

      const process = await this.webcontainer.spawn('sh', [
        '-c',
        `cd ${dir} && npx tsc --noEmit --pretty false`,
      ]);

      let output = '';
      const outputPromise = new Promise<void>((resolve) => {
        process.output.pipeTo(new WritableStream({
          write(chunk) {
            output += chunk;
          },
          close() {
            resolve();
          },
        }));
      });

      const exitCode = await process.exit;
      await outputPromise;

      // Count errors
      const errorCount = (output.match(/error TS\d+:/g) || []).length;

      return {
        success: exitCode === 0,
        output,
        errorCount,
      };
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : String(error),
        errorCount: 1,
      };
    }
  }

  /**
   * Find which project a file belongs to
   */
  private findProjectForFile(filePath: string, projects: TsProjectInfo[]): TsProjectInfo | null {
    // Normalize path
    const normalized = filePath.replace(/\\/g, '/');

    for (const project of projects) {
      const projectDir = project.configPath.replace(/\/tsconfig\.json$/, '');
      if (normalized.startsWith(projectDir)) {
        return project;
      }
    }

    return null;
  }

  /**
   * Resolve a relative path from a config file
   */
  private resolvePath(configPath: string, relativePath: string): string {
    const configDir = configPath.replace(/\/[^/]+$/, '');
    const resolved = `${configDir}/${relativePath}`.replace(/\/\.\//g, '/');

    // Normalize path
    const parts = resolved.split('/');
    const result: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        result.pop();
      } else if (part !== '.' && part !== '') {
        result.push(part);
      }
    }

    let finalPath = result.join('/');

    // Add tsconfig.json if path is a directory
    if (!finalPath.endsWith('.json')) {
      finalPath = `${finalPath}/tsconfig.json`;
    }

    return finalPath;
  }

  /**
   * Read file content
   */
  private async readFile(path: string): Promise<string | null> {
    try {
      return await this.webcontainer.fs.readFile(path, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Format project references info for display
   */
  formatInfo(info: ProjectReferencesInfo): string {
    if (!info.usesReferences) {
      return 'Standard TypeScript project (no project references).';
    }

    const lines = [
      '## TypeScript Project References',
      '',
      `**Root Config:** ${info.rootConfig}`,
      `**Solution Style:** ${info.isSolutionStyle ? 'Yes' : 'No'}`,
      `**Projects:** ${info.projects.length}`,
      '',
      '### Build Order',
      ...info.buildOrder.map((p, i) => `${i + 1}. ${p}`),
      '',
      `### Verify Command`,
      '```',
      info.verifyCommand,
      '```',
    ];

    return lines.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a TS project references handler
 */
export function createTsProjectReferencesHandler(
  webcontainer: WebContainer,
  config?: TsProjectReferencesConfig
): TsProjectReferencesHandler {
  return new TsProjectReferencesHandler(webcontainer, config);
}

/**
 * Quick check if project uses references
 */
export async function usesProjectReferences(webcontainer: WebContainer): Promise<boolean> {
  const handler = new TsProjectReferencesHandler(webcontainer);
  const info = await handler.analyze();
  return info.usesReferences;
}

/**
 * Get appropriate tsc command for the project
 */
export async function getTscCommand(webcontainer: WebContainer): Promise<string> {
  const handler = new TsProjectReferencesHandler(webcontainer);
  const info = await handler.analyze();
  return info.verifyCommand;
}
