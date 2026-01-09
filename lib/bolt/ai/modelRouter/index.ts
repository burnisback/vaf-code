/**
 * Smart Model Router
 *
 * Cost-optimized model selection for each phase of the AI workflow.
 * Selects between Flash-Lite, Flash, and Pro based on:
 * - Current operation phase
 * - Request complexity mode
 * - Complexity score
 *
 * Cost savings: 40-65% compared to single-model approach
 */

import { MODELS, type ModelType } from '@/lib/ai/genkit';
import type { RequestMode } from '../classifier/types';
import {
  type Phase,
  type ModelTier,
  type ModelSelection,
  type SelectionContext,
  type TokenUsage,
  type TokenRecord,
  type SessionTokens,
  type CostEstimate,
  type SessionCost,
  MODEL_PRICING,
  DEFAULT_PHASE_CONFIG,
  DEFAULT_TOKEN_BUDGETS,
} from './types';

// Re-export types
export * from './types';

// =============================================================================
// MODEL MAPPING
// =============================================================================

/**
 * Map model tiers to actual Genkit model references
 */
const TIER_TO_MODEL: Record<ModelTier, ModelType> = {
  'flash-lite': MODELS.FLASH_LITE,
  'flash': MODELS.FLASH,
  'pro': MODELS.PRO,
};

// =============================================================================
// MODEL SELECTION
// =============================================================================

/**
 * Select the optimal model for a given phase and context.
 *
 * @param context - Selection context with phase, mode, and optional complexity
 * @returns Model selection with tier, reason, and cost estimate
 */
export function selectModel(context: SelectionContext): ModelSelection {
  const { phase, mode, complexityScore, isRetry } = context;
  const config = DEFAULT_PHASE_CONFIG[phase];

  // Default selection
  let tier: ModelTier = config.defaultTier;
  let reason = `Default ${tier} for ${phase} phase`;

  // Check for mode-based overrides
  if (mode === 'question') {
    // Questions always use Flash-Lite (cheapest)
    tier = 'flash-lite';
    reason = 'Question mode - Flash-Lite is sufficient';
  } else if (mode === 'mega-complex') {
    // Mega-complex uses tier based on phase
    if (phase === 'prd' || phase === 'architecture') {
      tier = 'pro';
      reason = 'Mega-complex PRD/architecture requires Pro reasoning';
    } else if (phase === 'plan' || phase === 'research') {
      tier = 'flash';
      reason = 'Mega-complex planning/research uses Flash';
    } else if (phase === 'investigate') {
      tier = 'flash';
      reason = 'Mega-complex investigation uses Flash';
    }
  } else if (config.allowUpgrade && complexityScore !== undefined) {
    // Check for complexity-based upgrade
    if (config.upgradeThreshold && complexityScore >= config.upgradeThreshold) {
      tier = config.upgradeTier || config.defaultTier;
      reason = `Complexity ${complexityScore} >= ${config.upgradeThreshold} - upgraded to ${tier}`;
    }
  }

  // Special handling for specific phases
  if (phase === 'classify') {
    tier = 'flash-lite';
    reason = 'Classification always uses Flash-Lite';
  } else if (phase === 'verify') {
    tier = 'flash-lite';
    reason = 'Verification always uses Flash-Lite';
  }

  // Retry handling - consider upgrading for retries (except classify/verify which stay cheap)
  if (isRetry && tier === 'flash-lite' && phase !== 'classify' && phase !== 'verify') {
    tier = 'flash';
    reason = `Retry attempt - upgraded to Flash`;
  }

  return {
    tier,
    reason,
    estimatedCost: MODEL_PRICING[tier],
  };
}

/**
 * Get the Genkit model reference for a selection
 */
export function getModelForSelection(selection: ModelSelection): ModelType {
  return TIER_TO_MODEL[selection.tier];
}

/**
 * Convenience function to select and get model in one call
 */
export function selectAndGetModel(context: SelectionContext): {
  model: ModelType;
  selection: ModelSelection;
} {
  const selection = selectModel(context);
  return {
    model: getModelForSelection(selection),
    selection,
  };
}

// =============================================================================
// COST ESTIMATION
// =============================================================================

/**
 * Estimate cost for a single operation
 */
export function estimateCost(
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number
): CostEstimate {
  const pricing = MODEL_PRICING[tier];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

  return {
    inputTokens,
    outputTokens,
    estimatedCost: inputCost + outputCost,
    tier,
  };
}

/**
 * Estimate cost for a mode using typical token budgets
 */
export function estimateCostForMode(mode: RequestMode): CostEstimate {
  const budget = DEFAULT_TOKEN_BUDGETS[mode];

  // Determine primary tier for mode
  let tier: ModelTier;
  switch (mode) {
    case 'question':
      tier = 'flash-lite';
      break;
    case 'simple':
    case 'moderate':
      tier = 'flash';
      break;
    case 'complex':
      tier = 'flash'; // Mix of Flash and Pro, estimate with Flash
      break;
    case 'mega-complex':
      tier = 'flash'; // Mix, estimate with Flash average
      break;
    default:
      tier = 'flash';
  }

  return estimateCost(tier, budget.maxInput, budget.maxOutput);
}

// =============================================================================
// TOKEN TRACKING
// =============================================================================

/**
 * Create a new session token tracker
 */
export function createSessionTokens(): SessionTokens {
  return {
    records: [],
    byTier: {
      'flash-lite': { input: 0, output: 0 },
      'flash': { input: 0, output: 0 },
      'pro': { input: 0, output: 0 },
    },
    total: { input: 0, output: 0 },
  };
}

/**
 * Record token usage for an operation
 */
export function recordTokenUsage(
  session: SessionTokens,
  phase: Phase,
  tier: ModelTier,
  tokens: TokenUsage
): SessionTokens {
  const record: TokenRecord = {
    phase,
    tier,
    tokens,
    timestamp: Date.now(),
  };

  return {
    records: [...session.records, record],
    byTier: {
      ...session.byTier,
      [tier]: {
        input: session.byTier[tier].input + tokens.input,
        output: session.byTier[tier].output + tokens.output,
      },
    },
    total: {
      input: session.total.input + tokens.input,
      output: session.total.output + tokens.output,
    },
  };
}

/**
 * Calculate total session cost
 */
export function calculateSessionCost(session: SessionTokens): SessionCost {
  const byTier: Record<ModelTier, number> = {
    'flash-lite': 0,
    'flash': 0,
    'pro': 0,
  };

  let total = 0;
  let singleModelCost = 0;

  for (const tier of Object.keys(byTier) as ModelTier[]) {
    const tokens = session.byTier[tier];
    const pricing = MODEL_PRICING[tier];
    const cost =
      (tokens.input / 1_000_000) * pricing.inputPer1M +
      (tokens.output / 1_000_000) * pricing.outputPer1M;
    byTier[tier] = cost;
    total += cost;

    // Calculate what it would cost with Flash for all
    const flashPricing = MODEL_PRICING['flash'];
    singleModelCost +=
      (tokens.input / 1_000_000) * flashPricing.inputPer1M +
      (tokens.output / 1_000_000) * flashPricing.outputPer1M;
  }

  const savingsPercent =
    singleModelCost > 0 ? ((singleModelCost - total) / singleModelCost) * 100 : 0;

  return {
    byTier,
    total,
    savings: {
      singleModelCost,
      optimizedCost: total,
      savingsPercent,
    },
  };
}

// =============================================================================
// LOGGING & DEBUGGING
// =============================================================================

/**
 * Format model selection for logging
 */
export function formatSelectionLog(
  context: SelectionContext,
  selection: ModelSelection
): string {
  const { phase, mode, complexityScore } = context;
  const { tier, reason, estimatedCost } = selection;

  const complexity = complexityScore !== undefined ? ` (complexity: ${complexityScore})` : '';
  const cost = `$${estimatedCost.inputPer1M.toFixed(2)}/$${estimatedCost.outputPer1M.toFixed(2)} per 1M`;

  return `[ModelRouter] ${phase}/${mode}${complexity} -> ${tier.toUpperCase()} - ${reason} [${cost}]`;
}

/**
 * Format session summary for logging
 */
export function formatSessionSummary(session: SessionTokens): string {
  const cost = calculateSessionCost(session);
  const lines = [
    '[ModelRouter] Session Summary:',
    `  Total tokens: ${session.total.input.toLocaleString()} in / ${session.total.output.toLocaleString()} out`,
    `  By tier:`,
    `    Flash-Lite: ${session.byTier['flash-lite'].input.toLocaleString()} in / ${session.byTier['flash-lite'].output.toLocaleString()} out ($${cost.byTier['flash-lite'].toFixed(4)})`,
    `    Flash: ${session.byTier['flash'].input.toLocaleString()} in / ${session.byTier['flash'].output.toLocaleString()} out ($${cost.byTier['flash'].toFixed(4)})`,
    `    Pro: ${session.byTier['pro'].input.toLocaleString()} in / ${session.byTier['pro'].output.toLocaleString()} out ($${cost.byTier['pro'].toFixed(4)})`,
    `  Total cost: $${cost.total.toFixed(4)}`,
  ];

  if (cost.savings) {
    lines.push(
      `  Savings: ${cost.savings.savingsPercent.toFixed(1)}% vs single-model ($${cost.savings.singleModelCost.toFixed(4)} -> $${cost.savings.optimizedCost.toFixed(4)})`
    );
  }

  return lines.join('\n');
}
