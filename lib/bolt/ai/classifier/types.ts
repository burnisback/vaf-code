/**
 * Classifier Types
 *
 * Type definitions for the request complexity classifier.
 * This module determines how to handle each user request.
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

/**
 * The mode for handling a user request
 */
export type RequestMode =
  | 'question'     // Pure question, no code needed
  | 'simple'       // 1-2 files, single domain
  | 'moderate'     // 3-5 files, up to 2 domains
  | 'complex'      // 6+ files or 3+ domains
  | 'mega-complex'; // Full research-to-implementation pipeline

/**
 * Technical domains a request may touch
 */
export type RequestDomain =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'auth'
  | 'api'
  | 'styling'
  | 'testing'
  | 'infrastructure';

// =============================================================================
// CLASSIFICATION RESULT
// =============================================================================

/**
 * Result of classifying a user request
 */
export interface ClassificationResult {
  /** The determined mode for handling this request */
  mode: RequestMode;

  /** Estimated number of files to be created/modified */
  estimatedFiles: number;

  /** Domains this request touches */
  domains: RequestDomain[];

  /** Confidence score (0-1) */
  confidence: number;

  /** Human-readable reasoning */
  reasoning: string;

  /** Detected keywords that influenced the decision */
  detectedKeywords: string[];

  /** Indicators for mega-complex mode (if applicable) */
  megaComplexIndicators?: MegaComplexIndicators;

  /**
   * Whether this is an error-fix request (debugging, fixing errors, etc.)
   * When true, the system should run pre-verification and investigation
   * before making any changes.
   */
  isErrorFix?: boolean;
}

/**
 * Indicators for mega-complex scenarios requiring research
 */
export interface MegaComplexIndicators {
  /** Requires web research */
  needsResearch: boolean;

  /** Requires product definition */
  needsProductDefinition: boolean;

  /** Requires architecture planning */
  needsArchitecture: boolean;

  /** Has multiple implementation phases */
  hasMultiplePhases: boolean;

  /** Research-related keywords found */
  researchKeywords: string[];

  /** Product keywords found */
  productKeywords: string[];

  /** Scale indicators */
  scaleIndicators: string[];
}

// =============================================================================
// CLASSIFIER CONFIG
// =============================================================================

/**
 * Configuration for the classifier
 */
export interface ClassifierConfig {
  /** Threshold for simple mode (file count) */
  simpleThreshold: number;

  /** Threshold for moderate mode (file count) */
  moderateThreshold: number;

  /** Minimum confidence to auto-select mode */
  minConfidence: number;
}

/**
 * Default classifier configuration
 */
export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  simpleThreshold: 2,
  moderateThreshold: 5,
  minConfidence: 0.6,
};

// =============================================================================
// KEYWORD PATTERNS
// =============================================================================

/** Patterns that indicate a question (no code changes needed) */
export const QUESTION_PATTERNS: RegExp[] = [
  /^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does)\s/i,
  /^explain\s/i,
  /^describe\s/i,
  /^tell me\s/i,
  /^(help me understand|i need to understand|help me learn)\s/i,
  /\?$/,
];

/** Keywords that indicate file creation/modification */
export const FILE_INDICATOR_KEYWORDS: string[] = [
  // Components
  'component', 'page', 'layout', 'template', 'view', 'screen',
  // React-specific
  'hook', 'context', 'provider', 'reducer', 'store',
  // UI elements
  'button', 'form', 'modal', 'dialog', 'table', 'card', 'list',
  'header', 'footer', 'sidebar', 'navbar', 'menu', 'dropdown',
  'input', 'textarea', 'select', 'checkbox', 'radio',
  // Additional UI elements (expanded)
  'toggle', 'switch', 'slider', 'tabs', 'accordion', 'carousel',
  'tooltip', 'popover', 'notification', 'toast', 'alert', 'banner',
  'avatar', 'badge', 'chip', 'tag', 'progress', 'spinner', 'loader',
  'navigation', 'breadcrumb', 'pagination', 'stepper',
  // Forms and validation
  'validation', 'validator', 'error', 'field',
  // Backend
  'api', 'endpoint', 'route', 'controller', 'service',
  'model', 'schema', 'middleware', 'handler',
  // Utils
  'util', 'helper', 'formatter', 'parser',
  // Config
  'config', 'settings', 'constants', 'types',
  // State and data
  'state', 'data', 'fetch', 'storage', 'cache',
  // Features
  'theme', 'dark mode', 'light mode', 'preference',
  'authentication', 'authorization', 'permission',
  'search', 'filter', 'sort', 'pagination',
];

/** Keywords indicating specific domains */
export const DOMAIN_KEYWORDS: Record<RequestDomain, string[]> = {
  frontend: [
    'component', 'page', 'ui', 'style', 'layout', 'responsive',
    'jsx', 'tsx', 'react', 'next', 'vue', 'angular', 'svelte',
    // Extended frontend keywords
    'form', 'modal', 'dialog', 'button', 'input', 'navigation',
    'navbar', 'sidebar', 'header', 'footer', 'card', 'list',
    'table', 'grid', 'flex', 'toggle', 'switch', 'dropdown',
    'menu', 'tabs', 'accordion', 'carousel', 'slider',
    'tooltip', 'popover', 'toast', 'notification', 'alert',
  ],
  backend: [
    'api', 'endpoint', 'server', 'route', 'controller',
    'handler', 'middleware', 'node', 'express', 'nest',
  ],
  database: [
    'database', 'db', 'schema', 'model', 'query', 'sql',
    'mongo', 'prisma', 'supabase', 'firebase', 'postgres',
    'mysql', 'sqlite', 'redis', 'migration',
    // Extended database keywords
    'persist', 'storage', 'localstorage', 'save', 'store',
  ],
  auth: [
    'auth', 'login', 'logout', 'session', 'token', 'jwt',
    'password', 'signup', 'register', 'oauth', 'sso',
    'permission', 'role', 'access control',
    // Extended auth keywords
    'authentication', 'authorization', 'protected', 'private',
  ],
  api: [
    'fetch', 'axios', 'api', 'rest', 'graphql', 'mutation',
    'query', 'request', 'response', 'http', 'websocket',
  ],
  styling: [
    'css', 'style', 'tailwind', 'theme', 'color', 'animation',
    'responsive', 'dark mode', 'light mode', 'design system',
    'sass', 'scss', 'styled-components', 'emotion',
    // Extended styling keywords
    'transition', 'hover', 'focus', 'gradient', 'shadow',
  ],
  testing: [
    'test', 'spec', 'jest', 'vitest', 'cypress', 'playwright',
    'e2e', 'unit test', 'integration test', 'mock', 'stub',
  ],
  infrastructure: [
    'deploy', 'docker', 'kubernetes', 'ci/cd', 'pipeline',
    'vercel', 'netlify', 'aws', 'cloud', 'hosting',
  ],
};

/** Keywords indicating complexity with weights */
export const COMPLEXITY_KEYWORDS: Array<{ keyword: string; weight: number }> = [
  // High complexity
  { keyword: 'full', weight: 2 },
  { keyword: 'complete', weight: 2 },
  { keyword: 'entire', weight: 2 },
  { keyword: 'whole', weight: 2 },
  { keyword: 'system', weight: 2 },
  { keyword: 'platform', weight: 3 },
  { keyword: 'application', weight: 3 },
  { keyword: 'dashboard', weight: 2 },
  { keyword: 'e-commerce', weight: 3 },
  { keyword: 'checkout', weight: 2 },
  { keyword: 'crud', weight: 2 },
  { keyword: 'management', weight: 2 },
  { keyword: 'admin', weight: 2 },
  // Medium complexity
  { keyword: 'with', weight: 1 },
  { keyword: 'and', weight: 0.5 },
  { keyword: 'also', weight: 0.5 },
  { keyword: 'including', weight: 1 },
  { keyword: 'multiple', weight: 1 },
  { keyword: 'several', weight: 1 },
  { keyword: 'all', weight: 1 },
];

/** Keywords that indicate research is needed */
export const RESEARCH_KEYWORDS: string[] = [
  'research', 'find', 'discover', 'analyze', 'compare',
  'competitors', 'competition', 'market', 'best practices',
  'industry', 'trends', 'alternatives', 'options',
  'investigate', 'explore', 'survey', 'study',
];

/** Keywords that indicate product/application scope */
export const PRODUCT_KEYWORDS: string[] = [
  'product', 'application', 'platform', 'system', 'solution',
  'saas', 'app', 'website', 'portal', 'dashboard', 'marketplace',
  'service', 'tool', 'software',
];

/** Keywords indicating large scale */
export const SCALE_KEYWORDS: string[] = [
  'complete', 'full', 'entire', 'comprehensive', 'end-to-end',
  'production', 'enterprise', 'scalable', 'robust',
  'feature-rich', 'fully-featured', 'professional',
];

/** Keywords indicating implementation intent */
export const IMPLEMENTATION_KEYWORDS: string[] = [
  'build', 'create', 'implement', 'develop', 'make',
  'design', 'construct', 'generate', 'setup', 'set up',
];

/** Keywords/patterns indicating error-fix intent */
export const ERROR_FIX_KEYWORDS: string[] = [
  'fix', 'error', 'errors', 'bug', 'bugs', 'broken', 'breaking',
  'debug', 'diagnose', 'failing', 'failed', 'fail',
  'not working', 'doesn\'t work', 'won\'t work', 'cant work',
  'still getting', 'keep getting', 'getting errors',
  'build failing', 'build failed', 'compilation error',
  'type error', 'runtime error', 'syntax error',
  'undefined', 'null', 'crash', 'crashing',
  'resolve', 'address', 'check for errors',
  'what\'s wrong', 'whats wrong',
];
