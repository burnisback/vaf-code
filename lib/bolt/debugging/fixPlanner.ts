/**
 * Fix Planner
 *
 * Plans minimal fixes for identified root causes.
 * Follows the principle: NO refactoring, NO cleanup,
 * ONLY the minimum change needed to fix the error.
 */

import type {
  RootCause,
  Fix,
  FixPlan,
} from './types';
import type { ModelTier } from '../ai/modelRouter/types';

// =============================================================================
// FIX GENERATION
// =============================================================================

/**
 * Generate a unique fix ID
 */
function generateFixId(): string {
  return `fix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique plan ID
 */
function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Plan a fix for a module/import error
 */
function planImportFix(
  rootCause: RootCause,
  fileContents: Map<string, string>
): Fix[] {
  const fixes: Fix[] = [];
  const error = rootCause.primaryError;

  // Extract module name from error
  const moduleMatch = error.message.match(/['"]([^'"]+)['"]/);
  const moduleName = moduleMatch ? moduleMatch[1] : null;

  if (!moduleName) {
    return fixes;
  }

  // Determine fix type based on error message
  if (error.message.includes('Cannot find module') ||
      error.message.includes('Module not found')) {
    // Try to suggest correct import path
    const suggestedPath = suggestCorrectImportPath(moduleName, fileContents);

    if (suggestedPath && rootCause.file && rootCause.line) {
      const content = fileContents.get(rootCause.file);
      if (content) {
        const lines = content.split('\n');
        const originalLine = lines[rootCause.line - 1];

        if (originalLine) {
          fixes.push({
            id: generateFixId(),
            file: rootCause.file,
            type: 'replace_line',
            line: rootCause.line,
            original: originalLine,
            replacement: originalLine.replace(moduleName, suggestedPath),
            description: `Fix import path: '${moduleName}' → '${suggestedPath}'`,
          });
        }
      }
    }
  }

  if (error.message.includes('has no exported member')) {
    // Extract member name
    const memberMatch = error.message.match(/has no exported member ['"]([^'"]+)['"]/);
    const memberName = memberMatch ? memberMatch[1] : null;

    if (memberName) {
      fixes.push({
        id: generateFixId(),
        file: rootCause.file,
        type: 'modify_type',
        replacement: `// TODO: Fix export for '${memberName}' or use correct import`,
        description: `Check if '${memberName}' is correctly exported from ${moduleName}`,
      });
    }
  }

  return fixes;
}

/**
 * Suggest a correct import path
 */
function suggestCorrectImportPath(
  incorrectPath: string,
  fileContents: Map<string, string>
): string | null {
  const fileName = incorrectPath.split('/').pop() || '';
  const baseName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');

  // Look for files with similar names
  for (const [filePath] of fileContents) {
    const pathFileName = filePath.split('/').pop() || '';
    const pathBaseName = pathFileName.replace(/\.(ts|tsx|js|jsx)$/, '');

    if (pathBaseName.toLowerCase() === baseName.toLowerCase()) {
      // Found a match - construct relative path
      return filePath.startsWith('src/')
        ? `@/${filePath.slice(4).replace(/\.(ts|tsx)$/, '')}`
        : `./${filePath}`;
    }
  }

  return null;
}

/**
 * Plan a fix for a type error
 */
function planTypeFix(
  rootCause: RootCause,
  fileContents: Map<string, string>
): Fix[] {
  const fixes: Fix[] = [];
  const error = rootCause.primaryError;

  if (!rootCause.file || !rootCause.line) {
    return fixes;
  }

  const content = fileContents.get(rootCause.file);
  if (!content) {
    return fixes;
  }

  const lines = content.split('\n');
  const originalLine = lines[rootCause.line - 1];

  if (!originalLine) {
    return fixes;
  }

  // Property does not exist
  if (error.message.includes('Property') && error.message.includes('does not exist')) {
    const propMatch = error.message.match(/Property '([^']+)'/);
    const typeMatch = error.message.match(/on type '([^']+)'/);

    if (propMatch) {
      const propertyName = propMatch[1];
      const typeName = typeMatch ? typeMatch[1] : 'object';

      // Suggest using optional chaining
      if (originalLine.includes(`.${propertyName}`)) {
        const fixedLine = originalLine.replace(
          new RegExp(`\\.${propertyName}(?![a-zA-Z0-9])`, 'g'),
          `?.${propertyName}`
        );

        if (fixedLine !== originalLine) {
          fixes.push({
            id: generateFixId(),
            file: rootCause.file,
            type: 'replace_line',
            line: rootCause.line,
            original: originalLine,
            replacement: fixedLine,
            description: `Add optional chaining for '${propertyName}' access`,
          });
        }
      }
    }
  }

  // Type is not assignable
  if (error.message.includes('is not assignable to type')) {
    const fromMatch = error.message.match(/Type '([^']+)'/);
    const toMatch = error.message.match(/to type '([^']+)'/);

    if (fromMatch && toMatch) {
      const fromType = fromMatch[1];
      const toType = toMatch[1];

      // For string/number mismatches, suggest casting
      if ((fromType === 'string' && toType === 'number') ||
          (fromType === 'number' && toType === 'string')) {
        fixes.push({
          id: generateFixId(),
          file: rootCause.file,
          type: 'modify_type',
          line: rootCause.line,
          original: originalLine,
          replacement: `// TODO: Convert ${fromType} to ${toType} or fix type annotation`,
          description: `Type mismatch: ${fromType} → ${toType}. Check if conversion or type change is needed.`,
        });
      }

      // For undefined issues
      if (fromType.includes('undefined') || toType.includes('undefined')) {
        fixes.push({
          id: generateFixId(),
          file: rootCause.file,
          type: 'modify_type',
          line: rootCause.line,
          original: originalLine,
          replacement: originalLine.includes('!') ? originalLine : `${originalLine.trimEnd()} // Add null check`,
          description: 'Handle undefined value - add null check or assertion',
        });
      }
    }
  }

  return fixes;
}

/**
 * Plan a fix for a syntax error
 */
function planSyntaxFix(
  rootCause: RootCause,
  fileContents: Map<string, string>
): Fix[] {
  const fixes: Fix[] = [];
  const error = rootCause.primaryError;

  if (!rootCause.file || !rootCause.line) {
    return fixes;
  }

  const content = fileContents.get(rootCause.file);
  if (!content) {
    return fixes;
  }

  const lines = content.split('\n');
  const originalLine = lines[rootCause.line - 1];

  if (!originalLine) {
    return fixes;
  }

  // Expected token
  if (error.message.includes('Expected')) {
    const tokenMatch = error.message.match(/Expected ['"]?([^'"]+)['"]?/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (token) {
      // Common missing tokens
      if (token === ';') {
        fixes.push({
          id: generateFixId(),
          file: rootCause.file,
          type: 'replace_line',
          line: rootCause.line,
          original: originalLine,
          replacement: originalLine.trimEnd() + ';',
          description: 'Add missing semicolon',
        });
      } else if (token === ')' || token === '}' || token === ']') {
        fixes.push({
          id: generateFixId(),
          file: rootCause.file,
          type: 'add_line',
          line: rootCause.line,
          replacement: token,
          description: `Add missing '${token}'`,
        });
      }
    }
  }

  // Unexpected token
  if (error.message.includes('Unexpected')) {
    const tokenMatch = error.message.match(/Unexpected (?:token )?['"]?([^'"]+)['"]?/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (token && originalLine.includes(token)) {
      fixes.push({
        id: generateFixId(),
        file: rootCause.file,
        type: 'remove_line',
        line: rootCause.line,
        original: originalLine,
        replacement: originalLine.replace(token, ''),
        description: `Remove unexpected '${token}'`,
      });
    }
  }

  return fixes;
}

// =============================================================================
// MAIN PLANNER
// =============================================================================

/**
 * Plan a minimal fix for a root cause
 */
export function planFix(
  rootCause: RootCause,
  fileContents: Map<string, string>
): FixPlan {
  let fixes: Fix[] = [];
  const warnings: string[] = [];

  // Plan fix based on suggested fix type
  switch (rootCause.suggestedFixType) {
    case 'import':
      fixes = planImportFix(rootCause, fileContents);
      break;
    case 'modify':
      if (rootCause.primaryError.type === 'type') {
        fixes = planTypeFix(rootCause, fileContents);
      }
      break;
    case 'add':
    case 'remove':
      if (rootCause.primaryError.type === 'syntax') {
        fixes = planSyntaxFix(rootCause, fileContents);
      }
      break;
  }

  // If no specific fixes, create a generic investigation fix
  if (fixes.length === 0) {
    fixes.push({
      id: generateFixId(),
      file: rootCause.file,
      type: 'modify_type',
      line: rootCause.line,
      replacement: `// TODO: Fix - ${rootCause.description}`,
      description: `Manual fix required: ${rootCause.primaryError.message}`,
    });

    warnings.push('Automatic fix not available - manual intervention required');
  }

  // Validate fixes are minimal
  const isMinimal = validateMinimalFixes(fixes, fileContents);
  if (!isMinimal.valid) {
    warnings.push(isMinimal.reason || 'Fixes may be too broad');
  }

  // Determine suggested model
  const suggestedModel: ModelTier = fixes.length > 2 ? 'flash' : 'flash-lite';

  return {
    id: generatePlanId(),
    rootCause,
    fixes,
    expectedResolutions: rootCause.affectedErrorCount,
    warnings,
    isMinimal: isMinimal.valid,
    suggestedModel,
  };
}

/**
 * Validate that fixes are minimal
 */
function validateMinimalFixes(
  fixes: Fix[],
  fileContents: Map<string, string>
): { valid: boolean; reason?: string } {
  // Check number of fixes
  if (fixes.length > 5) {
    return {
      valid: false,
      reason: 'Too many fixes - consider if this is the right root cause',
    };
  }

  // Check each fix is truly minimal
  for (const fix of fixes) {
    if (fix.type === 'replace_line' && fix.original && fix.replacement) {
      // Check difference is small
      const diffLength = Math.abs(fix.original.length - fix.replacement.length);
      const totalLength = Math.max(fix.original.length, fix.replacement.length);

      if (diffLength > totalLength * 0.5 && totalLength > 20) {
        return {
          valid: false,
          reason: `Fix for ${fix.file}:${fix.line} changes too much of the line`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate a fix plan
 */
export function validateFixPlan(
  plan: FixPlan,
  fileContents: Map<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check each fix
  for (const fix of plan.fixes) {
    // Check file exists
    if (!fileContents.has(fix.file)) {
      errors.push(`File ${fix.file} not found`);
      continue;
    }

    // Check line exists
    if (fix.line) {
      const content = fileContents.get(fix.file)!;
      const lines = content.split('\n');
      if (fix.line > lines.length) {
        errors.push(`Line ${fix.line} exceeds file length in ${fix.file}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

