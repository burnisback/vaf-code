/**
 * Package Manager Detector
 *
 * Detects the package manager used in a project (npm, yarn, pnpm)
 * and provides appropriate command prefixes.
 *
 * Detection priority:
 * 1. Lock files (most reliable)
 * 2. packageManager field in package.json
 * 3. Workspace configuration
 * 4. Default to npm
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export enum PackageManager {
  NPM = 'npm',
  YARN = 'yarn',
  PNPM = 'pnpm',
  BUN = 'bun',
}

export interface PackageManagerInfo {
  /** Detected package manager */
  manager: PackageManager;
  /** Version if detected */
  version?: string;
  /** Lock file found */
  lockFile?: string;
  /** Whether workspaces are used */
  usesWorkspaces: boolean;
  /** Workspace root (for monorepos) */
  workspaceRoot?: string;
}

export interface PackageManagerCommands {
  /** Run a script: npm run X / yarn X / pnpm X */
  run: (script: string) => string[];
  /** Execute a package: npx X / yarn dlx X / pnpm dlx X */
  exec: (pkg: string, args?: string[]) => string[];
  /** Install dependencies */
  install: () => string[];
  /** Add a dependency */
  add: (pkg: string, dev?: boolean) => string[];
  /** Remove a dependency */
  remove: (pkg: string) => string[];
}

export interface PackageManagerDetectorConfig {
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

// =============================================================================
// LOCK FILE PATTERNS
// =============================================================================

const LOCK_FILES: Record<PackageManager, string[]> = {
  [PackageManager.NPM]: ['package-lock.json', 'npm-shrinkwrap.json'],
  [PackageManager.YARN]: ['yarn.lock'],
  [PackageManager.PNPM]: ['pnpm-lock.yaml'],
  [PackageManager.BUN]: ['bun.lockb'],
};

// =============================================================================
// PACKAGE MANAGER DETECTOR CLASS
// =============================================================================

export class PackageManagerDetector {
  private webcontainer: WebContainer;
  private config: PackageManagerDetectorConfig;
  private detected: PackageManagerInfo | null = null;

  constructor(webcontainer: WebContainer, config: PackageManagerDetectorConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = config;
  }

  /**
   * Detect the package manager used in the project
   */
  async detect(): Promise<PackageManagerInfo> {
    if (this.detected) return this.detected;

    this.config.onProgress?.('[PackageManager] Detecting package manager...');

    let manager: PackageManager = PackageManager.NPM;
    let lockFile: string | undefined;
    let version: string | undefined;
    let usesWorkspaces = false;

    // 1. Check for lock files (most reliable)
    for (const [pm, files] of Object.entries(LOCK_FILES)) {
      for (const file of files) {
        if (await this.fileExists(file)) {
          manager = pm as PackageManager;
          lockFile = file;
          this.config.onProgress?.(`[PackageManager] Detected ${pm} (lock file: ${file})`);
          break;
        }
      }
      if (lockFile) break;
    }

    // 2. Check packageManager field in package.json
    try {
      const packageJson = await this.webcontainer.fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);

      // Check packageManager field (e.g., "pnpm@8.6.0")
      if (pkg.packageManager) {
        const match = pkg.packageManager.match(/^(npm|yarn|pnpm|bun)@?([\d.]*)/);
        if (match) {
          const pmFromField = match[1].toLowerCase() as PackageManager;
          // Only override if no lock file found or it matches
          if (!lockFile || pmFromField === manager) {
            manager = pmFromField;
            version = match[2] || undefined;
            this.config.onProgress?.(
              `[PackageManager] Detected ${manager} from packageManager field${version ? ` (v${version})` : ''}`
            );
          }
        }
      }

      // 3. Check for workspaces
      if (pkg.workspaces) {
        usesWorkspaces = true;
        this.config.onProgress?.('[PackageManager] Project uses workspaces');
      }
    } catch {
      // No package.json or can't parse
    }

    // 4. Check for pnpm-workspace.yaml
    if (await this.fileExists('pnpm-workspace.yaml')) {
      manager = PackageManager.PNPM;
      usesWorkspaces = true;
      this.config.onProgress?.('[PackageManager] Detected pnpm workspaces');
    }

    this.detected = {
      manager,
      version,
      lockFile,
      usesWorkspaces,
    };

    return this.detected;
  }

  /**
   * Get commands for the detected package manager
   */
  async getCommands(): Promise<PackageManagerCommands> {
    const info = await this.detect();
    return this.getCommandsForManager(info.manager);
  }

  /**
   * Get commands for a specific package manager
   */
  getCommandsForManager(manager: PackageManager): PackageManagerCommands {
    switch (manager) {
      case PackageManager.YARN:
        return {
          run: (script) => ['yarn', script],
          exec: (pkg, args = []) => ['yarn', 'dlx', pkg, ...args],
          install: () => ['yarn', 'install'],
          add: (pkg, dev = false) => dev ? ['yarn', 'add', '-D', pkg] : ['yarn', 'add', pkg],
          remove: (pkg) => ['yarn', 'remove', pkg],
        };

      case PackageManager.PNPM:
        return {
          run: (script) => ['pnpm', 'run', script],
          exec: (pkg, args = []) => ['pnpm', 'dlx', pkg, ...args],
          install: () => ['pnpm', 'install'],
          add: (pkg, dev = false) => dev ? ['pnpm', 'add', '-D', pkg] : ['pnpm', 'add', pkg],
          remove: (pkg) => ['pnpm', 'remove', pkg],
        };

      case PackageManager.BUN:
        return {
          run: (script) => ['bun', 'run', script],
          exec: (pkg, args = []) => ['bunx', pkg, ...args],
          install: () => ['bun', 'install'],
          add: (pkg, dev = false) => dev ? ['bun', 'add', '-d', pkg] : ['bun', 'add', pkg],
          remove: (pkg) => ['bun', 'remove', pkg],
        };

      case PackageManager.NPM:
      default:
        return {
          run: (script) => ['npm', 'run', script],
          exec: (pkg, args = []) => ['npx', pkg, ...args],
          install: () => ['npm', 'install'],
          add: (pkg, dev = false) => dev ? ['npm', 'install', '-D', pkg] : ['npm', 'install', pkg],
          remove: (pkg) => ['npm', 'uninstall', pkg],
        };
    }
  }

  /**
   * Get the build command
   */
  async getBuildCommand(): Promise<string[]> {
    const commands = await this.getCommands();
    return commands.run('build');
  }

  /**
   * Get the dev command
   */
  async getDevCommand(): Promise<string[]> {
    const commands = await this.getCommands();

    // Check if dev or start script exists
    try {
      const packageJson = await this.webcontainer.fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);
      if (pkg.scripts?.dev) {
        return commands.run('dev');
      }
      if (pkg.scripts?.start) {
        return commands.run('start');
      }
    } catch {
      // Default to dev
    }

    return commands.run('dev');
  }

  /**
   * Get the test command
   */
  async getTestCommand(): Promise<string[]> {
    const commands = await this.getCommands();
    return commands.run('test');
  }

  /**
   * Get the lint command
   */
  async getLintCommand(): Promise<string[]> {
    const commands = await this.getCommands();
    return commands.run('lint');
  }

  /**
   * Get the exec command for a package
   */
  async getExecCommand(pkg: string, args: string[] = []): Promise<string[]> {
    const commands = await this.getCommands();
    return commands.exec(pkg, args);
  }

  /**
   * Check if a file exists
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
   * Reset detected state
   */
  reset(): void {
    this.detected = null;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a package manager detector
 */
export function createPackageManagerDetector(
  webcontainer: WebContainer,
  config?: PackageManagerDetectorConfig
): PackageManagerDetector {
  return new PackageManagerDetector(webcontainer, config);
}

/**
 * Quick detect package manager
 */
export async function detectPackageManager(webcontainer: WebContainer): Promise<PackageManager> {
  const detector = new PackageManagerDetector(webcontainer);
  const info = await detector.detect();
  return info.manager;
}

/**
 * Get package manager commands
 */
export async function getPackageManagerCommands(
  webcontainer: WebContainer
): Promise<PackageManagerCommands> {
  const detector = new PackageManagerDetector(webcontainer);
  return detector.getCommands();
}

/**
 * Get the run script command for detected package manager
 */
export async function getRunCommand(
  webcontainer: WebContainer,
  script: string
): Promise<string[]> {
  const detector = new PackageManagerDetector(webcontainer);
  const commands = await detector.getCommands();
  return commands.run(script);
}
