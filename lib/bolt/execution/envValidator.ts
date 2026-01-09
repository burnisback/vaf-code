/**
 * Environment Variable Validator
 *
 * Validates that required environment variables are defined.
 * Detects:
 * - process.env.VARIABLE usage in code
 * - import.meta.env.VARIABLE usage (Vite)
 * - Compares against .env, .env.local, .env.example files
 *
 * Helps catch runtime errors from missing environment variables.
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export interface EnvUsage {
  /** Variable name (e.g., API_KEY) */
  name: string;
  /** File where usage was found */
  file: string;
  /** Line number */
  line: number;
  /** The full expression (e.g., process.env.API_KEY) */
  expression: string;
  /** Type: process.env or import.meta.env */
  type: 'process.env' | 'import.meta.env';
  /** Whether usage has a fallback (|| 'default') */
  hasFallback: boolean;
}

export interface EnvDefinition {
  /** Variable name */
  name: string;
  /** File where defined */
  file: string;
  /** Value (masked for security) */
  value: string;
  /** Whether this is a template/example */
  isExample: boolean;
}

export interface EnvValidationResult {
  /** Whether validation passed (no missing required vars) */
  valid: boolean;
  /** Environment variables used in code */
  usages: EnvUsage[];
  /** Environment variables defined in .env files */
  definitions: EnvDefinition[];
  /** Missing variables (used but not defined) */
  missing: EnvUsage[];
  /** Unused variables (defined but not used) */
  unused: EnvDefinition[];
  /** Variables used without fallback */
  requiredWithoutFallback: EnvUsage[];
  /** Files that were scanned */
  scannedFiles: number;
  /** Warnings (non-blocking issues) */
  warnings: string[];
}

export interface EnvValidatorConfig {
  /** Patterns for source files to scan */
  sourcePatterns?: string[];
  /** Env files to check */
  envFiles?: string[];
  /** Whether to treat vars without fallback as required */
  requireFallbacks?: boolean;
  /** Variables to ignore (known to be set externally) */
  ignoreVariables?: string[];
  /** Callback for progress */
  onProgress?: (message: string) => void;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const DEFAULT_ENV_FILES = ['.env', '.env.local', '.env.development', '.env.production', '.env.example'];
const SYSTEM_ENV_VARS = new Set([
  'NODE_ENV',
  'PUBLIC_URL',
  'BASE_URL',
  'MODE',
  'DEV',
  'PROD',
  'SSR',
]);

// =============================================================================
// ENV VALIDATOR CLASS
// =============================================================================

export class EnvValidator {
  private webcontainer: WebContainer;
  private config: Required<EnvValidatorConfig>;

  constructor(webcontainer: WebContainer, config: EnvValidatorConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = {
      sourcePatterns: config.sourcePatterns || DEFAULT_SOURCE_EXTENSIONS,
      envFiles: config.envFiles || DEFAULT_ENV_FILES,
      requireFallbacks: config.requireFallbacks ?? false,
      ignoreVariables: config.ignoreVariables || [],
      onProgress: config.onProgress || (() => {}),
    };
  }

  /**
   * Validate environment variables
   */
  async validate(): Promise<EnvValidationResult> {
    this.config.onProgress('Scanning for environment variable usage...');

    const result: EnvValidationResult = {
      valid: true,
      usages: [],
      definitions: [],
      missing: [],
      unused: [],
      requiredWithoutFallback: [],
      scannedFiles: 0,
      warnings: [],
    };

    try {
      // Scan source files for env usage
      const sourceFiles = await this.getSourceFiles();
      result.scannedFiles = sourceFiles.length;

      for (const file of sourceFiles) {
        const usages = await this.findEnvUsages(file);
        result.usages.push(...usages);
      }

      // Parse .env files
      this.config.onProgress('Parsing .env files...');
      for (const envFile of this.config.envFiles) {
        const definitions = await this.parseEnvFile(envFile);
        result.definitions.push(...definitions);
      }

      // Find missing variables
      const definedNames = new Set(result.definitions.map(d => d.name));
      const ignoredNames = new Set([...this.config.ignoreVariables, ...SYSTEM_ENV_VARS]);

      for (const usage of result.usages) {
        if (ignoredNames.has(usage.name)) continue;

        if (!definedNames.has(usage.name)) {
          result.missing.push(usage);
        }

        if (!usage.hasFallback) {
          result.requiredWithoutFallback.push(usage);
        }
      }

      // Find unused variables
      const usedNames = new Set(result.usages.map(u => u.name));
      for (const def of result.definitions) {
        if (!def.isExample && !usedNames.has(def.name) && !ignoredNames.has(def.name)) {
          result.unused.push(def);
        }
      }

      // Determine validity
      const criticalMissing = result.missing.filter(m => !m.hasFallback);
      result.valid = criticalMissing.length === 0;

      // Add warnings
      if (result.unused.length > 0) {
        result.warnings.push(`${result.unused.length} environment variable(s) defined but not used.`);
      }

      if (result.missing.length > 0 && result.missing.every(m => m.hasFallback)) {
        result.warnings.push('Some env vars are missing but have fallback values.');
      }

    } catch (error) {
      console.warn('[EnvValidator] Validation error:', error);
      result.warnings.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return result;
  }

  /**
   * Get all source files to scan
   */
  private async getSourceFiles(): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await this.webcontainer.fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;

          // Skip non-source directories
          if (entry.name.startsWith('.') ||
              entry.name === 'node_modules' ||
              entry.name === 'dist' ||
              entry.name === 'build' ||
              entry.name === 'coverage') {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (this.isSourceFile(entry.name)) {
            files.push(fullPath.replace(/^\//, ''));
          }
        }
      } catch {
        // Directory can't be read
      }
    };

    await walk('/');
    return files;
  }

  /**
   * Check if file is a source file
   */
  private isSourceFile(filename: string): boolean {
    return this.config.sourcePatterns.some(ext => filename.endsWith(ext));
  }

  /**
   * Find environment variable usages in a file
   */
  private async findEnvUsages(filePath: string): Promise<EnvUsage[]> {
    const usages: EnvUsage[] = [];

    try {
      const content = await this.webcontainer.fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Patterns to match
      const patterns = [
        // process.env.VARIABLE
        /process\.env\.([A-Z_][A-Z0-9_]*)/g,
        // process.env['VARIABLE'] or process.env["VARIABLE"]
        /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
        // import.meta.env.VARIABLE (Vite)
        /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
        // import.meta.env['VARIABLE']
        /import\.meta\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
      ];

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        for (const pattern of patterns) {
          pattern.lastIndex = 0;
          let match;

          while ((match = pattern.exec(line)) !== null) {
            const name = match[1];
            const expression = match[0];
            const type = expression.startsWith('import.meta')
              ? 'import.meta.env'
              : 'process.env';

            // Check for fallback (|| 'default' or ?? 'default')
            const afterMatch = line.slice(match.index + expression.length);
            const hasFallback = /^\s*(\|\||[?]{2})\s*['"`]/.test(afterMatch) ||
                               /^\s*(\|\||[?]{2})\s*\w/.test(afterMatch);

            usages.push({
              name,
              file: filePath,
              line: lineNum + 1,
              expression,
              type,
              hasFallback,
            });
          }
        }
      }
    } catch {
      // File can't be read
    }

    return usages;
  }

  /**
   * Parse an .env file
   */
  private async parseEnvFile(filePath: string): Promise<EnvDefinition[]> {
    const definitions: EnvDefinition[] = [];
    const isExample = filePath.includes('example') || filePath.includes('sample');

    try {
      const content = await this.webcontainer.fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        // Skip comments and empty lines
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Parse KEY=value
        const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (match) {
          const name = match[1];
          let value = match[2];

          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          // Mask sensitive values
          const maskedValue = this.maskValue(name, value);

          definitions.push({
            name,
            file: filePath,
            value: maskedValue,
            isExample,
          });
        }
      }
    } catch {
      // File doesn't exist or can't be read
    }

    return definitions;
  }

  /**
   * Mask sensitive values for display
   */
  private maskValue(name: string, value: string): string {
    // Check if this looks like a sensitive variable
    const sensitivePatterns = [
      /key/i, /secret/i, /password/i, /token/i, /auth/i,
      /api/i, /private/i, /credential/i,
    ];

    const isSensitive = sensitivePatterns.some(p => p.test(name));

    if (isSensitive && value.length > 0) {
      if (value.length <= 4) {
        return '****';
      }
      return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
    }

    return value;
  }

  /**
   * Generate a .env.example from usages
   */
  generateEnvExample(usages: EnvUsage[]): string {
    const seen = new Set<string>();
    const lines: string[] = [
      '# Environment Variables',
      '# Copy this file to .env and fill in the values',
      '',
    ];

    for (const usage of usages) {
      if (seen.has(usage.name)) continue;
      if (SYSTEM_ENV_VARS.has(usage.name)) continue;
      seen.add(usage.name);

      // Add comment with file reference
      lines.push(`# Used in ${usage.file}:${usage.line}`);
      lines.push(`${usage.name}=`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format validation result for display
   */
  formatResult(result: EnvValidationResult): string {
    const lines: string[] = ['## Environment Variable Validation', ''];

    if (result.valid) {
      lines.push('✅ All required environment variables are defined.');
    } else {
      lines.push('❌ Missing required environment variables:');
      lines.push('');

      // Group missing by variable name
      const missingByName = new Map<string, EnvUsage[]>();
      for (const usage of result.missing.filter(m => !m.hasFallback)) {
        const existing = missingByName.get(usage.name) || [];
        existing.push(usage);
        missingByName.set(usage.name, existing);
      }

      for (const [name, usages] of missingByName) {
        lines.push(`### ${name}`);
        for (const usage of usages.slice(0, 3)) {
          lines.push(`- ${usage.file}:${usage.line}`);
        }
        if (usages.length > 3) {
          lines.push(`- ... and ${usages.length - 3} more usages`);
        }
        lines.push('');
      }
    }

    // Show warnings
    if (result.warnings.length > 0) {
      lines.push('### Warnings');
      for (const warning of result.warnings) {
        lines.push(`- ⚠️ ${warning}`);
      }
      lines.push('');
    }

    // Summary
    lines.push('### Summary');
    lines.push(`- Variables used: ${new Set(result.usages.map(u => u.name)).size}`);
    lines.push(`- Variables defined: ${new Set(result.definitions.map(d => d.name)).size}`);
    lines.push(`- Files scanned: ${result.scannedFiles}`);

    return lines.join('\n');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an env validator instance
 */
export function createEnvValidator(
  webcontainer: WebContainer,
  config?: EnvValidatorConfig
): EnvValidator {
  return new EnvValidator(webcontainer, config);
}

/**
 * Quick validation check
 */
export async function validateEnv(webcontainer: WebContainer): Promise<EnvValidationResult> {
  const validator = new EnvValidator(webcontainer);
  return validator.validate();
}

/**
 * Check if env validation is needed (has .env usage)
 */
export async function hasEnvUsage(webcontainer: WebContainer): Promise<boolean> {
  const validator = new EnvValidator(webcontainer);
  const result = await validator.validate();
  return result.usages.length > 0;
}
