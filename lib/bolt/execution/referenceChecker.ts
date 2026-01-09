/**
 * Reference Checker
 *
 * Phase 2 of the Debugging Strategy Implementation.
 *
 * Checks if a file is referenced/imported by other files in the project.
 * Used to warn before deleting files that are still in use.
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export interface ReferenceCheckResult {
  /** The file being checked */
  filePath: string;

  /** Whether the file is referenced by other files */
  isReferenced: boolean;

  /** List of files that reference this file */
  referencedBy: string[];

  /** Import statements that reference this file */
  importStatements: ImportReference[];

  /** Config file references (tsconfig.json, vite.config.ts, package.json) */
  configReferences: ConfigReference[];
}

export interface ConfigReference {
  /** Config file that references this file */
  configFile: string;

  /** Type of reference */
  referenceType: 'tsconfig-include' | 'tsconfig-paths' | 'vite-input' | 'package-main' | 'package-types' | 'package-bin';

  /** The reference value */
  referenceValue: string;

  /** Description of the reference */
  description: string;
}

export interface ImportReference {
  /** File containing the import */
  sourceFile: string;

  /** Line number of the import */
  line: number;

  /** The import statement */
  statement: string;
}

// =============================================================================
// PATTERNS
// =============================================================================

/**
 * Patterns to match import statements
 */
const IMPORT_PATTERNS = [
  // ES6 imports: import X from './path'
  /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g,
  // Dynamic imports: import('./path')
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Require: require('./path')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // CSS imports: @import './path'
  /@import\s+['"]([^'"]+)['"]/g,
];

// =============================================================================
// REFERENCE CHECKER CLASS
// =============================================================================

export class ReferenceChecker {
  private webcontainer: WebContainer;

  constructor(webcontainer: WebContainer) {
    this.webcontainer = webcontainer;
  }

  /**
   * Check if a file is referenced by other files in the project
   */
  async checkReferences(filePath: string): Promise<ReferenceCheckResult> {
    const result: ReferenceCheckResult = {
      filePath,
      isReferenced: false,
      referencedBy: [],
      importStatements: [],
      configReferences: [],
    };

    try {
      // Get all potential source files
      const sourceFiles = await this.getSourceFiles();

      // Get the file's possible import paths
      const importPaths = this.getImportPaths(filePath);

      // Check each source file for references
      for (const sourceFile of sourceFiles) {
        // Don't check the file against itself
        if (sourceFile === filePath) continue;

        const references = await this.findReferencesInFile(sourceFile, importPaths);

        if (references.length > 0) {
          result.isReferenced = true;
          result.referencedBy.push(sourceFile);
          result.importStatements.push(...references.map(ref => ({
            ...ref,
            sourceFile,
          })));
        }
      }

      // Check config files for references
      const configRefs = await this.checkConfigFileReferences(filePath);
      if (configRefs.length > 0) {
        result.isReferenced = true;
        result.configReferences = configRefs;
        // Add config files to referencedBy
        for (const ref of configRefs) {
          if (!result.referencedBy.includes(ref.configFile)) {
            result.referencedBy.push(ref.configFile);
          }
        }
      }
    } catch (error) {
      console.warn('[ReferenceChecker] Error checking references:', error);
    }

    return result;
  }

  /**
   * Check multiple files at once
   */
  async checkMultipleReferences(filePaths: string[]): Promise<Map<string, ReferenceCheckResult>> {
    const results = new Map<string, ReferenceCheckResult>();

    for (const filePath of filePaths) {
      const result = await this.checkReferences(filePath);
      results.set(filePath, result);
    }

    return results;
  }

  /**
   * Get all source files in the project (js, ts, tsx, jsx, css, scss)
   */
  private async getSourceFiles(): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await this.webcontainer.fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;

          // Skip node_modules and hidden directories
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (this.isSourceFile(entry.name)) {
            // Remove leading slash for consistency
            files.push(fullPath.replace(/^\//, ''));
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
    };

    await walk('/');
    return files;
  }

  /**
   * Check if a file is a source file that might contain imports
   */
  private isSourceFile(filename: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.less'];
    return extensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Get all possible import paths for a file
   * e.g., 'src/components/Button.tsx' could be imported as:
   *   - './Button'
   *   - './Button.tsx'
   *   - '../components/Button'
   *   - '@/components/Button'
   */
  private getImportPaths(filePath: string): string[] {
    const paths: string[] = [];

    // Normalize the path
    const normalized = filePath.replace(/^\//, '').replace(/\\/g, '/');

    // Get filename without extension
    const filename = normalized.split('/').pop() || '';
    const nameWithoutExt = filename.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '');

    // Add various path patterns
    paths.push(
      normalized,
      nameWithoutExt,
      `./${nameWithoutExt}`,
      `./${filename}`,
      `/${normalized}`,
    );

    // Handle @/ alias (common in many projects)
    if (normalized.startsWith('src/')) {
      const aliasPath = normalized.replace(/^src\//, '@/').replace(/\.(tsx?|jsx?)$/, '');
      paths.push(aliasPath);
    }

    // Handle relative paths from parent directories
    const parts = normalized.split('/');
    for (let i = 1; i < parts.length; i++) {
      const relativePath = parts.slice(i).join('/');
      paths.push(relativePath);
      paths.push(relativePath.replace(/\.(tsx?|jsx?)$/, ''));
    }

    return paths;
  }

  /**
   * Find references to target paths in a source file
   */
  private async findReferencesInFile(
    sourceFile: string,
    targetPaths: string[]
  ): Promise<{ line: number; statement: string }[]> {
    const references: { line: number; statement: string }[] = [];

    try {
      const content = await this.webcontainer.fs.readFile(sourceFile, 'utf-8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        // Check each import pattern
        for (const pattern of IMPORT_PATTERNS) {
          pattern.lastIndex = 0;
          let match;

          while ((match = pattern.exec(line)) !== null) {
            const importPath = match[1];

            // Check if this import matches any of our target paths
            if (this.importMatchesTarget(importPath, targetPaths)) {
              references.push({
                line: lineNum + 1,
                statement: line.trim(),
              });
            }
          }
        }
      }
    } catch {
      // File can't be read
    }

    return references;
  }

  /**
   * Check if an import path matches any of the target paths
   */
  private importMatchesTarget(importPath: string, targetPaths: string[]): boolean {
    // Normalize the import path
    const normalized = importPath.replace(/^\.\//, '').replace(/^\//, '');

    return targetPaths.some(target => {
      const normalizedTarget = target.replace(/^\.\//, '').replace(/^\//, '');

      // Exact match
      if (normalized === normalizedTarget) return true;

      // Match with or without extension
      if (normalized.replace(/\.(tsx?|jsx?)$/, '') === normalizedTarget.replace(/\.(tsx?|jsx?)$/, '')) return true;

      // Match ending (for relative paths)
      if (normalizedTarget.endsWith(normalized) || normalized.endsWith(normalizedTarget)) return true;

      return false;
    });
  }

  // ===========================================================================
  // CONFIG FILE REFERENCE CHECKING
  // ===========================================================================

  /**
   * Check if a file is referenced in config files
   */
  private async checkConfigFileReferences(filePath: string): Promise<ConfigReference[]> {
    const references: ConfigReference[] = [];

    // Check tsconfig.json
    const tsconfigRefs = await this.checkTsConfigReferences(filePath);
    references.push(...tsconfigRefs);

    // Check vite.config.ts
    const viteRefs = await this.checkViteConfigReferences(filePath);
    references.push(...viteRefs);

    // Check package.json
    const packageRefs = await this.checkPackageJsonReferences(filePath);
    references.push(...packageRefs);

    return references;
  }

  /**
   * Check tsconfig.json for references to the file
   */
  private async checkTsConfigReferences(filePath: string): Promise<ConfigReference[]> {
    const references: ConfigReference[] = [];
    const normalizedPath = filePath.replace(/^\//, '').replace(/\\/g, '/');

    try {
      const content = await this.webcontainer.fs.readFile('tsconfig.json', 'utf-8');
      const tsconfig = JSON.parse(content);

      // Check include patterns
      if (tsconfig.include && Array.isArray(tsconfig.include)) {
        for (const pattern of tsconfig.include) {
          if (this.matchesGlobPattern(normalizedPath, pattern)) {
            references.push({
              configFile: 'tsconfig.json',
              referenceType: 'tsconfig-include',
              referenceValue: pattern,
              description: `File matches include pattern "${pattern}"`,
            });
          }
        }
      }

      // Check compilerOptions.paths
      if (tsconfig.compilerOptions?.paths) {
        for (const [alias, paths] of Object.entries(tsconfig.compilerOptions.paths)) {
          if (Array.isArray(paths)) {
            for (const pathPattern of paths) {
              if (this.matchesGlobPattern(normalizedPath, pathPattern as string)) {
                references.push({
                  configFile: 'tsconfig.json',
                  referenceType: 'tsconfig-paths',
                  referenceValue: `${alias}: ${pathPattern}`,
                  description: `File is mapped by path alias "${alias}"`,
                });
              }
            }
          }
        }
      }

      // Check files array (explicit file list)
      if (tsconfig.files && Array.isArray(tsconfig.files)) {
        for (const file of tsconfig.files) {
          const normalizedFile = file.replace(/^\.\//, '');
          if (normalizedPath === normalizedFile || normalizedPath.endsWith(normalizedFile)) {
            references.push({
              configFile: 'tsconfig.json',
              referenceType: 'tsconfig-include',
              referenceValue: file,
              description: `File is explicitly listed in "files" array`,
            });
          }
        }
      }
    } catch {
      // tsconfig.json doesn't exist or can't be parsed
    }

    return references;
  }

  /**
   * Check vite.config.ts for references to the file
   */
  private async checkViteConfigReferences(filePath: string): Promise<ConfigReference[]> {
    const references: ConfigReference[] = [];
    const normalizedPath = filePath.replace(/^\//, '').replace(/\\/g, '/');

    // Try both .ts and .js extensions
    for (const configFile of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
      try {
        const content = await this.webcontainer.fs.readFile(configFile, 'utf-8');

        // Check for input entries (build.rollupOptions.input)
        const inputPattern = /input\s*:\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = inputPattern.exec(content)) !== null) {
          const inputPath = match[1].replace(/^\.\//, '');
          if (normalizedPath === inputPath || normalizedPath.endsWith(inputPath)) {
            references.push({
              configFile,
              referenceType: 'vite-input',
              referenceValue: match[1],
              description: `File is used as build input entry point`,
            });
          }
        }

        // Check for object-style input entries
        const objectInputPattern = /input\s*:\s*\{([^}]+)\}/gs;
        while ((match = objectInputPattern.exec(content)) !== null) {
          const inputBlock = match[1];
          const entryPattern = /['"]([^'"]+)['"]/g;
          let entryMatch;
          while ((entryMatch = entryPattern.exec(inputBlock)) !== null) {
            const entryPath = entryMatch[1].replace(/^\.\//, '');
            if (normalizedPath === entryPath || normalizedPath.endsWith(entryPath)) {
              references.push({
                configFile,
                referenceType: 'vite-input',
                referenceValue: entryMatch[1],
                description: `File is used as build input entry point`,
              });
            }
          }
        }

        // Check for resolve.alias references
        const aliasPattern = /['"](@\/[^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
        while ((match = aliasPattern.exec(content)) !== null) {
          const aliasPath = match[2].replace(/^\.\//, '');
          if (normalizedPath.startsWith(aliasPath)) {
            references.push({
              configFile,
              referenceType: 'vite-input',
              referenceValue: `${match[1]} -> ${match[2]}`,
              description: `File is in a directory mapped by alias "${match[1]}"`,
            });
          }
        }

        break; // Found config file, stop searching
      } catch {
        // Config file doesn't exist, try next
      }
    }

    return references;
  }

  /**
   * Check package.json for references to the file
   */
  private async checkPackageJsonReferences(filePath: string): Promise<ConfigReference[]> {
    const references: ConfigReference[] = [];
    const normalizedPath = filePath.replace(/^\//, '').replace(/\\/g, '/');

    try {
      const content = await this.webcontainer.fs.readFile('package.json', 'utf-8');
      const packageJson = JSON.parse(content);

      // Check main entry
      if (packageJson.main) {
        const mainPath = packageJson.main.replace(/^\.\//, '');
        if (normalizedPath === mainPath || normalizedPath.endsWith(mainPath)) {
          references.push({
            configFile: 'package.json',
            referenceType: 'package-main',
            referenceValue: packageJson.main,
            description: `File is the main entry point`,
          });
        }
      }

      // Check module entry
      if (packageJson.module) {
        const modulePath = packageJson.module.replace(/^\.\//, '');
        if (normalizedPath === modulePath || normalizedPath.endsWith(modulePath)) {
          references.push({
            configFile: 'package.json',
            referenceType: 'package-main',
            referenceValue: packageJson.module,
            description: `File is the module entry point`,
          });
        }
      }

      // Check types/typings entry
      for (const typesField of ['types', 'typings']) {
        if (packageJson[typesField]) {
          const typesPath = packageJson[typesField].replace(/^\.\//, '');
          if (normalizedPath === typesPath || normalizedPath.endsWith(typesPath)) {
            references.push({
              configFile: 'package.json',
              referenceType: 'package-types',
              referenceValue: packageJson[typesField],
              description: `File is the TypeScript types entry`,
            });
          }
        }
      }

      // Check bin entries
      if (packageJson.bin) {
        const binEntries = typeof packageJson.bin === 'string'
          ? { [packageJson.name]: packageJson.bin }
          : packageJson.bin;

        for (const [binName, binPath] of Object.entries(binEntries)) {
          const normalizedBin = (binPath as string).replace(/^\.\//, '');
          if (normalizedPath === normalizedBin || normalizedPath.endsWith(normalizedBin)) {
            references.push({
              configFile: 'package.json',
              referenceType: 'package-bin',
              referenceValue: `${binName}: ${binPath}`,
              description: `File is a CLI binary entry point`,
            });
          }
        }
      }

      // Check exports (ESM exports map)
      if (packageJson.exports) {
        this.checkExportsReferences(packageJson.exports, normalizedPath, references);
      }
    } catch {
      // package.json doesn't exist or can't be parsed
    }

    return references;
  }

  /**
   * Recursively check exports map for references
   */
  private checkExportsReferences(
    exports: unknown,
    normalizedPath: string,
    references: ConfigReference[]
  ): void {
    if (typeof exports === 'string') {
      const exportPath = exports.replace(/^\.\//, '');
      if (normalizedPath === exportPath || normalizedPath.endsWith(exportPath)) {
        references.push({
          configFile: 'package.json',
          referenceType: 'package-main',
          referenceValue: exports,
          description: `File is referenced in exports map`,
        });
      }
    } else if (typeof exports === 'object' && exports !== null) {
      for (const value of Object.values(exports)) {
        this.checkExportsReferences(value, normalizedPath, references);
      }
    }
  }

  /**
   * Simple glob pattern matcher for config file patterns
   */
  private matchesGlobPattern(filePath: string, pattern: string): boolean {
    // Normalize both
    const normalizedPath = filePath.replace(/^\.\//, '').replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/^\.\//, '').replace(/\\/g, '/');

    // Convert glob to regex
    const regexPattern = normalizedPattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*');

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(normalizedPath);
    } catch {
      // If regex fails, fall back to simple matching
      return normalizedPath === normalizedPattern;
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a reference checker instance
 */
export function createReferenceChecker(webcontainer: WebContainer): ReferenceChecker {
  return new ReferenceChecker(webcontainer);
}

/**
 * Quick check if a file is referenced
 * Convenience function for one-off checks
 */
export async function isFileReferenced(
  webcontainer: WebContainer,
  filePath: string
): Promise<boolean> {
  const checker = new ReferenceChecker(webcontainer);
  const result = await checker.checkReferences(filePath);
  return result.isReferenced;
}

/**
 * Format reference check result for display
 */
export function formatReferenceWarning(result: ReferenceCheckResult): string {
  if (!result.isReferenced) {
    return `File ${result.filePath} is not referenced by any other files.`;
  }

  const lines = [
    `⚠️ File ${result.filePath} is referenced by ${result.referencedBy.length} file(s):`,
  ];

  // Show import references
  if (result.importStatements.length > 0) {
    lines.push('');
    lines.push('**Import References:**');
    for (const ref of result.importStatements.slice(0, 5)) {
      lines.push(`  - ${ref.sourceFile}:${ref.line}`);
      lines.push(`    ${ref.statement}`);
    }

    if (result.importStatements.length > 5) {
      lines.push(`  ... and ${result.importStatements.length - 5} more import references`);
    }
  }

  // Show config file references
  if (result.configReferences.length > 0) {
    lines.push('');
    lines.push('**Config File References:**');
    for (const ref of result.configReferences.slice(0, 5)) {
      lines.push(`  - ${ref.configFile} (${ref.referenceType})`);
      lines.push(`    ${ref.description}`);
    }

    if (result.configReferences.length > 5) {
      lines.push(`  ... and ${result.configReferences.length - 5} more config references`);
    }
  }

  lines.push('');
  lines.push('Deleting this file may break these references.');

  return lines.join('\n');
}
