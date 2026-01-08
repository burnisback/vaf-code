/**
 * Architecture Reviewer
 *
 * Reviews architecture decisions, tech specs, and design patterns.
 */

import { ReviewerAgent, type ReviewerConfig } from '../reviewer';

/**
 * Architecture review criteria
 */
const ARCHITECTURE_REVIEW_CRITERIA = [
  'Architecture aligns with project requirements and constraints',
  'Design patterns are appropriate for the use case',
  'Components have clear responsibilities (single responsibility)',
  'Dependencies are minimized and well-managed',
  'Scalability considerations are addressed',
  'Data flow is clear and traceable',
  'Error boundaries and failure modes are defined',
  'API contracts are clear and well-documented',
  'State management strategy is appropriate',
  'Performance implications are considered',
  'Maintainability and extensibility are prioritized',
  'Security considerations are built into the design',
  'Testing strategy is feasible with the architecture',
  'No circular dependencies or tight coupling',
];

/**
 * Architecture reviewer system prompt
 */
const ARCHITECTURE_REVIEWER_PROMPT = `You are a solutions architect reviewing technical architecture.

Your role is to evaluate:
- Architectural decisions and trade-offs
- Design pattern selection and application
- Component structure and responsibilities
- Data flow and state management
- Scalability and performance considerations
- Security architecture
- Maintainability and technical debt

Focus on decisions that have long-term implications.
Suggest improvements but recognize that perfect architecture
is less valuable than shipped product.

When reviewing:
- Check alignment with stated requirements
- Verify design patterns are used correctly
- Assess complexity vs. necessity trade-offs
- Consider future extensibility needs`;

/**
 * Architecture reviewer configuration
 */
const architectureReviewerConfig: ReviewerConfig = {
  name: 'Architecture Reviewer',
  agent: 'vaf-architect',
  domain: 'architecture',
  systemPrompt: ARCHITECTURE_REVIEWER_PROMPT,
  reviewCriteria: ARCHITECTURE_REVIEW_CRITERIA,
};

/**
 * Architecture Reviewer Agent
 */
export class ArchitectureReviewer extends ReviewerAgent {
  constructor() {
    super(architectureReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const architectureReviewer = new ArchitectureReviewer();

/**
 * Tech spec review criteria
 */
const TECH_SPEC_CRITERIA = [
  'Tech spec addresses all requirements from PRD',
  'Implementation approach is clearly defined',
  'Technology choices are justified',
  'Integration points are identified',
  'Database schema changes are documented (if any)',
  'API endpoints are fully specified',
  'Error handling strategy is defined',
  'Testing approach is outlined',
  'Deployment considerations are addressed',
  'Rollback strategy is defined',
  'Performance requirements are specified',
  'Security requirements are addressed',
];

/**
 * Tech spec reviewer configuration
 */
const techSpecReviewerConfig: ReviewerConfig = {
  name: 'Tech Spec Reviewer',
  agent: 'vaf-architect',
  domain: 'tech-spec',
  systemPrompt: `You are reviewing a technical specification document.

Verify that the tech spec:
- Completely addresses the PRD requirements
- Has a clear implementation approach
- Identifies all integration points
- Considers error scenarios
- Has a realistic testing strategy
- Addresses security concerns

A good tech spec should enable any competent developer
to implement the feature without ambiguity.`,
  reviewCriteria: TECH_SPEC_CRITERIA,
};

/**
 * Tech Spec Reviewer Agent
 */
export class TechSpecReviewer extends ReviewerAgent {
  constructor() {
    super(techSpecReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const techSpecReviewer = new TechSpecReviewer();

/**
 * PRD technical review criteria
 */
const PRD_TECHNICAL_CRITERIA = [
  'Requirements are technically feasible',
  'Scope is realistic for the timeline',
  'Technical constraints are identified',
  'Dependencies on other systems are clear',
  'Performance requirements are achievable',
  'Security requirements are complete',
  'Edge cases are considered',
  'Acceptance criteria are testable',
];

/**
 * PRD technical reviewer configuration
 */
const prdTechnicalReviewerConfig: ReviewerConfig = {
  name: 'PRD Technical Reviewer',
  agent: 'vaf-architect',
  domain: 'prd-technical',
  systemPrompt: `You are a technical reviewer evaluating a PRD.

Your focus is on technical feasibility:
- Can this be built as specified?
- Are there technical constraints not considered?
- Are the performance requirements realistic?
- Are security concerns addressed?
- Are the acceptance criteria technically testable?

You're not reviewing the product decisions,
just the technical viability of the requirements.`,
  reviewCriteria: PRD_TECHNICAL_CRITERIA,
};

/**
 * PRD Technical Reviewer Agent
 */
export class PrdTechnicalReviewer extends ReviewerAgent {
  constructor() {
    super(prdTechnicalReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const prdTechnicalReviewer = new PrdTechnicalReviewer();

/**
 * Implementation review criteria
 */
const IMPLEMENTATION_REVIEW_CRITERIA = [
  'Implementation follows the tech spec',
  'Design patterns from spec are correctly applied',
  'All specified features are implemented',
  'API contracts match the spec',
  'Error handling matches the defined strategy',
  'Tests cover the specified scenarios',
  'No scope creep - only specified features',
  'Performance requirements are met',
  'Security requirements are implemented',
];

/**
 * Implementation reviewer configuration
 */
const implementationReviewerConfig: ReviewerConfig = {
  name: 'Implementation Reviewer',
  agent: 'vaf-architect',
  domain: 'implementation',
  systemPrompt: `You are reviewing an implementation against its tech spec.

Verify that:
- The code implements what was specified
- Design patterns are correctly applied
- No features were added beyond scope
- No features were missed
- Tests match the testing strategy

This is a compliance review - does the code match the plan?`,
  reviewCriteria: IMPLEMENTATION_REVIEW_CRITERIA,
};

/**
 * Implementation Reviewer Agent
 */
export class ImplementationReviewer extends ReviewerAgent {
  constructor() {
    super(implementationReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const implementationReviewer = new ImplementationReviewer();
