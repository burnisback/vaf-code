/**
 * Monorepo Detector
 *
 * Detects monorepo structures including:
 * - npm/yarn/pnpm workspaces
 * - Lerna
 * - Turborepo
 * - Nx
 *
 * Provides package discovery and per-package verification support.
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export type MonorepoType = 'npm-workspaces' | 'yarn-workspaces' | 'pnpm-workspaces' | 'lerna' | 'turborepo' | 'nx' | 'none';

export interface MonorepoPackage {
  /** Package name from package.json */
  name: string;
  /** Relative path to package directory */
  path: string;
  /** Whether package has its own tsconfig.json */
  hasTsConfig: boolean;
  /** Whether package has its own package.json */
  hasPackageJson: boolean;
  /** Dependencies on other workspace packages */
  workspaceDependencies: string[];
}

export interface MonorepoInfo {
  /** Whether this is a monorepo */
  isMonorepo: boolean;
  /** Type of monorepo detected */
  type: MonorepoType;
  /** Root directory (usually '/') */
  rootDir: string;
  /** Workspace patterns from config */
  workspacePatterns: string[];
  /** Discovered packages */
  packages: MonorepoPackage[];
  /** Whether root has its own tsconfig.json */
  rootHasTsConfig: boolean;
  /** Whether using TypeScript project references */
  usesProjectReferences: boolean;
  /** Confidence score (0-1) */
  confidence: number;
}

export interface MonorepoDetectorConfig {
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

// =============================================================================
// MONOREPO DETECTOR CLASS
// =============================================================================

export class MonorepoDetector {
  private webcontainer: WebContainer;
  private config: MonorepoDetectorConfig;

  constructor(webcontainer: WebContainer, config: MonorepoDetectorConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = config;
  }

  /**
   * Detect monorepo structure
   */
  async detect(): Promise<MonorepoInfo> {
    this.config.onProgress?.('Detecting monorepo structure...');

    const result: MonorepoInfo = {
      isMonorepo: false,
      type: 'none',
      rootDir: '/',
      workspacePatterns: [],
      packages: [],
      rootHasTsConfig: false,
      usesProjectReferences: false,
      confidence: 0,
    };

    try {
      // Check for root tsconfig
      result.rootHasTsConfig = await this.fileExists('tsconfig.json');

      // Check for project references in root tsconfig
      if (result.rootHasTsConfig) {
        result.usesProjectReferences = await this.checkProjectReferences('tsconfig.json');
      }

      // Check various monorepo indicators in priority order
      const detectors = [
        this.detectNx.bind(this),
        this.detectTurborepo.bind(this),
        this.detectLerna.bind(this),
        this.detectPnpmWorkspaces.bind(this),
        this.detectNpmYarnWorkspaces.bind(this),
      ];

      for (const detector of detectors) {
        const detected = await detector();
        if (detected) {
          result.isMonorepo = true;
          result.type = detected.type;
          result.workspacePatterns = detected.patterns;
          result.confidence = detected.confidence;
          break;
        }
      }

      // Discover packages if monorepo detected
      if (result.isMonorepo && result.workspacePatterns.length > 0) {
        this.config.onProgress?.('Discovering workspace packages...');
        result.packages = await this.discoverPackages(result.workspacePatterns);
      }

    } catch (error) {
      console.warn('[MonorepoDetector] Error during detection:', error);
    }

    return result;
  }

  /**
   * Detect Nx monorepo
   */
  private async detectNx(): Promise<{ type: MonorepoType; patterns: string[]; confidence: number } | null> {
    if (await this.fileExists('nx.json')) {
      let patterns = ['packages/*', 'apps/*', 'libs/*'];

      try {
        const content = await this.readFile('nx.json');
        if (content) {
          const nxConfig = JSON.parse(content);
          // Nx can define workspaceLayout
          if (nxConfig.workspaceLayout) {
            patterns = [];
            if (nxConfig.workspaceLayout.appsDir) {
              patterns.push(`${nxConfig.workspaceLayout.appsDir}/*`);
            }
            if (nxConfig.workspaceLayout.libsDir) {
              patterns.push(`${nxConfig.workspaceLayout.libsDir}/*`);
            }
          }
        }
      } catch {
        // Use default patterns
      }

      return { type: 'nx', patterns, confidence: 0.95 };
    }
    return null;
  }

  /**
   * Detect Turborepo
   */
  private async detectTurborepo(): Promise<{ type: MonorepoType; patterns: string[]; confidence: number } | null> {
    if (await this.fileExists('turbo.json')) {
      // Turborepo uses npm/yarn/pnpm workspaces, check package.json
      const patterns = await this.getWorkspacePatternsFromPackageJson();
      if (patterns.length > 0) {
        return { type: 'turborepo', patterns, confidence: 0.95 };
      }
      return { type: 'turborepo', patterns: ['packages/*', 'apps/*'], confidence: 0.8 };
    }
    return null;
  }

  /**
   * Detect Lerna
   */
  private async detectLerna(): Promise<{ type: MonorepoType; patterns: string[]; confidence: number } | null> {
    if (await this.fileExists('lerna.json')) {
      let patterns = ['packages/*'];

      try {
        const content = await this.readFile('lerna.json');
        if (content) {
          const lernaConfig = JSON.parse(content);
          if (lernaConfig.packages && Array.isArray(lernaConfig.packages)) {
            patterns = lernaConfig.packages;
          }
        }
      } catch {
        // Use default patterns
      }

      return { type: 'lerna', patterns, confidence: 0.95 };
    }
    return null;
  }

  /**
   * Detect pnpm workspaces
   */
  private async detectPnpmWorkspaces(): Promise<{ type: MonorepoType; patterns: string[]; confidence: number } | null> {
    if (await this.fileExists('pnpm-workspace.yaml')) {
      let patterns = ['packages/*'];

      try {
        const content = await this.readFile('pnpm-workspace.yaml');
        if (content) {
          // Simple YAML parsing for packages
          const packagesMatch = content.match(/packages:\s*\n((?:\s+-\s*.+\n?)+)/);
          if (packagesMatch) {
            patterns = packagesMatch[1]
              .split('\n')
              .map(line => line.replace(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/, '$1').trim())
              .filter(Boolean);
          }
        }
      } catch {
        // Use default patterns
      }

      return { type: 'pnpm-workspaces', patterns, confidence: 0.95 };
    }
    return null;
  }

  /**
   * Detect npm/yarn workspaces from package.json
   */
  private async detectNpmYarnWorkspaces(): Promise<{ type: MonorepoType; patterns: string[]; confidence: number } | null> {
    const patterns = await this.getWorkspacePatternsFromPackageJson();
    if (patterns.length > 0) {
      // Determine if yarn or npm based on lock file
      const hasYarnLock = await this.fileExists('yarn.lock');
      const type = hasYarnLock ? 'yarn-workspaces' : 'npm-workspaces';
      return { type, patterns, confidence: 0.9 };
    }
    return null;
  }

  /**
   * Get workspace patterns from package.json
   */
  private async getWorkspacePatternsFromPackageJson(): Promise<string[]> {
    try {
      const content = await this.readFile('package.json');
      if (!content) return [];

      const packageJson = JSON.parse(content);

      // Check for workspaces field
      if (packageJson.workspaces) {
        if (Array.isArray(packageJson.workspaces)) {
          return packageJson.workspaces;
        }
        if (packageJson.workspaces.packages && Array.isArray(packageJson.workspaces.packages)) {
          return packageJson.workspaces.packages;
        }
      }
    } catch {
      // Invalid package.json
    }

    return [];
  }

  /**
   * Check if tsconfig uses project references
   */
  private async checkProjectReferences(tsconfigPath: string): Promise<boolean> {
    try {
      const content = await this.readFile(tsconfigPath);
      if (!content) return false;

      const tsconfig = JSON.parse(content);
      return Array.isArray(tsconfig.references) && tsconfig.references.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Discover packages matching workspace patterns
   */
  private async discoverPackages(patterns: string[]): Promise<MonorepoPackage[]> {
    const packages: MonorepoPackage[] = [];
    const discoveredPaths = new Set<string>();

    for (const pattern of patterns) {
      const matchedDirs = await this.expandPattern(pattern);

      for (const dir of matchedDirs) {
        if (discoveredPaths.has(dir)) continue;
        discoveredPaths.add(dir);

        const pkg = await this.analyzePackage(dir);
        if (pkg) {
          packages.push(pkg);
        }
      }
    }

    // Resolve workspace dependencies
    const packageNames = new Set(packages.map(p => p.name));
    for (const pkg of packages) {
      pkg.workspaceDependencies = pkg.workspaceDependencies.filter(dep => packageNames.has(dep));
    }

    return packages;
  }

  /**
   * Expand a glob pattern to matching directories
   */
  private async expandPattern(pattern: string): Promise<string[]> {
    const dirs: string[] = [];

    // Simple pattern expansion (supports * at end)
    if (pattern.endsWith('/*')) {
      const baseDir = pattern.slice(0, -2);
      try {
        const entries = await this.webcontainer.fs.readdir(baseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            dirs.push(`${baseDir}/${entry.name}`);
          }
        }
      } catch {
        // Directory doesn't exist
      }
    } else if (pattern.includes('**')) {
      // Recursive pattern - simplified handling
      const baseDir = pattern.split('**')[0].replace(/\/$/, '') || '/';
      await this.walkDirectories(baseDir, dirs, 2); // Max 2 levels deep
    } else {
      // Literal path
      if (await this.directoryExists(pattern)) {
        dirs.push(pattern);
      }
    }

    return dirs;
  }

  /**
   * Walk directories recursively
   */
  private async walkDirectories(dir: string, result: string[], maxDepth: number): Promise<void> {
    if (maxDepth <= 0) return;

    try {
      const entries = await this.webcontainer.fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
        result.push(fullPath);
        await this.walkDirectories(fullPath, result, maxDepth - 1);
      }
    } catch {
      // Directory can't be read
    }
  }

  /**
   * Analyze a package directory
   */
  private async analyzePackage(dir: string): Promise<MonorepoPackage | null> {
    const packageJsonPath = `${dir}/package.json`;
    const hasPackageJson = await this.fileExists(packageJsonPath);

    if (!hasPackageJson) {
      return null; // Not a package
    }

    try {
      const content = await this.readFile(packageJsonPath);
      if (!content) return null;

      const packageJson = JSON.parse(content);
      const hasTsConfig = await this.fileExists(`${dir}/tsconfig.json`);

      // Extract workspace dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
      };

      const workspaceDependencies: string[] = [];
      for (const [name, version] of Object.entries(allDeps)) {
        // Workspace dependencies typically have workspace: protocol or * version
        if (typeof version === 'string' &&
            (version.startsWith('workspace:') || version === '*' || version.startsWith('file:'))) {
          workspaceDependencies.push(name);
        }
      }

      return {
        name: packageJson.name || dir.split('/').pop() || dir,
        path: dir.replace(/^\//, ''),
        hasTsConfig,
        hasPackageJson: true,
        workspaceDependencies,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await this.webcontainer.fs.readFile(path, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      await this.webcontainer.fs.readdir(path);
      return true;
    } catch {
      return false;
    }
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
   * Get verification commands for each package
   */
  getPackageVerificationCommands(info: MonorepoInfo): Array<{ package: MonorepoPackage; command: string }> {
    const commands: Array<{ package: MonorepoPackage; command: string }> = [];

    for (const pkg of info.packages) {
      if (pkg.hasTsConfig) {
        // Use tsc --noEmit in the package directory
        commands.push({
          package: pkg,
          command: `cd ${pkg.path} && npx tsc --noEmit`,
        });
      }
    }

    return commands;
  }

  /**
   * Format monorepo info for display
   */
  formatInfo(info: MonorepoInfo): string {
    if (!info.isMonorepo) {
      return 'Not a monorepo (single package project).';
    }

    const lines = [
      `## Monorepo Detected: ${info.type}`,
      '',
      `**Packages:** ${info.packages.length}`,
      `**Uses Project References:** ${info.usesProjectReferences ? 'Yes' : 'No'}`,
      '',
      '### Workspace Patterns',
      ...info.workspacePatterns.map(p => `- ${p}`),
      '',
      '### Packages',
    ];

    for (const pkg of info.packages) {
      lines.push(`- **${pkg.name}** (${pkg.path})`);
      if (pkg.hasTsConfig) {
        lines.push('  - Has tsconfig.json');
      }
      if (pkg.workspaceDependencies.length > 0) {
        lines.push(`  - Depends on: ${pkg.workspaceDependencies.join(', ')}`);
      }
    }

    return lines.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a monorepo detector instance
 */
export function createMonorepoDetector(
  webcontainer: WebContainer,
  config?: MonorepoDetectorConfig
): MonorepoDetector {
  return new MonorepoDetector(webcontainer, config);
}

/**
 * Quick check if project is a monorepo
 */
export async function isMonorepo(webcontainer: WebContainer): Promise<boolean> {
  const detector = new MonorepoDetector(webcontainer);
  const info = await detector.detect();
  return info.isMonorepo;
}
