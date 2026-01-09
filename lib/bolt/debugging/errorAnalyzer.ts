/**
 * Error Analyzer
 *
 * Analyzes error patterns, identifies cascades, and
 * prioritizes errors for fixing.
 */

import type {
  ErrorInfo,
  ErrorCollection,
  ErrorGroup,
  ErrorAnalysis,
  ErrorCascade,
  RootCauseCandidate,
  ErrorType,
} from './types';

// =============================================================================
// GROUPING
// =============================================================================

/**
 * Group errors by file
 */
export function groupErrorsByFile(errors: ErrorInfo[]): ErrorGroup[] {
  const groupMap = new Map<string, ErrorInfo[]>();

  for (const error of errors) {
    const file = error.file || 'unknown';
    const group = groupMap.get(file) || [];
    group.push(error);
    groupMap.set(file, group);
  }

  const groups: ErrorGroup[] = [];

  for (const [file, fileErrors] of groupMap) {
    // Determine primary type (most common)
    const typeCounts = new Map<ErrorType, number>();
    for (const error of fileErrors) {
      typeCounts.set(error.type, (typeCounts.get(error.type) || 0) + 1);
    }

    let primaryType: ErrorType = 'unknown';
    let maxCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryType = type;
      }
    }

    // Calculate impact score
    const impactScore = calculateImpactScore(fileErrors);

    groups.push({
      file,
      errors: fileErrors,
      primaryType,
      impactScore,
    });
  }

  // Sort by impact score (highest first)
  return groups.sort((a, b) => b.impactScore - a.impactScore);
}

/**
 * Calculate impact score for a group of errors
 */
function calculateImpactScore(errors: ErrorInfo[]): number {
  let score = 0;

  for (const error of errors) {
    // Base score by severity
    if (error.severity === 'error') score += 10;
    else if (error.severity === 'warning') score += 3;
    else score += 1;

    // Type-specific weights
    switch (error.type) {
      case 'syntax':
        score += 15; // Syntax errors block everything
        break;
      case 'module':
        score += 12; // Module errors often cascade
        break;
      case 'type':
        score += 8; // Type errors are important but less blocking
        break;
      case 'runtime':
        score += 10;
        break;
      case 'build':
        score += 12;
        break;
      default:
        score += 5;
    }
  }

  return score;
}

// =============================================================================
// CASCADE DETECTION
// =============================================================================

/**
 * Detect cascading errors (one error causing others)
 */
export function detectCascades(errors: ErrorInfo[]): ErrorCascade[] {
  const cascades: ErrorCascade[] = [];
  const processed = new Set<string>();

  // Sort errors by line number within each file
  const sortedErrors = [...errors].sort((a, b) => {
    if (a.file !== b.file) return (a.file || '').localeCompare(b.file || '');
    return (a.line || 0) - (b.line || 0);
  });

  for (const error of sortedErrors) {
    if (processed.has(error.id)) continue;

    // Find potential cascaded errors
    const cascaded = findCascadedErrors(error, sortedErrors, processed);

    if (cascaded.length > 0) {
      cascades.push({
        source: error,
        cascaded,
        confidence: calculateCascadeConfidence(error, cascaded),
      });

      // Mark as processed
      processed.add(error.id);
      for (const c of cascaded) {
        processed.add(c.id);
      }
    }
  }

  return cascades.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Find errors that might be caused by a source error
 */
function findCascadedErrors(
  source: ErrorInfo,
  allErrors: ErrorInfo[],
  processed: Set<string>
): ErrorInfo[] {
  const cascaded: ErrorInfo[] = [];

  // Module errors can cascade to other errors in the same or importing files
  if (source.type === 'module') {
    for (const error of allErrors) {
      if (error.id === source.id || processed.has(error.id)) continue;

      // Same file, later line
      if (error.file === source.file && (error.line || 0) > (source.line || 0)) {
        if (error.type === 'type' || error.type === 'module') {
          cascaded.push(error);
        }
      }

      // Error message references the same module
      if (source.message && error.message.includes(extractModuleName(source.message))) {
        cascaded.push(error);
      }
    }
  }

  // Type errors in definitions can cascade to usage sites
  if (source.type === 'type' && source.message.includes('Property')) {
    const propertyName = extractPropertyName(source.message);
    if (propertyName) {
      for (const error of allErrors) {
        if (error.id === source.id || processed.has(error.id)) continue;
        if (error.message.includes(propertyName)) {
          cascaded.push(error);
        }
      }
    }
  }

  // Syntax errors in a file cascade to all other errors in that file
  if (source.type === 'syntax') {
    for (const error of allErrors) {
      if (error.id === source.id || processed.has(error.id)) continue;
      if (error.file === source.file) {
        cascaded.push(error);
      }
    }
  }

  return cascaded;
}

/**
 * Extract module name from error message
 */
function extractModuleName(message: string): string {
  // Match patterns like "Cannot find module 'xyz'" or "Module 'xyz' not found"
  const match = message.match(/(?:module|Module)\s+['"]([^'"]+)['"]/);
  return match ? match[1] : '';
}

/**
 * Extract property name from type error
 */
function extractPropertyName(message: string): string {
  // Match patterns like "Property 'xyz' does not exist"
  const match = message.match(/Property\s+['"]([^'"]+)['"]/);
  return match ? match[1] : '';
}

/**
 * Calculate confidence that a cascade relationship exists
 */
function calculateCascadeConfidence(source: ErrorInfo, cascaded: ErrorInfo[]): number {
  let confidence = 0.5; // Base confidence

  // More cascaded errors = higher confidence
  if (cascaded.length >= 3) confidence += 0.2;
  else if (cascaded.length >= 1) confidence += 0.1;

  // Syntax errors almost always cascade
  if (source.type === 'syntax') confidence += 0.3;

  // Module errors often cascade
  if (source.type === 'module') confidence += 0.2;

  // First error in file is more likely to be source
  if (source.line === 1 || (source.line || 0) < 10) confidence += 0.1;

  return Math.min(1, confidence);
}

// =============================================================================
// ROOT CAUSE IDENTIFICATION
// =============================================================================

/**
 * Identify root cause candidates from error analysis
 */
export function identifyRootCauseCandidates(
  groups: ErrorGroup[],
  cascades: ErrorCascade[]
): RootCauseCandidate[] {
  const candidates: RootCauseCandidate[] = [];
  const seen = new Set<string>();

  // Cascade sources are good root cause candidates
  for (const cascade of cascades) {
    if (seen.has(cascade.source.id)) continue;
    seen.add(cascade.source.id);

    candidates.push({
      error: cascade.source,
      confidence: cascade.confidence,
      reasoning: `This error appears to cause ${cascade.cascaded.length} other error(s)`,
      cascadeCount: cascade.cascaded.length,
    });
  }

  // First errors in high-impact groups are also candidates
  for (const group of groups) {
    if (group.errors.length === 0) continue;

    // Sort by line number to get first error
    const sorted = [...group.errors].sort((a, b) => (a.line || 0) - (b.line || 0));
    const firstError = sorted[0];

    if (seen.has(firstError.id)) continue;
    seen.add(firstError.id);

    // Higher impact groups = more likely root cause
    const confidence = Math.min(1, group.impactScore / 100);

    candidates.push({
      error: firstError,
      confidence,
      reasoning: `First error in ${group.file} with impact score ${group.impactScore}`,
      cascadeCount: 0,
    });
  }

  // Sort by confidence (highest first)
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Prioritize errors for fixing
 */
export function prioritizeErrors(
  groups: ErrorGroup[],
  cascades: ErrorCascade[]
): string[] {
  const priorityMap = new Map<string, number>();

  // Cascade sources get highest priority
  for (let i = 0; i < cascades.length; i++) {
    const cascade = cascades[i];
    const priority = 1000 - i; // Higher index = lower priority
    priorityMap.set(cascade.source.id, priority);
  }

  // Then add by group impact
  for (const group of groups) {
    for (let i = 0; i < group.errors.length; i++) {
      const error = group.errors[i];
      if (!priorityMap.has(error.id)) {
        const priority = group.impactScore - i;
        priorityMap.set(error.id, priority);
      }
    }
  }

  // Sort by priority
  return [...priorityMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

// =============================================================================
// MAIN ANALYZER
// =============================================================================

/**
 * Analyze an error collection
 */
export function analyzeErrors(collection: ErrorCollection): ErrorAnalysis {
  // Group errors by file
  const groups = groupErrorsByFile(collection.errors);

  // Detect cascades
  const cascades = detectCascades(collection.errors);

  // Identify root cause candidates
  const rootCauseCandidates = identifyRootCauseCandidates(groups, cascades);

  // Prioritize errors
  const priorityOrder = prioritizeErrors(groups, cascades);

  // Calculate stats
  const primaryType = groups.length > 0 ? groups[0].primaryType : 'unknown';
  const estimatedRootCauses = cascades.length + groups.filter(
    (g) => !cascades.some((c) => c.source.file === g.file)
  ).length;

  return {
    groups,
    cascades,
    priorityOrder,
    rootCauseCandidates,
    stats: {
      totalErrors: collection.total,
      uniqueFiles: collection.affectedFiles.length,
      primaryType,
      estimatedRootCauses: Math.min(estimatedRootCauses, collection.total),
    },
  };
}

