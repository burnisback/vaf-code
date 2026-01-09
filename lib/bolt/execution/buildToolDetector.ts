/**
 * Build Tool Detector
 *
 * Detects the build tool used in a project and provides appropriate
 * build commands and error parsing strategies.
 *
 * Supports:
 * - Vite
 * - Webpack
 * - esbuild
 * - swc
 * - Rollup
 * - Parcel
 * - Next.js
 * - Create React App (react-scripts)
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export enum BuildTool {
  VITE = 'vite',
  WEBPACK = 'webpack',
  ESBUILD = 'esbuild',
  SWC = 'swc',
  ROLLUP = 'rollup',
  PARCEL = 'parcel',
  NEXTJS = 'next',
  REMIX = 'remix',
  ASTRO = 'astro',
  NUXT = 'nuxt',
  SVELTEKIT = 'sveltekit',
  CRA = 'react-scripts',
  TSC = 'tsc',
  UNKNOWN = 'unknown',
}

export interface BuildToolConfig {
  /** Detected build tool */
  tool: BuildTool;
  /** Build command to run */
  buildCommand: string[];
  /** Type check command (if applicable) */
  typeCheckCommand?: string[];
  /** Dev server command */
  devCommand: string[];
  /** Config file path */
  configFile?: string;
  /** Whether tool supports HMR */
  supportsHMR: boolean;
  /** Error patterns specific to this tool */
  errorPatterns: RegExp[];
}

export interface BuildToolError {
  /** Tool that produced the error */
  tool: BuildTool;
  /** Error type/category */
  type: 'syntax' | 'type' | 'import' | 'config' | 'runtime' | 'unknown';
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Error message */
  message: string;
  /** Error code if available */
  code?: string;
}

export interface BuildToolDetectorConfig {
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

// =============================================================================
// TOOL CONFIGURATIONS
// =============================================================================

const TOOL_CONFIGS: Record<BuildTool, Partial<BuildToolConfig>> = {
  [BuildTool.VITE]: {
    buildCommand: ['npx', 'vite', 'build'],
    devCommand: ['npx', 'vite', '--host'],
    typeCheckCommand: ['npx', 'tsc', '--noEmit'],
    supportsHMR: true,
    errorPatterns: [
      /\[vite\].*error/i,
      /Build failed/i,
      /✗.*error/i,
    ],
  },
  [BuildTool.WEBPACK]: {
    buildCommand: ['npx', 'webpack', '--mode', 'production'],
    devCommand: ['npx', 'webpack', 'serve', '--mode', 'development'],
    supportsHMR: true,
    errorPatterns: [
      /Module build failed/i,
      /ERROR in/i,
      /webpack.*error/i,
    ],
  },
  [BuildTool.ESBUILD]: {
    buildCommand: ['npx', 'esbuild', 'src/index.ts', '--bundle', '--outfile=dist/index.js'],
    devCommand: ['npx', 'esbuild', '--serve'],
    supportsHMR: false,
    errorPatterns: [
      /✗.*\[ERROR\]/i,
      /error:.*Could not resolve/i,
    ],
  },
  [BuildTool.SWC]: {
    buildCommand: ['npx', 'swc', 'src', '-d', 'dist'],
    devCommand: ['npx', 'swc', 'src', '-d', 'dist', '--watch'],
    supportsHMR: false,
    errorPatterns: [
      /error\[.*\]:/i,
      /Syntax Error/i,
    ],
  },
  [BuildTool.ROLLUP]: {
    buildCommand: ['npx', 'rollup', '-c'],
    devCommand: ['npx', 'rollup', '-c', '-w'],
    supportsHMR: false,
    errorPatterns: [
      /\[!].*Error/i,
      /Could not resolve/i,
    ],
  },
  [BuildTool.PARCEL]: {
    buildCommand: ['npx', 'parcel', 'build', 'src/index.html'],
    devCommand: ['npx', 'parcel', 'src/index.html'],
    supportsHMR: true,
    errorPatterns: [
      /@parcel\/.*Error/i,
      /BuildError/i,
    ],
  },
  [BuildTool.NEXTJS]: {
    buildCommand: ['npx', 'next', 'build'],
    devCommand: ['npx', 'next', 'dev'],
    typeCheckCommand: ['npx', 'tsc', '--noEmit'],
    supportsHMR: true,
    errorPatterns: [
      /Error:.*Next\.js/i,
      /Build error occurred/i,
      /Failed to compile/i,
      // SSR-specific errors
      /Server Error/i,
      /getServerSideProps.*error/i,
      /getStaticProps.*error/i,
      /getStaticPaths.*error/i,
      /generateStaticParams.*error/i,
      /generateMetadata.*error/i,
      // Hydration errors
      /Hydration failed/i,
      /There was an error while hydrating/i,
      /Text content does not match/i,
      /Minified React error #\d+/i,
      // Server component errors
      /Server Component/i,
      /use client.*missing/i,
      /Cannot read properties of undefined.*useRouter/i,
      // App Router errors
      /Error: Dynamic server usage/i,
      /Invariant: Dynamic server usage/i,
    ],
  },
  [BuildTool.REMIX]: {
    buildCommand: ['npx', 'remix', 'build'],
    devCommand: ['npx', 'remix', 'dev'],
    typeCheckCommand: ['npx', 'tsc', '--noEmit'],
    supportsHMR: true,
    errorPatterns: [
      /\[remix\].*error/i,
      /Build failed/i,
      /loader.*error/i,
      /action.*error/i,
      // SSR errors
      /Server Error/i,
      /Unexpected Server Error/i,
      /useLoaderData.*undefined/i,
      /useActionData.*error/i,
      // Hydration errors
      /Hydration failed/i,
      /Text content does not match/i,
    ],
  },
  [BuildTool.ASTRO]: {
    buildCommand: ['npx', 'astro', 'build'],
    devCommand: ['npx', 'astro', 'dev'],
    typeCheckCommand: ['npx', 'astro', 'check'],
    supportsHMR: true,
    errorPatterns: [
      /\[astro\].*error/i,
      /AstroError/i,
      /Build failed/i,
      // SSR/SSG errors
      /Unable to render component/i,
      /getStaticPaths.*is required/i,
      /Unable to find a matching route/i,
      /Invalid props/i,
      // Island hydration errors
      /Hydration failed/i,
      /client:.*directive/i,
    ],
  },
  [BuildTool.NUXT]: {
    buildCommand: ['npx', 'nuxt', 'build'],
    devCommand: ['npx', 'nuxt', 'dev'],
    typeCheckCommand: ['npx', 'nuxi', 'typecheck'],
    supportsHMR: true,
    errorPatterns: [
      /\[nuxt\].*error/i,
      /Nuxt.*error/i,
      /Build failed/i,
      // SSR errors
      /Server Error/i,
      /useAsyncData.*error/i,
      /useFetch.*error/i,
      // Hydration errors
      /Hydration.*mismatch/i,
      /Hydration.*failed/i,
    ],
  },
  [BuildTool.SVELTEKIT]: {
    buildCommand: ['npx', 'svelte-kit', 'build'],
    devCommand: ['npx', 'svelte-kit', 'dev'],
    typeCheckCommand: ['npx', 'svelte-check'],
    supportsHMR: true,
    errorPatterns: [
      /\[svelte.*\].*error/i,
      /SvelteKit.*error/i,
      /Build failed/i,
      // SSR errors
      /Server Error/i,
      /load.*function.*error/i,
      // Hydration errors
      /Hydration.*mismatch/i,
      /Hydration.*failed/i,
    ],
  },
  [BuildTool.CRA]: {
    buildCommand: ['npm', 'run', 'build'],
    devCommand: ['npm', 'start'],
    typeCheckCommand: ['npx', 'tsc', '--noEmit'],
    supportsHMR: true,
    errorPatterns: [
      /Failed to compile/i,
      /Module not found/i,
    ],
  },
  [BuildTool.TSC]: {
    buildCommand: ['npx', 'tsc'],
    devCommand: ['npx', 'tsc', '--watch'],
    typeCheckCommand: ['npx', 'tsc', '--noEmit'],
    supportsHMR: false,
    errorPatterns: [
      /error TS\d+/i,
    ],
  },
  [BuildTool.UNKNOWN]: {
    buildCommand: ['npm', 'run', 'build'],
    devCommand: ['npm', 'run', 'dev'],
    supportsHMR: false,
    errorPatterns: [],
  },
};

// Config file patterns for detection
const CONFIG_FILE_PATTERNS: Record<BuildTool, string[]> = {
  [BuildTool.VITE]: ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'],
  [BuildTool.WEBPACK]: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs'],
  [BuildTool.ESBUILD]: ['esbuild.config.js', 'esbuild.config.mjs'],
  [BuildTool.SWC]: ['.swcrc', 'swc.config.js'],
  [BuildTool.ROLLUP]: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
  [BuildTool.PARCEL]: ['.parcelrc'],
  [BuildTool.NEXTJS]: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
  [BuildTool.REMIX]: ['remix.config.js', 'remix.config.ts'],
  [BuildTool.ASTRO]: ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'],
  [BuildTool.NUXT]: ['nuxt.config.ts', 'nuxt.config.js'],
  [BuildTool.SVELTEKIT]: ['svelte.config.js', 'svelte.config.ts'],
  [BuildTool.CRA]: [], // Detected via package.json
  [BuildTool.TSC]: [], // Detected via tsconfig.json
  [BuildTool.UNKNOWN]: [],
};

// =============================================================================
// BUILD TOOL DETECTOR CLASS
// =============================================================================

export class BuildToolDetector {
  private webcontainer: WebContainer;
  private config: BuildToolDetectorConfig;
  private detectedTool: BuildTool | null = null;
  private detectedConfig: BuildToolConfig | null = null;

  constructor(webcontainer: WebContainer, config: BuildToolDetectorConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = config;
  }

  /**
   * Detect the build tool used in the project
   */
  async detect(): Promise<BuildTool> {
    if (this.detectedTool) return this.detectedTool;

    this.config.onProgress?.('[BuildTool] Detecting build tool...');

    // Check config files first (most reliable)
    for (const [tool, patterns] of Object.entries(CONFIG_FILE_PATTERNS)) {
      for (const pattern of patterns) {
        if (await this.fileExists(pattern)) {
          this.detectedTool = tool as BuildTool;
          this.config.onProgress?.(`[BuildTool] Detected: ${tool} (config file: ${pattern})`);
          return this.detectedTool;
        }
      }
    }

    // Check package.json dependencies and scripts
    try {
      const packageJson = await this.webcontainer.fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const scripts = pkg.scripts || {};

      // Check dependencies - prioritize SSR/SSG frameworks first
      if (allDeps.next) {
        this.detectedTool = BuildTool.NEXTJS;
      } else if (allDeps['@remix-run/react'] || allDeps['@remix-run/node'] || allDeps['remix']) {
        this.detectedTool = BuildTool.REMIX;
      } else if (allDeps.astro) {
        this.detectedTool = BuildTool.ASTRO;
      } else if (allDeps.nuxt) {
        this.detectedTool = BuildTool.NUXT;
      } else if (allDeps['@sveltejs/kit']) {
        this.detectedTool = BuildTool.SVELTEKIT;
      } else if (allDeps['react-scripts']) {
        this.detectedTool = BuildTool.CRA;
      } else if (allDeps.vite) {
        this.detectedTool = BuildTool.VITE;
      } else if (allDeps.webpack) {
        this.detectedTool = BuildTool.WEBPACK;
      } else if (allDeps.esbuild) {
        this.detectedTool = BuildTool.ESBUILD;
      } else if (allDeps['@swc/core'] || allDeps['@swc/cli']) {
        this.detectedTool = BuildTool.SWC;
      } else if (allDeps.rollup) {
        this.detectedTool = BuildTool.ROLLUP;
      } else if (allDeps.parcel) {
        this.detectedTool = BuildTool.PARCEL;
      }

      // Check build script for hints
      if (!this.detectedTool) {
        const buildScript = scripts.build || '';
        // Check SSR/SSG frameworks first
        if (buildScript.includes('next')) {
          this.detectedTool = BuildTool.NEXTJS;
        } else if (buildScript.includes('remix')) {
          this.detectedTool = BuildTool.REMIX;
        } else if (buildScript.includes('astro')) {
          this.detectedTool = BuildTool.ASTRO;
        } else if (buildScript.includes('nuxt') || buildScript.includes('nuxi')) {
          this.detectedTool = BuildTool.NUXT;
        } else if (buildScript.includes('svelte-kit') || buildScript.includes('sveltekit')) {
          this.detectedTool = BuildTool.SVELTEKIT;
        } else if (buildScript.includes('vite')) {
          this.detectedTool = BuildTool.VITE;
        } else if (buildScript.includes('react-scripts')) {
          this.detectedTool = BuildTool.CRA;
        } else if (buildScript.includes('webpack')) {
          this.detectedTool = BuildTool.WEBPACK;
        } else if (buildScript.includes('esbuild')) {
          this.detectedTool = BuildTool.ESBUILD;
        } else if (buildScript.includes('swc')) {
          this.detectedTool = BuildTool.SWC;
        } else if (buildScript.includes('rollup')) {
          this.detectedTool = BuildTool.ROLLUP;
        } else if (buildScript.includes('parcel')) {
          this.detectedTool = BuildTool.PARCEL;
        } else if (buildScript.includes('tsc')) {
          this.detectedTool = BuildTool.TSC;
        }
      }
    } catch {
      // No package.json or can't parse
    }

    // Check for tsconfig.json as last resort (TypeScript project)
    if (!this.detectedTool) {
      if (await this.fileExists('tsconfig.json')) {
        this.detectedTool = BuildTool.TSC;
      } else {
        this.detectedTool = BuildTool.UNKNOWN;
      }
    }

    this.config.onProgress?.(`[BuildTool] Detected: ${this.detectedTool}`);
    return this.detectedTool;
  }

  /**
   * Get the full configuration for the detected tool
   */
  async getConfig(): Promise<BuildToolConfig> {
    if (this.detectedConfig) return this.detectedConfig;

    const tool = await this.detect();
    const baseConfig = TOOL_CONFIGS[tool];

    // Find actual config file
    let configFile: string | undefined;
    for (const pattern of CONFIG_FILE_PATTERNS[tool]) {
      if (await this.fileExists(pattern)) {
        configFile = pattern;
        break;
      }
    }

    this.detectedConfig = {
      tool,
      buildCommand: baseConfig.buildCommand || ['npm', 'run', 'build'],
      devCommand: baseConfig.devCommand || ['npm', 'run', 'dev'],
      typeCheckCommand: baseConfig.typeCheckCommand,
      configFile,
      supportsHMR: baseConfig.supportsHMR ?? false,
      errorPatterns: baseConfig.errorPatterns || [],
    };

    return this.detectedConfig;
  }

  /**
   * Get the build command for the detected tool
   */
  async getBuildCommand(): Promise<string[]> {
    const config = await this.getConfig();

    // If we have a build script in package.json, prefer that
    try {
      const packageJson = await this.webcontainer.fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);
      if (pkg.scripts?.build) {
        return ['npm', 'run', 'build'];
      }
    } catch {
      // Use tool-specific command
    }

    return config.buildCommand;
  }

  /**
   * Get the type check command
   */
  async getTypeCheckCommand(): Promise<string[] | null> {
    const config = await this.getConfig();

    // Check if TypeScript is available
    try {
      await this.webcontainer.fs.readFile('tsconfig.json', 'utf-8');
      return config.typeCheckCommand || ['npx', 'tsc', '--noEmit'];
    } catch {
      return null; // No TypeScript
    }
  }

  /**
   * Get the dev server command
   */
  async getDevCommand(): Promise<string[]> {
    const config = await this.getConfig();

    // If we have a dev script in package.json, prefer that
    try {
      const packageJson = await this.webcontainer.fs.readFile('package.json', 'utf-8');
      const pkg = JSON.parse(packageJson);
      if (pkg.scripts?.dev) {
        return ['npm', 'run', 'dev'];
      }
      if (pkg.scripts?.start) {
        return ['npm', 'start'];
      }
    } catch {
      // Use tool-specific command
    }

    return config.devCommand;
  }

  /**
   * Parse build output for errors using tool-specific patterns
   */
  parseErrors(output: string): BuildToolError[] {
    const errors: BuildToolError[] = [];
    const lines = output.split('\n');

    // Generic TypeScript error pattern
    const tsErrorPattern = /(.+?)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)/;

    // Generic file:line:col pattern
    const fileLinePattern = /(.+?):(\d+):(\d+):\s*(?:error|Error):\s*(.+)/;

    // Module not found pattern
    const moduleNotFoundPattern = /Module not found.*['"](.+?)['"]/i;

    // Vite-specific patterns
    const viteErrorPattern = /\[vite\].*?(\/.+?):(\d+):(\d+)\s*(.+)/;

    // SSR/SSG error patterns
    const ssrPatterns = {
      // Next.js SSR errors
      serverError: /Server Error[:\s]*(.+)/i,
      getServerSideProps: /getServerSideProps.*?Error[:\s]*(.+)/i,
      getStaticProps: /getStaticProps.*?Error[:\s]*(.+)/i,
      getStaticPaths: /getStaticPaths.*?Error[:\s]*(.+)/i,
      generateStaticParams: /generateStaticParams.*?Error[:\s]*(.+)/i,
      serverComponent: /Server Component.*?Error[:\s]*(.+)/i,
      dynamicServerUsage: /Dynamic server usage[:\s]*(.+)/i,

      // Hydration errors (common across frameworks)
      hydrationFailed: /Hydration failed[:\s]*(.+)?/i,
      hydrationMismatch: /Hydration.*?mismatch[:\s]*(.+)?/i,
      textMismatch: /Text content does not match[:\s]*(.+)?/i,

      // Remix errors
      loaderError: /loader.*?Error[:\s]*(.+)/i,
      actionError: /action.*?Error[:\s]*(.+)/i,

      // Astro errors
      astroError: /AstroError[:\s]*(.+)/i,
      renderError: /Unable to render component[:\s]*(.+)?/i,

      // Nuxt errors
      useAsyncDataError: /useAsyncData.*?Error[:\s]*(.+)/i,
      useFetchError: /useFetch.*?Error[:\s]*(.+)/i,

      // React minified errors
      reactMinifiedError: /Minified React error #(\d+)/i,
    };

    for (const line of lines) {
      // Try TypeScript pattern
      let match = line.match(tsErrorPattern);
      if (match) {
        errors.push({
          tool: this.detectedTool || BuildTool.UNKNOWN,
          type: 'type',
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[4],
          message: match[5],
        });
        continue;
      }

      // Try Vite pattern
      match = line.match(viteErrorPattern);
      if (match) {
        errors.push({
          tool: BuildTool.VITE,
          type: 'syntax',
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          message: match[4],
        });
        continue;
      }

      // Try SSR/SSG patterns
      let ssrError = false;
      for (const [errorType, pattern] of Object.entries(ssrPatterns)) {
        match = line.match(pattern);
        if (match) {
          const isHydration = errorType.toLowerCase().includes('hydration') || errorType === 'textMismatch';
          errors.push({
            tool: this.detectedTool || BuildTool.UNKNOWN,
            type: isHydration ? 'runtime' : 'runtime',
            message: match[1] || `${errorType.replace(/([A-Z])/g, ' $1').trim()} detected`,
            code: isHydration ? 'HYDRATION_ERROR' : 'SSR_ERROR',
          });
          ssrError = true;
          break;
        }
      }
      if (ssrError) continue;

      // Try generic file:line:col pattern
      match = line.match(fileLinePattern);
      if (match) {
        errors.push({
          tool: this.detectedTool || BuildTool.UNKNOWN,
          type: 'syntax',
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          message: match[4],
        });
        continue;
      }

      // Try module not found
      match = line.match(moduleNotFoundPattern);
      if (match) {
        errors.push({
          tool: this.detectedTool || BuildTool.UNKNOWN,
          type: 'import',
          message: `Module not found: ${match[1]}`,
        });
        continue;
      }
    }

    return errors;
  }

  /**
   * Format errors for display
   */
  formatErrors(errors: BuildToolError[]): string {
    if (errors.length === 0) {
      return 'No build errors detected.';
    }

    const lines: string[] = [`## Build Errors (${this.detectedTool || 'unknown'})`, ''];

    // Group by file
    const byFile = new Map<string, BuildToolError[]>();
    const noFile: BuildToolError[] = [];

    for (const error of errors) {
      if (error.file) {
        const existing = byFile.get(error.file) || [];
        existing.push(error);
        byFile.set(error.file, existing);
      } else {
        noFile.push(error);
      }
    }

    for (const [file, fileErrors] of byFile) {
      lines.push(`### ${file}`);
      for (const error of fileErrors) {
        const location = error.line ? `:${error.line}:${error.column || 1}` : '';
        const code = error.code ? ` [${error.code}]` : '';
        lines.push(`- Line ${error.line || '?'}${code}: ${error.message}`);
      }
      lines.push('');
    }

    if (noFile.length > 0) {
      lines.push('### Other Errors');
      for (const error of noFile) {
        lines.push(`- ${error.message}`);
      }
    }

    return lines.join('\n');
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
    this.detectedTool = null;
    this.detectedConfig = null;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a build tool detector
 */
export function createBuildToolDetector(
  webcontainer: WebContainer,
  config?: BuildToolDetectorConfig
): BuildToolDetector {
  return new BuildToolDetector(webcontainer, config);
}

/**
 * Quick detect build tool
 */
export async function detectBuildTool(webcontainer: WebContainer): Promise<BuildTool> {
  const detector = new BuildToolDetector(webcontainer);
  return detector.detect();
}

/**
 * Get build command for project
 */
export async function getBuildCommand(webcontainer: WebContainer): Promise<string[]> {
  const detector = new BuildToolDetector(webcontainer);
  return detector.getBuildCommand();
}

/**
 * Get type check command for project
 */
export async function getTypeCheckCommand(webcontainer: WebContainer): Promise<string[] | null> {
  const detector = new BuildToolDetector(webcontainer);
  return detector.getTypeCheckCommand();
}
