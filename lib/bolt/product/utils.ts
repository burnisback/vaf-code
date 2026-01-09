/**
 * Product Utilities (Client-Safe)
 *
 * Client-safe utility functions for working with PRDs.
 * No genkit or Node.js-specific dependencies.
 */

import type { ProductRequirementsDocument, FeatureSpecification } from './types';

// =============================================================================
// MARKDOWN EXPORT
// =============================================================================

/**
 * Export PRD to markdown format
 */
export function exportPRDToMarkdown(prd: ProductRequirementsDocument): string {
  const lines: string[] = [];

  lines.push(`# ${prd.name}`);
  lines.push(`> ${prd.tagline}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push(prd.summary);
  lines.push('');

  // Problem Statement
  lines.push('## Problem Statement');
  lines.push(prd.problem.statement);
  lines.push('');
  lines.push('### Current Solutions');
  for (const sol of prd.problem.currentSolutions) {
    lines.push(`- ${sol}`);
  }
  lines.push('');
  lines.push('### Pain Points');
  for (const pain of prd.problem.painPoints) {
    lines.push(`- ${pain}`);
  }
  lines.push('');
  lines.push('### Market Opportunity');
  lines.push(prd.problem.marketGap);
  lines.push('');

  // Target Audience
  lines.push('## Target Audience');
  for (const audience of prd.audience) {
    lines.push(`### ${audience.name}`);
    lines.push(audience.description);
    lines.push('');
    lines.push('**Needs:**');
    for (const need of audience.needs) {
      lines.push(`- ${need}`);
    }
    lines.push('');
    lines.push(`**Value Proposition:** ${audience.value}`);
    lines.push('');
  }

  // Goals
  lines.push('## Product Goals');
  for (const goal of prd.goals) {
    lines.push(`### ${goal.description}`);
    lines.push(`*Type: ${goal.type} | Priority: ${goal.priority} | Target: ${goal.timeframe || 'TBD'}*`);
    lines.push('');
    lines.push('Success Criteria:');
    for (const criteria of goal.successCriteria) {
      lines.push(`- ${criteria}`);
    }
    lines.push('');
  }

  // Features
  lines.push('## Features');
  lines.push('');

  const byRelease = prd.features.reduce((acc, f) => {
    const key = f.releaseTarget;
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {} as Record<string, FeatureSpecification[]>);

  for (const [release, features] of Object.entries(byRelease)) {
    lines.push(`### ${release.toUpperCase()} Features`);
    lines.push('');

    for (const feature of features) {
      lines.push(`#### ${feature.name} [${feature.priority.toUpperCase()}]`);
      lines.push(`*Category: ${feature.category} | Complexity: ${feature.complexity}/5*`);
      lines.push('');
      lines.push(feature.description);
      lines.push('');
      lines.push(`**User Benefit:** ${feature.benefit}`);
      lines.push('');

      if (feature.userStories.length > 0) {
        lines.push('**User Stories:**');
        for (const story of feature.userStories) {
          lines.push(`- As a ${story.role}, I want to ${story.action}, so that ${story.benefit}`);
        }
        lines.push('');
      }

      if (feature.acceptanceCriteria.length > 0) {
        lines.push('**Acceptance Criteria:**');
        for (const ac of feature.acceptanceCriteria) {
          lines.push(`- [ ] ${ac}`);
        }
        lines.push('');
      }

      if (feature.technicalNotes) {
        lines.push(`**Technical Notes:** ${feature.technicalNotes}`);
        lines.push('');
      }
    }
  }

  // Non-Functional Requirements
  lines.push('## Non-Functional Requirements');
  lines.push('');
  lines.push('### Performance');
  lines.push(`- Page Load Time: ${prd.nonFunctional.performance.pageLoadTime}`);
  lines.push(`- API Response Time: ${prd.nonFunctional.performance.apiResponseTime}`);
  lines.push(`- Concurrent Users: ${prd.nonFunctional.performance.concurrentUsers}`);
  lines.push('');
  lines.push('### Security');
  lines.push(`- Authentication: ${prd.nonFunctional.security.authentication.join(', ')}`);
  lines.push(`- Authorization: ${prd.nonFunctional.security.authorization.join(', ')}`);
  lines.push(`- Compliance: ${prd.nonFunctional.security.compliance.join(', ') || 'TBD'}`);
  lines.push('');
  lines.push('### Accessibility');
  lines.push(`- WCAG Level: ${prd.nonFunctional.accessibility.wcagLevel}`);
  lines.push('');

  // Success Metrics
  lines.push('## Success Metrics');
  for (const metric of prd.metrics) {
    lines.push(`### ${metric.name} ${metric.priority === 'primary' ? '(Primary)' : ''}`);
    lines.push(metric.description);
    lines.push(`- **Target:** ${metric.target}`);
    lines.push(`- **Measurement:** ${metric.measurement}`);
    lines.push('');
  }

  // Constraints
  if (prd.constraints.length > 0) {
    lines.push('## Constraints');
    for (const constraint of prd.constraints) {
      lines.push(`### ${constraint.type.toUpperCase()}: ${constraint.description}`);
      lines.push(`**Impact:** ${constraint.impact}`);
      if (constraint.mitigation) {
        lines.push(`**Mitigation:** ${constraint.mitigation}`);
      }
      lines.push('');
    }
  }

  // Open Questions
  if (prd.openQuestions.length > 0) {
    lines.push('## Open Questions');
    for (const question of prd.openQuestions) {
      lines.push(`- [ ] ${question}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Generated: ${new Date().toISOString()} | Version: ${prd.version} | Status: ${prd.status}*`);

  return lines.join('\n');
}

// =============================================================================
// PRD STATISTICS
// =============================================================================

/**
 * Get feature statistics from PRD
 */
export function getPRDFeatureStats(prd: ProductRequirementsDocument): {
  total: number;
  must: number;
  should: number;
  could: number;
  wont: number;
  mvp: number;
  v1: number;
  v2: number;
  future: number;
  totalComplexity: number;
  avgComplexity: number;
} {
  const features = prd.features;
  const total = features.length;

  return {
    total,
    must: features.filter(f => f.priority === 'must').length,
    should: features.filter(f => f.priority === 'should').length,
    could: features.filter(f => f.priority === 'could').length,
    wont: features.filter(f => f.priority === 'wont').length,
    mvp: features.filter(f => f.releaseTarget === 'mvp').length,
    v1: features.filter(f => f.releaseTarget === 'v1').length,
    v2: features.filter(f => f.releaseTarget === 'v2').length,
    future: features.filter(f => f.releaseTarget === 'future').length,
    totalComplexity: features.reduce((sum, f) => sum + f.complexity, 0),
    avgComplexity: total > 0 ? features.reduce((sum, f) => sum + f.complexity, 0) / total : 0,
  };
}

/**
 * Get PRD completeness score
 */
export function getPRDCompleteness(prd: ProductRequirementsDocument): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  // Check required sections
  if (!prd.summary || prd.summary.length < 50) {
    issues.push('Summary is too short');
    score -= 10;
  }

  if (!prd.problem.statement) {
    issues.push('Missing problem statement');
    score -= 15;
  }

  if (prd.audience.length === 0) {
    issues.push('No target audience defined');
    score -= 10;
  }

  if (prd.goals.length === 0) {
    issues.push('No product goals defined');
    score -= 10;
  }

  if (prd.features.length === 0) {
    issues.push('No features defined');
    score -= 20;
  }

  // Check features quality
  const featuresWithoutStories = prd.features.filter(f => f.userStories.length === 0);
  if (featuresWithoutStories.length > prd.features.length / 2) {
    issues.push('Most features lack user stories');
    score -= 10;
  }

  const featuresWithoutCriteria = prd.features.filter(f => f.acceptanceCriteria.length === 0);
  if (featuresWithoutCriteria.length > prd.features.length / 2) {
    issues.push('Most features lack acceptance criteria');
    score -= 10;
  }

  // Check MVP features
  const mustFeatures = prd.features.filter(f => f.priority === 'must');
  if (mustFeatures.length === 0) {
    issues.push('No must-have features defined');
    score -= 15;
  }

  // Check metrics
  if (prd.metrics.length === 0) {
    issues.push('No success metrics defined');
    score -= 10;
  }

  return {
    score: Math.max(0, score),
    issues,
  };
}

/**
 * Validate PRD structure
 */
export function validatePRD(prd: ProductRequirementsDocument): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!prd.id) errors.push('Missing PRD ID');
  if (!prd.name) errors.push('Missing product name');
  if (!prd.summary) errors.push('Missing summary');

  // Check feature IDs are unique
  const featureIds = new Set<string>();
  for (const feature of prd.features) {
    if (featureIds.has(feature.id)) {
      errors.push(`Duplicate feature ID: ${feature.id}`);
    }
    featureIds.add(feature.id);
  }

  // Check feature dependencies exist
  for (const feature of prd.features) {
    for (const depId of feature.dependencies) {
      if (!featureIds.has(depId)) {
        warnings.push(`Feature ${feature.id} depends on non-existent feature: ${depId}`);
      }
    }
  }

  // Check goal IDs are unique
  const goalIds = new Set<string>();
  for (const goal of prd.goals) {
    if (goalIds.has(goal.id)) {
      errors.push(`Duplicate goal ID: ${goal.id}`);
    }
    goalIds.add(goal.id);
  }

  // Warnings for incomplete data
  if (prd.openQuestions.length > 5) {
    warnings.push('Many open questions - consider addressing before development');
  }

  const mustCount = prd.features.filter(f => f.priority === 'must').length;
  if (mustCount > 10) {
    warnings.push('Too many must-have features - consider reducing MVP scope');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
