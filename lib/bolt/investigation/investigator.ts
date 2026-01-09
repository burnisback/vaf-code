/**
 * Investigator Core
 *
 * Handles investigation logic for different request types.
 * Ensures files are read before being modified.
 */

import type { WebContainer } from '@webcontainer/api';
import type {
  InvestigationContext,
  InvestigationResult,
  InvestigationFinding,
  InvestigationTodo,
  FilesToReadPlan,
  FileToRead,
  FileReadResult,
  InvestigationConfig,
  ReadTracker,
} from './types';
import {
  DEFAULT_INVESTIGATION_CONFIG,
  createReadTracker,
  markAsRead,
  hasBeenRead,
} from './types';
import {
  searchByFilename,
  searchByContent,
  searchByRelatedConcept,
  findRelatedByImports,
  extractKeywords,
} from './fileSearch';
import type { ModelTier } from '../ai/modelRouter/types';

// =============================================================================
// INVESTIGATOR CLASS
// =============================================================================

export class Investigator {
  private config: InvestigationConfig;
  private readTracker: ReadTracker;

  constructor(config: Partial<InvestigationConfig> = {}) {
    this.config = { ...DEFAULT_INVESTIGATION_CONFIG, ...config };
    this.readTracker = createReadTracker();
  }

  // ===========================================================================
  // INVESTIGATION METHODS
  // ===========================================================================

  /**
   * Investigate for an implementation request
   */
  async investigateImplementation(
    context: InvestigationContext
  ): Promise<InvestigationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Identify files to read
      const filesToRead = this.planFilesToRead(context, 'implementation');

      // Step 2: Generate findings
      const findings = this.generateImplementationFindings(context, filesToRead);

      // Step 3: Generate suggested todos
      const suggestedTodos = this.generateImplementationTodos(context, filesToRead);

      // Step 4: Generate suggested approach
      const suggestedApproach = this.generateImplementationApproach(context, findings);

      return {
        success: true,
        filesToRead,
        filesRead: [], // Actual reading happens via WebContainer
        findings,
        suggestedApproach,
        suggestedTodos,
        tokenUsage: {
          input: 0, // Will be filled by API layer
          output: 0,
          model: 'flash-lite' as ModelTier,
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        filesToRead: { required: [], optional: [], reasoning: '' },
        filesRead: [],
        findings: [],
        tokenUsage: { input: 0, output: 0, model: 'flash-lite' as ModelTier },
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Investigation failed',
      };
    }
  }

  /**
   * Investigate errors for debugging
   */
  async investigateErrors(
    context: InvestigationContext
  ): Promise<InvestigationResult> {
    const startTime = Date.now();

    try {
      const errors = context.errors || [];

      // Step 1: Parse error locations
      const errorLocations = this.parseErrorLocations(errors);

      // Step 2: Plan files to read (prioritize error locations)
      const filesToRead = this.planFilesToReadForErrors(context, errorLocations);

      // Step 3: Generate findings based on error patterns
      const findings = this.generateErrorFindings(context, errors);

      // Step 4: Generate debug todos
      const suggestedTodos = this.generateDebugTodos(context, errors, filesToRead);

      return {
        success: true,
        filesToRead,
        filesRead: [],
        findings,
        suggestedApproach: this.generateDebugApproach(errors, findings),
        suggestedTodos,
        tokenUsage: {
          input: 0,
          output: 0,
          model: 'flash-lite' as ModelTier,
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        filesToRead: { required: [], optional: [], reasoning: '' },
        filesRead: [],
        findings: [],
        tokenUsage: { input: 0, output: 0, model: 'flash-lite' as ModelTier },
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Error investigation failed',
      };
    }
  }

  /**
   * Investigate to answer a question
   */
  async investigateQuestion(
    context: InvestigationContext
  ): Promise<InvestigationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Identify relevant files based on question
      const filesToRead = this.planFilesToReadForQuestion(context);

      // Step 2: Generate findings
      const findings = this.generateQuestionFindings(context);

      // Step 3: Simple todos for question mode
      const suggestedTodos: InvestigationTodo[] = [
        {
          content: 'Understand the question and gather context',
          activeForm: 'Understanding the question',
          type: 'investigate',
          model: 'flash-lite',
        },
        {
          content: 'Formulate comprehensive answer',
          activeForm: 'Formulating answer',
          type: 'execute',
          model: 'flash-lite',
        },
      ];

      return {
        success: true,
        filesToRead,
        filesRead: [],
        findings,
        suggestedTodos,
        tokenUsage: {
          input: 0,
          output: 0,
          model: 'flash-lite' as ModelTier,
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        filesToRead: { required: [], optional: [], reasoning: '' },
        filesRead: [],
        findings: [],
        tokenUsage: { input: 0, output: 0, model: 'flash-lite' as ModelTier },
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Question investigation failed',
      };
    }
  }

  // ===========================================================================
  // FILE PLANNING
  // ===========================================================================

  /**
   * Plan which files to read for an implementation
   */
  private planFilesToRead(
    context: InvestigationContext,
    type: 'implementation' | 'refactor'
  ): FilesToReadPlan {
    const required: FileToRead[] = [];
    const optional: FileToRead[] = [];

    // Search for files related to the prompt
    const relatedFiles = searchByRelatedConcept(
      context.prompt,
      context.projectFiles,
      { maxResults: 10 }
    );

    // Categorize by relevance
    for (const result of relatedFiles) {
      const fileToRead: FileToRead = {
        filePath: result.filePath,
        reason: `Related to "${extractKeywords(context.prompt).slice(0, 3).join(', ')}"`,
        priority: Math.round(result.relevance * 10),
      };

      if (result.relevance >= 0.7) {
        required.push(fileToRead);
      } else {
        optional.push(fileToRead);
      }
    }

    // Add common files based on mode
    if (context.mode === 'complex' || context.mode === 'mega-complex') {
      // Look for config files
      const configFiles = context.projectFiles.filter(
        (f) =>
          f.includes('config') ||
          f.endsWith('tsconfig.json') ||
          f.endsWith('package.json')
      );
      for (const configFile of configFiles.slice(0, 3)) {
        optional.push({
          filePath: configFile,
          reason: 'Configuration context',
          priority: 3,
        });
      }
    }

    // Sort by priority
    required.sort((a, b) => b.priority - a.priority);
    optional.sort((a, b) => b.priority - a.priority);

    // Limit to config max
    const limitedRequired = required.slice(0, this.config.maxFilesToRead);
    const limitedOptional = optional.slice(0, this.config.maxFilesToRead - limitedRequired.length);

    return {
      required: limitedRequired,
      optional: limitedOptional,
      reasoning: this.generateReadPlanReasoning(limitedRequired, limitedOptional, context),
    };
  }

  /**
   * Plan files to read for error investigation
   */
  private planFilesToReadForErrors(
    context: InvestigationContext,
    errorLocations: Array<{ file?: string; line?: number }>
  ): FilesToReadPlan {
    const required: FileToRead[] = [];
    const optional: FileToRead[] = [];

    // Add files mentioned in errors (highest priority)
    for (const loc of errorLocations) {
      if (loc.file) {
        const existing = required.find((f) => f.filePath === loc.file);
        if (!existing) {
          required.push({
            filePath: loc.file,
            reason: 'Contains error',
            priority: 10,
            lineRange: loc.line
              ? { start: Math.max(1, loc.line - 10), end: loc.line + 10 }
              : undefined,
          });
        }
      }
    }

    // Look for related files (imports, tests)
    for (const errorFile of required) {
      const related = this.findRelatedFiles(errorFile.filePath, context.projectFiles);
      for (const relatedFile of related) {
        if (!required.find((f) => f.filePath === relatedFile)) {
          optional.push({
            filePath: relatedFile,
            reason: `Related to ${errorFile.filePath}`,
            priority: 5,
          });
        }
      }
    }

    return {
      required: required.slice(0, this.config.maxFilesToRead),
      optional: optional.slice(0, 5),
      reasoning: `Reading ${required.length} file(s) with errors and ${optional.length} related file(s)`,
    };
  }

  /**
   * Plan files to read for a question
   */
  private planFilesToReadForQuestion(context: InvestigationContext): FilesToReadPlan {
    const required: FileToRead[] = [];
    const optional: FileToRead[] = [];

    // Search for relevant files
    const results = searchByRelatedConcept(context.prompt, context.projectFiles, {
      maxResults: 5,
    });

    for (const result of results) {
      if (result.relevance >= 0.6) {
        required.push({
          filePath: result.filePath,
          reason: 'May contain answer',
          priority: Math.round(result.relevance * 10),
        });
      } else {
        optional.push({
          filePath: result.filePath,
          reason: 'Potentially relevant',
          priority: Math.round(result.relevance * 10),
        });
      }
    }

    return {
      required,
      optional,
      reasoning: `Identified ${required.length} files likely to contain the answer`,
    };
  }

  // ===========================================================================
  // FINDINGS GENERATION
  // ===========================================================================

  /**
   * Generate findings for implementation
   */
  private generateImplementationFindings(
    context: InvestigationContext,
    filesToRead: FilesToReadPlan
  ): InvestigationFinding[] {
    const findings: InvestigationFinding[] = [];

    // Finding: Related files exist
    if (filesToRead.required.length > 0) {
      findings.push({
        type: 'pattern',
        description: `Found ${filesToRead.required.length} existing file(s) related to this feature`,
        files: filesToRead.required.map((f) => f.filePath),
        confidence: 0.8,
        suggestion: 'Review these files before implementing to maintain consistency',
      });
    }

    // Finding: No related files (new feature)
    if (filesToRead.required.length === 0 && filesToRead.optional.length === 0) {
      findings.push({
        type: 'opportunity',
        description: 'No existing files match this feature - this appears to be a new component',
        files: [],
        confidence: 0.7,
        suggestion: 'Create new files following project conventions',
      });
    }

    // Finding: Framework-specific patterns
    if (context.framework) {
      findings.push({
        type: 'pattern',
        description: `Project uses ${context.framework} framework`,
        files: [],
        confidence: 0.95,
        suggestion: `Follow ${context.framework} conventions and patterns`,
      });
    }

    return findings;
  }

  /**
   * Generate findings for errors
   */
  private generateErrorFindings(
    context: InvestigationContext,
    errors: string[]
  ): InvestigationFinding[] {
    const findings: InvestigationFinding[] = [];

    // Categorize errors
    const typeErrors = errors.filter((e) => e.includes('Type') || e.includes('TS'));
    const moduleErrors = errors.filter((e) => e.includes('Module') || e.includes('Cannot find'));
    const syntaxErrors = errors.filter((e) => e.includes('Syntax') || e.includes('Unexpected'));

    if (typeErrors.length > 0) {
      findings.push({
        type: 'pattern',
        description: `${typeErrors.length} TypeScript type error(s) detected`,
        files: this.extractFilesFromErrors(typeErrors),
        confidence: 0.9,
        suggestion: 'Check type definitions and ensure proper typing',
      });
    }

    if (moduleErrors.length > 0) {
      findings.push({
        type: 'dependency',
        description: `${moduleErrors.length} module/import error(s) detected`,
        files: this.extractFilesFromErrors(moduleErrors),
        confidence: 0.9,
        suggestion: 'Verify import paths and ensure dependencies are installed',
      });
    }

    if (syntaxErrors.length > 0) {
      findings.push({
        type: 'warning',
        description: `${syntaxErrors.length} syntax error(s) detected`,
        files: this.extractFilesFromErrors(syntaxErrors),
        confidence: 0.95,
        suggestion: 'Fix syntax issues before proceeding',
      });
    }

    return findings;
  }

  /**
   * Generate findings for questions
   */
  private generateQuestionFindings(context: InvestigationContext): InvestigationFinding[] {
    const findings: InvestigationFinding[] = [];

    // Check if question is about specific files
    const keywords = extractKeywords(context.prompt);
    const matchingFiles = searchByRelatedConcept(context.prompt, context.projectFiles, {
      maxResults: 5,
    });

    if (matchingFiles.length > 0) {
      findings.push({
        type: 'pattern',
        description: `Found ${matchingFiles.length} file(s) that may contain relevant information`,
        files: matchingFiles.map((f) => f.filePath),
        confidence: 0.7,
      });
    }

    return findings;
  }

  // ===========================================================================
  // TODO GENERATION
  // ===========================================================================

  /**
   * Generate implementation todos
   */
  private generateImplementationTodos(
    context: InvestigationContext,
    filesToRead: FilesToReadPlan
  ): InvestigationTodo[] {
    const todos: InvestigationTodo[] = [];

    // Read todos for required files
    for (const file of filesToRead.required.slice(0, 3)) {
      todos.push({
        content: `Read ${file.filePath} to understand existing implementation`,
        activeForm: `Reading ${file.filePath.split('/').pop()}`,
        type: 'read',
        files: [file.filePath],
        model: 'flash-lite',
      });
    }

    // Planning todo for moderate+ complexity
    if (context.mode !== 'simple' && context.mode !== 'question') {
      todos.push({
        content: 'Create implementation plan',
        activeForm: 'Creating implementation plan',
        type: 'plan',
        model: 'flash',
      });
    }

    // Execute todo
    todos.push({
      content: 'Implement the requested changes',
      activeForm: 'Implementing changes',
      type: 'execute',
      model: context.mode === 'complex' || context.mode === 'mega-complex' ? 'pro' : 'flash',
    });

    // Verify todo
    todos.push({
      content: 'Verify changes compile without errors',
      activeForm: 'Verifying changes',
      type: 'verify',
      model: 'flash-lite',
    });

    return todos;
  }

  /**
   * Generate debug todos
   */
  private generateDebugTodos(
    context: InvestigationContext,
    errors: string[],
    filesToRead: FilesToReadPlan
  ): InvestigationTodo[] {
    const todos: InvestigationTodo[] = [];

    // Collect error information
    todos.push({
      content: 'Collect all error information',
      activeForm: 'Collecting error information',
      type: 'investigate',
      model: 'flash-lite',
    });

    // Analyze errors
    todos.push({
      content: 'Parse and categorize errors',
      activeForm: 'Analyzing errors',
      type: 'investigate',
      model: 'flash-lite',
    });

    // Read affected files
    const affectedFiles = filesToRead.required.map((f) => f.filePath);
    todos.push({
      content: `Read ${affectedFiles.length} affected file(s)`,
      activeForm: 'Reading affected files',
      type: 'read',
      files: affectedFiles,
      model: 'flash',
    });

    // Identify root cause
    todos.push({
      content: 'Identify root cause with evidence',
      activeForm: 'Identifying root cause',
      type: 'investigate',
      model: 'flash',
    });

    // Plan fix
    todos.push({
      content: 'Plan minimal fix (no refactoring)',
      activeForm: 'Planning fix',
      type: 'plan',
      model: 'flash',
    });

    // Execute fix
    todos.push({
      content: 'Execute minimal fix',
      activeForm: 'Executing fix',
      type: 'execute',
      model: 'flash',
    });

    // Verify fix
    todos.push({
      content: 'Verify fix resolved the error',
      activeForm: 'Verifying fix',
      type: 'verify',
      model: 'flash-lite',
    });

    return todos;
  }

  // ===========================================================================
  // APPROACH GENERATION
  // ===========================================================================

  /**
   * Generate suggested approach for implementation
   */
  private generateImplementationApproach(
    context: InvestigationContext,
    findings: InvestigationFinding[]
  ): string {
    const parts: string[] = [];

    // Start with mode-specific intro
    switch (context.mode) {
      case 'simple':
        parts.push('This is a simple change requiring 1-2 file modifications.');
        break;
      case 'moderate':
        parts.push('This is a moderate change requiring 3-5 file modifications.');
        break;
      case 'complex':
        parts.push('This is a complex feature requiring 6-15 file modifications and careful planning.');
        break;
      case 'mega-complex':
        parts.push('This is a mega-complex project requiring extensive planning and phased implementation.');
        break;
    }

    // Add findings-based suggestions
    for (const finding of findings) {
      if (finding.suggestion) {
        parts.push(finding.suggestion);
      }
    }

    // Add framework-specific guidance
    if (context.framework) {
      parts.push(`Follow ${context.framework} best practices.`);
    }

    return parts.join(' ');
  }

  /**
   * Generate suggested approach for debugging
   */
  private generateDebugApproach(
    errors: string[],
    findings: InvestigationFinding[]
  ): string {
    const parts: string[] = [];

    parts.push(`Investigating ${errors.length} error(s).`);

    // Summarize error types
    const hasTypeErrors = findings.some((f) => f.description.includes('type error'));
    const hasModuleErrors = findings.some((f) => f.description.includes('module'));
    const hasSyntaxErrors = findings.some((f) => f.description.includes('syntax'));

    if (hasSyntaxErrors) {
      parts.push('Priority: Fix syntax errors first as they prevent other analysis.');
    } else if (hasModuleErrors) {
      parts.push('Focus on fixing import/module resolution issues.');
    } else if (hasTypeErrors) {
      parts.push('Focus on resolving TypeScript type mismatches.');
    }

    parts.push('Make minimal changes to fix errors without introducing new ones.');

    return parts.join(' ');
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Parse error strings to extract file locations
   */
  private parseErrorLocations(errors: string[]): Array<{ file?: string; line?: number }> {
    const locations: Array<{ file?: string; line?: number }> = [];

    for (const error of errors) {
      // Match patterns like "src/file.ts:10:5" or "./file.tsx(15,10)"
      const match = error.match(/([./\w-]+\.[tj]sx?)[:(](\d+)/);
      if (match) {
        locations.push({
          file: match[1],
          line: parseInt(match[2], 10),
        });
      }
    }

    return locations;
  }

  /**
   * Extract file paths from error messages
   */
  private extractFilesFromErrors(errors: string[]): string[] {
    const files = new Set<string>();

    for (const error of errors) {
      const match = error.match(/([./\w-]+\.[tj]sx?)/);
      if (match) {
        files.add(match[1]);
      }
    }

    return [...files];
  }

  /**
   * Find files related to a given file
   */
  private findRelatedFiles(filePath: string, projectFiles: string[]): string[] {
    const related: string[] = [];
    const baseName = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || '';

    // Find test file
    const testPatterns = [
      `${baseName}.test.ts`,
      `${baseName}.test.tsx`,
      `${baseName}.spec.ts`,
      `${baseName}.spec.tsx`,
    ];

    for (const pattern of testPatterns) {
      const match = projectFiles.find((f) => f.endsWith(pattern));
      if (match) {
        related.push(match);
        break;
      }
    }

    // Find index file if this is a component
    if (filePath.includes('/components/')) {
      const dir = filePath.split('/').slice(0, -1).join('/');
      const indexFile = `${dir}/index.ts`;
      if (projectFiles.includes(indexFile)) {
        related.push(indexFile);
      }
    }

    return related;
  }

  /**
   * Generate reasoning for the read plan
   */
  private generateReadPlanReasoning(
    required: FileToRead[],
    optional: FileToRead[],
    context: InvestigationContext
  ): string {
    const parts: string[] = [];

    if (required.length > 0) {
      parts.push(`${required.length} file(s) must be read before making changes.`);
    }

    if (optional.length > 0) {
      parts.push(`${optional.length} additional file(s) may provide useful context.`);
    }

    if (context.mode === 'complex' || context.mode === 'mega-complex') {
      parts.push('Complex mode requires thorough investigation.');
    }

    return parts.join(' ');
  }

  // ===========================================================================
  // READ TRACKING
  // ===========================================================================

  /**
   * Check if a file has been read
   */
  hasFileBeenRead(filePath: string): boolean {
    return hasBeenRead(this.readTracker, filePath);
  }

  /**
   * Mark a file as read
   */
  markFileAsRead(filePath: string, content?: string): void {
    markAsRead(this.readTracker, filePath, content);
  }

  /**
   * Get the read tracker
   */
  getReadTracker(): ReadTracker {
    return this.readTracker;
  }

  /**
   * Reset the read tracker
   */
  resetReadTracker(): void {
    this.readTracker = createReadTracker();
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new investigator instance
 */
export function createInvestigator(
  config?: Partial<InvestigationConfig>
): Investigator {
  return new Investigator(config);
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick investigation for a prompt
 */
export async function investigate(
  context: InvestigationContext,
  config?: Partial<InvestigationConfig>
): Promise<InvestigationResult> {
  const investigator = createInvestigator(config);

  // Check if this is an error investigation
  if (context.errors && context.errors.length > 0) {
    return investigator.investigateErrors(context);
  }

  // Check if this is a question
  if (context.mode === 'question') {
    return investigator.investigateQuestion(context);
  }

  // Default to implementation investigation
  return investigator.investigateImplementation(context);
}
