/**
 * Code Reviewer
 *
 * Reviews code for quality, patterns, and best practices.
 */

import { ReviewerAgent, type ReviewerConfig } from '../reviewer';

/**
 * Code review criteria
 */
const CODE_REVIEW_CRITERIA = [
  'Code follows TypeScript best practices with proper typing',
  'React components use functional patterns with hooks',
  'No hardcoded secrets, API keys, or sensitive data',
  'Error handling is comprehensive and user-friendly',
  'Code is DRY (Don\'t Repeat Yourself) without over-abstraction',
  'Variable and function names are descriptive and intention-revealing',
  'Complex logic has explanatory comments',
  'No console.log statements left in production code',
  'Imports are organized and unused imports removed',
  'No any types unless absolutely necessary with justification',
  'Async operations handle loading and error states',
  'Components have appropriate prop validation',
  'No memory leaks (useEffect cleanup, event listener removal)',
  'Code is testable with clear separation of concerns',
];

/**
 * Code reviewer system prompt
 */
const CODE_REVIEWER_PROMPT = `You are a senior code reviewer at a software company.

Your role is to review code for:
- Code quality and maintainability
- TypeScript and React best practices
- Security vulnerabilities
- Performance concerns
- Error handling
- Code organization

You are thorough but fair. You understand that perfect is the enemy of good.
Focus on issues that actually matter for production code quality.

Minor style preferences that don't affect functionality should be noted
but not block approval.`;

/**
 * Code reviewer configuration
 */
const codeReviewerConfig: ReviewerConfig = {
  name: 'Code Reviewer',
  agent: 'vaf-architect',
  domain: 'code-architecture',
  systemPrompt: CODE_REVIEWER_PROMPT,
  reviewCriteria: CODE_REVIEW_CRITERIA,
};

/**
 * Code Reviewer Agent
 */
export class CodeReviewer extends ReviewerAgent {
  constructor() {
    super(codeReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const codeReviewer = new CodeReviewer();

/**
 * Frontend-specific code review criteria
 */
const FRONTEND_CODE_CRITERIA = [
  'React components follow the project component patterns',
  'Tailwind CSS classes are used consistently',
  'Accessibility attributes (aria-*, role) are present where needed',
  'Responsive design considerations are implemented',
  'State management follows project conventions',
  'Event handlers are properly typed',
  'Loading and error states are handled in UI',
  'No inline styles unless absolutely necessary',
];

/**
 * Frontend code reviewer configuration
 */
const frontendCodeReviewerConfig: ReviewerConfig = {
  name: 'Frontend Code Reviewer',
  agent: 'vaf-frontend',
  domain: 'implementability',
  systemPrompt: `You are a senior frontend engineer reviewing React/TypeScript code.

Focus on:
- React patterns and hooks usage
- Component composition and reusability
- UI/UX implementation quality
- Tailwind CSS usage
- Accessibility implementation
- Performance (memoization, lazy loading)

Be practical - code that works and is maintainable is good code.`,
  reviewCriteria: [...CODE_REVIEW_CRITERIA, ...FRONTEND_CODE_CRITERIA],
};

/**
 * Frontend Code Reviewer Agent
 */
export class FrontendCodeReviewer extends ReviewerAgent {
  constructor() {
    super(frontendCodeReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const frontendCodeReviewer = new FrontendCodeReviewer();

/**
 * Backend-specific code review criteria
 */
const BACKEND_CODE_CRITERIA = [
  'API routes follow RESTful conventions',
  'Input validation is thorough',
  'Error responses follow consistent format',
  'Database queries are efficient',
  'Authentication/authorization checks are in place',
  'Rate limiting considerations',
  'Logging is appropriate (not too verbose, not silent)',
  'Environment variables are used for configuration',
];

/**
 * Backend code reviewer configuration
 */
const backendCodeReviewerConfig: ReviewerConfig = {
  name: 'Backend Code Reviewer',
  agent: 'vaf-backend',
  domain: 'api-implementation',
  systemPrompt: `You are a senior backend engineer reviewing API and server code.

Focus on:
- API design and RESTful patterns
- Security (input validation, auth, CSRF, XSS)
- Error handling and logging
- Database query efficiency
- Scalability considerations

Be thorough on security - this code faces the public internet.`,
  reviewCriteria: [...CODE_REVIEW_CRITERIA, ...BACKEND_CODE_CRITERIA],
};

/**
 * Backend Code Reviewer Agent
 */
export class BackendCodeReviewer extends ReviewerAgent {
  constructor() {
    super(backendCodeReviewerConfig);
  }
}

/**
 * Singleton instance
 */
export const backendCodeReviewer = new BackendCodeReviewer();
