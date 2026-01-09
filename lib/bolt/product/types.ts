/**
 * Product Definition Types
 *
 * Types for product requirements documents, feature specifications,
 * and product definition artifacts.
 */

// =============================================================================
// PRODUCT REQUIREMENTS
// =============================================================================

export interface ProductRequirementsDocument {
  /** Unique PRD ID */
  id: string;

  /** Product name */
  name: string;

  /** Product tagline */
  tagline: string;

  /** Executive summary */
  summary: string;

  /** Problem statement */
  problem: ProblemStatement;

  /** Target audience */
  audience: TargetAudience[];

  /** Product goals */
  goals: ProductGoal[];

  /** Feature specifications */
  features: FeatureSpecification[];

  /** Non-functional requirements */
  nonFunctional: NonFunctionalRequirements;

  /** Success metrics */
  metrics: SuccessMetric[];

  /** Constraints and assumptions */
  constraints: Constraint[];

  /** Open questions */
  openQuestions: string[];

  /** Research references */
  researchRefs: string[];

  /** Creation timestamp */
  createdAt: number;

  /** Status */
  status: 'draft' | 'review' | 'approved';

  /** Version */
  version: number;
}

export interface ProblemStatement {
  /** The core problem being solved */
  statement: string;

  /** Current solutions and their limitations */
  currentSolutions: string[];

  /** Pain points addressed */
  painPoints: string[];

  /** Market gap/opportunity */
  marketGap: string;
}

export interface TargetAudience {
  /** Audience segment name */
  name: string;

  /** Description */
  description: string;

  /** Key characteristics */
  characteristics: string[];

  /** Primary needs */
  needs: string[];

  /** How product helps them */
  value: string;
}

export interface ProductGoal {
  /** Goal ID */
  id: string;

  /** Goal description */
  description: string;

  /** Goal type */
  type: 'business' | 'user' | 'technical';

  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';

  /** Success criteria */
  successCriteria: string[];

  /** Timeframe */
  timeframe?: 'mvp' | 'v1' | 'v2' | 'future';
}

// =============================================================================
// FEATURE SPECIFICATIONS
// =============================================================================

export interface FeatureSpecification {
  /** Feature ID */
  id: string;

  /** Feature name */
  name: string;

  /** Feature description */
  description: string;

  /** User-facing benefit */
  benefit: string;

  /** Feature category */
  category: FeatureCategory;

  /** Priority using MoSCoW */
  priority: 'must' | 'should' | 'could' | 'wont';

  /** Complexity estimate (1-5) */
  complexity: number;

  /** User stories */
  userStories: UserStory[];

  /** Acceptance criteria */
  acceptanceCriteria: string[];

  /** Dependencies on other features */
  dependencies: string[];

  /** Technical considerations */
  technicalNotes?: string;

  /** Competitor reference (if applicable) */
  competitorRef?: string;

  /** Release target */
  releaseTarget: 'mvp' | 'v1' | 'v2' | 'future';
}

export type FeatureCategory =
  | 'core'
  | 'user-management'
  | 'content'
  | 'collaboration'
  | 'analytics'
  | 'integration'
  | 'admin'
  | 'monetization'
  | 'other';

export interface UserStory {
  /** Story ID */
  id: string;

  /** As a [role] */
  role: string;

  /** I want to [action] */
  action: string;

  /** So that [benefit] */
  benefit: string;

  /** Story points estimate */
  points?: number;
}

// =============================================================================
// NON-FUNCTIONAL REQUIREMENTS
// =============================================================================

export interface NonFunctionalRequirements {
  /** Performance requirements */
  performance: {
    pageLoadTime: string;
    apiResponseTime: string;
    concurrentUsers: string;
    other: string[];
  };

  /** Security requirements */
  security: {
    authentication: string[];
    authorization: string[];
    dataProtection: string[];
    compliance: string[];
  };

  /** Accessibility requirements */
  accessibility: {
    wcagLevel: 'A' | 'AA' | 'AAA';
    requirements: string[];
  };

  /** Scalability requirements */
  scalability: {
    userGrowth: string;
    dataGrowth: string;
    considerations: string[];
  };

  /** Reliability requirements */
  reliability: {
    uptime: string;
    backupStrategy: string;
    recoveryTime: string;
  };

  /** Usability requirements */
  usability: {
    targetDevices: string[];
    browsers: string[];
    languages: string[];
    uxPrinciples: string[];
  };
}

// =============================================================================
// METRICS AND CONSTRAINTS
// =============================================================================

export interface SuccessMetric {
  /** Metric name */
  name: string;

  /** What it measures */
  description: string;

  /** Target value */
  target: string;

  /** How it's measured */
  measurement: string;

  /** Priority */
  priority: 'primary' | 'secondary';
}

export interface Constraint {
  /** Constraint type */
  type: 'technical' | 'business' | 'legal' | 'time' | 'budget';

  /** Description */
  description: string;

  /** Impact */
  impact: string;

  /** Mitigation (if any) */
  mitigation?: string;
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

export interface ResearchAnalysis {
  /** Key insights from research */
  insights: string[];

  /** Identified features from competitors */
  competitorFeatures: Array<{
    feature: string;
    competitors: string[];
    prevalence: 'common' | 'unique' | 'standard';
  }>;

  /** User needs extracted */
  userNeeds: Array<{
    need: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    evidence: string;
  }>;

  /** Market gaps identified */
  gaps: string[];

  /** Differentiation opportunities */
  differentiators: string[];

  /** Recommended feature priorities */
  featurePriorities: Array<{
    feature: string;
    priority: 'must' | 'should' | 'could';
    rationale: string;
  }>;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface PRDGenerationRequest {
  /** Research synthesis to base PRD on */
  researchId?: string;

  /** Direct research synthesis data */
  researchData?: unknown;

  /** Product name (optional - AI can suggest) */
  productName?: string;

  /** Additional context/requirements from user */
  additionalContext?: string;

  /** Focus areas */
  focusAreas?: string[];
}

export interface PRDGenerationResult {
  /** Whether generation succeeded */
  success: boolean;

  /** The generated PRD */
  prd?: ProductRequirementsDocument;

  /** Analysis performed */
  analysis?: ResearchAnalysis;

  /** Error if failed */
  error?: string;

  /** Suggestions for improvement */
  suggestions?: string[];
}
