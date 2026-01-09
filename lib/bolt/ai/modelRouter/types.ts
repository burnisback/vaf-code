/**
 * Model Router Types
 *
 * Type definitions for smart model routing based on phase and complexity.
 * This enables cost-optimized model selection for each operation.
 */

import type { RequestMode } from '../classifier/types';

// =============================================================================
// PHASE TYPES
// =============================================================================

/**
 * Phases of the AI workflow where model selection occurs
 */
export type Phase =
  | 'classify'      // Initial request classification (always Flash-Lite)
  | 'investigate'   // Codebase investigation and file reading
  | 'plan'          // Task planning and todo generation
  | 'execute'       // Code generation and file modification
  | 'verify'        // Verification and validation (always Flash-Lite)
  | 'research'      // Web research for mega-complex (synthesis)
  | 'prd'           // Product Requirements Document generation
  | 'architecture'; // Architecture design and phase planning

// =============================================================================
// MODEL TYPES
// =============================================================================

/**
 * Available model tiers for routing
 */
export type ModelTier = 'flash-lite' | 'flash' | 'pro';

/**
 * Model pricing information (per 1M tokens)
 */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

/**
 * Pricing constants for each model tier
 */
export const MODEL_PRICING: Record<ModelTier, ModelPricing> = {
  'flash-lite': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'flash': { inputPer1M: 0.30, outputPer1M: 2.50 },
  'pro': { inputPer1M: 1.25, outputPer1M: 10.00 },
};

// =============================================================================
// SELECTION TYPES
// =============================================================================

/**
 * Result of model selection
 */
export interface ModelSelection {
  /** The selected model tier */
  tier: ModelTier;
  /** Human-readable reason for selection */
  reason: string;
  /** Estimated cost per 1M tokens */
  estimatedCost: ModelPricing;
}

/**
 * Context for making model selection decisions
 */
export interface SelectionContext {
  /** The current phase of operation */
  phase: Phase;
  /** The classified request mode */
  mode: RequestMode;
  /** Optional complexity score (1-20+) */
  complexityScore?: number;
  /** Whether this is a retry/refinement attempt */
  isRetry?: boolean;
}

// =============================================================================
// TOKEN TRACKING
// =============================================================================

/**
 * Token usage tracking
 */
export interface TokenUsage {
  /** Input tokens consumed */
  input: number;
  /** Output tokens generated */
  output: number;
}

/**
 * Token tracking for a single operation
 */
export interface TokenRecord {
  /** Phase where tokens were used */
  phase: Phase;
  /** Model tier used */
  tier: ModelTier;
  /** Tokens consumed */
  tokens: TokenUsage;
  /** Timestamp */
  timestamp: number;
}

/**
 * Aggregated token tracking for a session
 */
export interface SessionTokens {
  /** Individual token records */
  records: TokenRecord[];
  /** Total tokens by tier */
  byTier: Record<ModelTier, TokenUsage>;
  /** Total tokens across all tiers */
  total: TokenUsage;
}

// =============================================================================
// COST ESTIMATION
// =============================================================================

/**
 * Cost estimate for an operation
 */
export interface CostEstimate {
  /** Estimated input tokens */
  inputTokens: number;
  /** Estimated output tokens */
  outputTokens: number;
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Model tier used for estimate */
  tier: ModelTier;
}

/**
 * Cost breakdown for a session
 */
export interface SessionCost {
  /** Cost by tier */
  byTier: Record<ModelTier, number>;
  /** Total cost */
  total: number;
  /** Comparison with single-model approach */
  savings?: {
    singleModelCost: number;
    optimizedCost: number;
    savingsPercent: number;
  };
}

// =============================================================================
// TOKEN BUDGETS
// =============================================================================

/**
 * Token budget limits by mode
 */
export interface TokenBudget {
  /** Maximum input tokens */
  maxInput: number;
  /** Maximum output tokens */
  maxOutput: number;
  /** Warning threshold (percentage of max) */
  warningThreshold: number;
}

/**
 * Default token budgets by request mode
 */
export const DEFAULT_TOKEN_BUDGETS: Record<RequestMode, TokenBudget> = {
  'question': {
    maxInput: 3000,
    maxOutput: 2000,
    warningThreshold: 0.8,
  },
  'simple': {
    maxInput: 15000,
    maxOutput: 5000,
    warningThreshold: 0.8,
  },
  'moderate': {
    maxInput: 45000,
    maxOutput: 15000,
    warningThreshold: 0.8,
  },
  'complex': {
    maxInput: 120000,
    maxOutput: 35000,
    warningThreshold: 0.8,
  },
  'mega-complex': {
    maxInput: 800000,
    maxOutput: 200000,
    warningThreshold: 0.7,
  },
};

// =============================================================================
// PHASE CONFIG
// =============================================================================

/**
 * Configuration for model selection per phase
 */
export interface PhaseConfig {
  /** Default model tier for this phase */
  defaultTier: ModelTier;
  /** Whether tier can be upgraded based on complexity */
  allowUpgrade: boolean;
  /** Complexity threshold for upgrade (if allowUpgrade) */
  upgradeThreshold?: number;
  /** Tier to upgrade to */
  upgradeTier?: ModelTier;
}

/**
 * Default phase configurations
 */
export const DEFAULT_PHASE_CONFIG: Record<Phase, PhaseConfig> = {
  'classify': {
    defaultTier: 'flash-lite',
    allowUpgrade: false,
  },
  'investigate': {
    defaultTier: 'flash-lite',
    allowUpgrade: true,
    upgradeThreshold: 10,
    upgradeTier: 'flash',
  },
  'plan': {
    defaultTier: 'flash',
    allowUpgrade: true,
    upgradeThreshold: 15,
    upgradeTier: 'pro',
  },
  'execute': {
    defaultTier: 'flash',
    allowUpgrade: false,
  },
  'verify': {
    defaultTier: 'flash-lite',
    allowUpgrade: false,
  },
  'research': {
    defaultTier: 'flash',
    allowUpgrade: false,
  },
  'prd': {
    defaultTier: 'pro',
    allowUpgrade: false,
  },
  'architecture': {
    defaultTier: 'pro',
    allowUpgrade: false,
  },
};
