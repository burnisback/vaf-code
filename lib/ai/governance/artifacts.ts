/**
 * Artifact Manager
 *
 * Manages pipeline artifacts including creation, storage, and validation.
 */

import { z } from 'genkit';
import { type Stage, STAGE_CONFIGS } from './types';

/**
 * Artifact types
 */
export type ArtifactType =
  | 'requirements'
  | 'prd'
  | 'architecture'
  | 'tech-spec'
  | 'design-spec'
  | 'implementation-log'
  | 'verification-report'
  | 'release-notes';

/**
 * Artifact metadata
 */
export interface ArtifactMetadata {
  name: string;
  type: ArtifactType;
  stage: Stage;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  checksum?: string;
}

/**
 * Artifact with content
 */
export interface Artifact {
  metadata: ArtifactMetadata;
  content: string;
}

/**
 * Artifact schema for validation
 */
export const artifactSchema = z.object({
  metadata: z.object({
    name: z.string(),
    type: z.string(),
    stage: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    createdBy: z.string(),
    version: z.number(),
    checksum: z.string().optional(),
  }),
  content: z.string(),
});

/**
 * Artifact name to type mapping
 */
const ARTIFACT_TYPE_MAP: Record<string, ArtifactType> = {
  'requirements.md': 'requirements',
  'prd.md': 'prd',
  'architecture.md': 'architecture',
  'tech-spec.md': 'tech-spec',
  'design-spec.md': 'design-spec',
  'implementation-log.md': 'implementation-log',
  'verification-report.md': 'verification-report',
  'release-notes.md': 'release-notes',
};

/**
 * Artifact templates
 */
const ARTIFACT_TEMPLATES: Record<ArtifactType, string> = {
  requirements: `# Requirements

## Problem Statement
[Describe the problem or feature request]

## Acceptance Criteria
- [ ] Given [context], when [action], then [expected result]
- [ ] Given [context], when [action], then [expected result]

## Priority
[High/Medium/Low]

## Scope
### In Scope
- [Item 1]

### Out of Scope
- [Item 1]

## Definition of Done
- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Documentation updated
`,

  prd: `# Product Requirements Document

## Overview
[Brief description of the feature/fix]

## User Stories
As a [user type], I want to [action] so that [benefit].

## Acceptance Criteria
### Functional
- [ ] [Criterion 1]

### Non-Functional
- [ ] [Criterion 1]

## Out of Scope
- [Item 1]

## Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk 1] | [High/Medium/Low] | [Mitigation] |

## Dependencies
- [Dependency 1]
`,

  architecture: `# Architecture Notes

## Affected Components
- [Component 1]

## Design Patterns
- [Pattern 1]: [How it's used]

## Dependencies
- [Dependency 1]

## Data Flow
[Describe the data flow]

## Considerations
### Performance
- [Consideration 1]

### Security
- [Consideration 1]
`,

  'tech-spec': `# Technical Specification

## Overview
[Technical description of the implementation]

## Components to Modify/Create
| Component | Action | Description |
|-----------|--------|-------------|
| [File/Component] | [Create/Modify] | [Description] |

## API Contracts
### [Endpoint Name]
- Method: [GET/POST/PUT/DELETE]
- Path: [/api/...]
- Request: [Schema]
- Response: [Schema]

## Data Structures
\`\`\`typescript
// [Structure name]
interface [Name] {
  // fields
}
\`\`\`

## Implementation Approach
1. [Step 1]
2. [Step 2]

## Testing Strategy
- Unit tests for: [areas]
- Integration tests for: [areas]
- E2E tests for: [flows]

## Rollback Strategy
[How to rollback if issues arise]
`,

  'design-spec': `# Design Specification

## Visual Approach
### Colors
- Primary: [color]
- Secondary: [color]

### Typography
- Headings: [font]
- Body: [font]

### Spacing
- [Spacing guidelines]

## Component Usage
| Component | Usage |
|-----------|-------|
| [Component] | [How it's used] |

## Layout
[Layout description or diagram]

## Responsive Design
- Mobile: [considerations]
- Tablet: [considerations]
- Desktop: [considerations]

## Accessibility
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast requirements
`,

  'implementation-log': `# Implementation Log

## Summary
[Brief summary of changes]

## Files Modified
| File | Changes |
|------|---------|
| [file path] | [description] |

## Files Created
| File | Purpose |
|------|---------|
| [file path] | [description] |

## Patterns Followed
- [Pattern 1]

## Tests Written
- [Test 1]

## Known Issues
- [Issue 1]

## Notes
[Any additional notes]
`,

  'verification-report': `# Verification Report

## Build Status
- [ ] Build passes

## Lint Status
- [ ] No lint errors

## Type Check
- [ ] TypeScript compiles without errors

## Test Results
### Unit Tests
- Total: [number]
- Passed: [number]
- Failed: [number]

### Integration Tests
- Total: [number]
- Passed: [number]
- Failed: [number]

### E2E Tests
- Total: [number]
- Passed: [number]
- Failed: [number]

## Acceptance Criteria Verification
| Criterion | Status | Notes |
|-----------|--------|-------|
| [Criterion] | [Pass/Fail] | [Notes] |

## Security Scan
- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities

## Accessibility Audit
- [ ] WCAG 2.1 AA compliant
`,

  'release-notes': `# Release Notes

## Version
[Version number or identifier]

## Summary
[Brief summary of the release]

## Changes
### Features
- [Feature 1]

### Bug Fixes
- [Fix 1]

### Improvements
- [Improvement 1]

## Testing
[How to test the changes]

## Deployment Notes
[Any deployment considerations]

## Rollback Procedure
[How to rollback if needed]

## Known Issues
- [Issue 1]
`,
};

/**
 * Simple hash function for checksum
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Artifact Manager class
 */
export class ArtifactManager {
  private artifacts: Map<string, Map<string, Artifact>> = new Map();

  /**
   * Create a new artifact
   */
  createArtifact(
    workItemId: string,
    name: string,
    content: string,
    createdBy: string,
    stage: Stage
  ): Artifact {
    const type = ARTIFACT_TYPE_MAP[name] ?? ('requirements' as ArtifactType);
    const now = new Date().toISOString();

    const artifact: Artifact = {
      metadata: {
        name,
        type,
        stage,
        createdAt: now,
        updatedAt: now,
        createdBy,
        version: 1,
        checksum: simpleHash(content),
      },
      content,
    };

    // Store artifact
    if (!this.artifacts.has(workItemId)) {
      this.artifacts.set(workItemId, new Map());
    }
    this.artifacts.get(workItemId)!.set(name, artifact);

    return artifact;
  }

  /**
   * Update an artifact
   */
  updateArtifact(
    workItemId: string,
    name: string,
    content: string,
    updatedBy: string
  ): Artifact | null {
    const workItemArtifacts = this.artifacts.get(workItemId);
    if (!workItemArtifacts) return null;

    const existing = workItemArtifacts.get(name);
    if (!existing) return null;

    existing.content = content;
    existing.metadata.updatedAt = new Date().toISOString();
    existing.metadata.version += 1;
    existing.metadata.checksum = simpleHash(content);

    return existing;
  }

  /**
   * Get an artifact
   */
  getArtifact(workItemId: string, name: string): Artifact | null {
    return this.artifacts.get(workItemId)?.get(name) ?? null;
  }

  /**
   * Get all artifacts for a work item
   */
  getWorkItemArtifacts(workItemId: string): Artifact[] {
    const workItemArtifacts = this.artifacts.get(workItemId);
    if (!workItemArtifacts) return [];
    return Array.from(workItemArtifacts.values());
  }

  /**
   * Get artifact content as a map
   */
  getArtifactContents(workItemId: string): Record<string, string> {
    const artifacts = this.getWorkItemArtifacts(workItemId);
    const contents: Record<string, string> = {};
    for (const artifact of artifacts) {
      contents[artifact.metadata.name] = artifact.content;
    }
    return contents;
  }

  /**
   * Check if an artifact exists
   */
  hasArtifact(workItemId: string, name: string): boolean {
    return this.artifacts.get(workItemId)?.has(name) ?? false;
  }

  /**
   * Get missing artifacts for a stage
   */
  getMissingArtifacts(workItemId: string, stage: Stage): string[] {
    const requiredArtifacts = STAGE_CONFIGS[stage].requiredArtifacts;
    return requiredArtifacts.filter((name) => !this.hasArtifact(workItemId, name));
  }

  /**
   * Get artifact template
   */
  getTemplate(type: ArtifactType): string {
    return ARTIFACT_TEMPLATES[type] ?? '';
  }

  /**
   * Get template for artifact name
   */
  getTemplateByName(name: string): string {
    const type = ARTIFACT_TYPE_MAP[name];
    return type ? this.getTemplate(type) : '';
  }

  /**
   * Validate artifact content
   */
  validateArtifact(
    name: string,
    content: string
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Basic validation
    if (!content || content.trim().length === 0) {
      issues.push('Artifact content is empty');
    }

    // Check for template placeholders left in
    const placeholderPattern = /\[([^\]]+)\]/g;
    const placeholders = content.match(placeholderPattern);
    if (placeholders && placeholders.length > 5) {
      issues.push(
        `Too many placeholder brackets found (${placeholders.length}), content may be incomplete`
      );
    }

    // Check for required sections based on type
    const type = ARTIFACT_TYPE_MAP[name];
    if (type) {
      switch (type) {
        case 'requirements':
          if (!content.includes('Acceptance Criteria')) {
            issues.push('Missing Acceptance Criteria section');
          }
          break;
        case 'prd':
          if (!content.includes('User Stories') && !content.includes('user story')) {
            issues.push('Missing User Stories section');
          }
          break;
        case 'tech-spec':
          if (!content.includes('Implementation')) {
            issues.push('Missing Implementation section');
          }
          break;
        case 'verification-report':
          if (!content.includes('Test Results')) {
            issues.push('Missing Test Results section');
          }
          break;
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Delete an artifact
   */
  deleteArtifact(workItemId: string, name: string): boolean {
    return this.artifacts.get(workItemId)?.delete(name) ?? false;
  }

  /**
   * Clear all artifacts for a work item
   */
  clearWorkItemArtifacts(workItemId: string): void {
    this.artifacts.delete(workItemId);
  }

  /**
   * Export artifacts to JSON
   */
  exportArtifacts(workItemId: string): string {
    const artifacts = this.getWorkItemArtifacts(workItemId);
    return JSON.stringify(artifacts, null, 2);
  }

  /**
   * Import artifacts from JSON
   */
  importArtifacts(workItemId: string, json: string): void {
    const artifacts = JSON.parse(json) as Artifact[];
    if (!this.artifacts.has(workItemId)) {
      this.artifacts.set(workItemId, new Map());
    }
    const workItemArtifacts = this.artifacts.get(workItemId)!;

    for (const artifact of artifacts) {
      workItemArtifacts.set(artifact.metadata.name, artifact);
    }
  }
}

// Singleton instance
export const artifactManager = new ArtifactManager();
