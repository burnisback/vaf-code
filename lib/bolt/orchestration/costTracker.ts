/**
 * Cost Tracker
 *
 * Tracks token usage and costs across mega-complex pipeline phases.
 * Provides real-time cost estimates and budget warnings.
 */

import type { ModelTier } from '../ai/modelRouter/types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Token usage for a single operation
 */
export interface TokenUsage {
  /** Input tokens */
  input: number;
  /** Output tokens */
  output: number;
  /** Model used */
  model: ModelTier;
  /** Phase where tokens were used */
  phase?: string;
  /** Operation description */
  operation?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Cost per 1M tokens for each model tier
 */
export const MODEL_COSTS: Record<ModelTier, { input: number; output: number }> = {
  'flash-lite': { input: 0.075, output: 0.30 },
  'flash': { input: 0.10, output: 0.40 },
  'pro': { input: 1.25, output: 5.00 },
};

/**
 * Aggregated cost statistics
 */
export interface CostStatistics {
  /** Total input tokens */
  totalInputTokens: number;
  /** Total output tokens */
  totalOutputTokens: number;
  /** Total cost in dollars */
  totalCost: number;
  /** Cost breakdown by model */
  costByModel: Record<ModelTier, { input: number; output: number; cost: number }>;
  /** Cost breakdown by phase */
  costByPhase: Record<string, { tokens: number; cost: number }>;
  /** Token count by phase */
  tokensByPhase: Record<string, { input: number; output: number }>;
  /** Average cost per operation */
  averageCostPerOperation: number;
  /** Number of operations */
  operationCount: number;
}

/**
 * Budget warning levels
 */
export interface BudgetWarning {
  level: 'info' | 'warning' | 'critical';
  message: string;
  currentCost: number;
  budget: number;
  percentage: number;
}

/**
 * Cost tracker callbacks
 */
export interface CostTrackerCallbacks {
  /** Called when cost is updated */
  onCostUpdate?: (stats: CostStatistics) => void;
  /** Called when budget threshold is reached */
  onBudgetWarning?: (warning: BudgetWarning) => void;
}

// =============================================================================
// COST TRACKER CLASS
// =============================================================================

/**
 * Tracks costs across the mega-complex pipeline
 */
export class CostTracker {
  private usageHistory: TokenUsage[] = [];
  private budget: number | null = null;
  private callbacks: CostTrackerCallbacks;
  private warningThresholds = [0.5, 0.8, 0.95];
  private lastWarningLevel: number = 0;

  constructor(callbacks: CostTrackerCallbacks = {}, budget?: number) {
    this.callbacks = callbacks;
    this.budget = budget ?? null;
  }

  /**
   * Set budget limit
   */
  setBudget(budget: number): void {
    this.budget = budget;
    this.lastWarningLevel = 0;
    this.checkBudget();
  }

  /**
   * Clear budget limit
   */
  clearBudget(): void {
    this.budget = null;
    this.lastWarningLevel = 0;
  }

  /**
   * Record token usage
   */
  recordUsage(usage: Omit<TokenUsage, 'timestamp'>): void {
    this.usageHistory.push({
      ...usage,
      timestamp: Date.now(),
    });

    // Emit update
    this.callbacks.onCostUpdate?.(this.getStatistics());

    // Check budget
    this.checkBudget();
  }

  /**
   * Record usage from an API response
   */
  recordFromResponse(
    response: { usage?: { inputTokens?: number; outputTokens?: number } },
    model: ModelTier,
    phase?: string,
    operation?: string
  ): void {
    if (!response.usage) return;

    this.recordUsage({
      input: response.usage.inputTokens || 0,
      output: response.usage.outputTokens || 0,
      model,
      phase,
      operation,
    });
  }

  /**
   * Get current statistics
   */
  getStatistics(): CostStatistics {
    const stats: CostStatistics = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      costByModel: {
        'flash-lite': { input: 0, output: 0, cost: 0 },
        'flash': { input: 0, output: 0, cost: 0 },
        'pro': { input: 0, output: 0, cost: 0 },
      },
      costByPhase: {},
      tokensByPhase: {},
      averageCostPerOperation: 0,
      operationCount: this.usageHistory.length,
    };

    for (const usage of this.usageHistory) {
      // Total tokens
      stats.totalInputTokens += usage.input;
      stats.totalOutputTokens += usage.output;

      // Calculate cost for this usage
      const modelCost = MODEL_COSTS[usage.model];
      const inputCost = (usage.input / 1_000_000) * modelCost.input;
      const outputCost = (usage.output / 1_000_000) * modelCost.output;
      const operationCost = inputCost + outputCost;

      stats.totalCost += operationCost;

      // By model
      stats.costByModel[usage.model].input += usage.input;
      stats.costByModel[usage.model].output += usage.output;
      stats.costByModel[usage.model].cost += operationCost;

      // By phase
      if (usage.phase) {
        if (!stats.costByPhase[usage.phase]) {
          stats.costByPhase[usage.phase] = { tokens: 0, cost: 0 };
          stats.tokensByPhase[usage.phase] = { input: 0, output: 0 };
        }
        stats.costByPhase[usage.phase].tokens += usage.input + usage.output;
        stats.costByPhase[usage.phase].cost += operationCost;
        stats.tokensByPhase[usage.phase].input += usage.input;
        stats.tokensByPhase[usage.phase].output += usage.output;
      }
    }

    // Average
    if (stats.operationCount > 0) {
      stats.averageCostPerOperation = stats.totalCost / stats.operationCount;
    }

    return stats;
  }

  /**
   * Get current total cost
   */
  getTotalCost(): number {
    return this.getStatistics().totalCost;
  }

  /**
   * Get budget status
   */
  getBudgetStatus(): {
    hasBudget: boolean;
    budget: number | null;
    spent: number;
    remaining: number | null;
    percentage: number;
  } {
    const spent = this.getTotalCost();

    if (this.budget === null) {
      return {
        hasBudget: false,
        budget: null,
        spent,
        remaining: null,
        percentage: 0,
      };
    }

    return {
      hasBudget: true,
      budget: this.budget,
      spent,
      remaining: Math.max(0, this.budget - spent),
      percentage: (spent / this.budget) * 100,
    };
  }

  /**
   * Estimate cost for a planned operation
   */
  estimateCost(
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    model: ModelTier
  ): number {
    const modelCost = MODEL_COSTS[model];
    return (
      (estimatedInputTokens / 1_000_000) * modelCost.input +
      (estimatedOutputTokens / 1_000_000) * modelCost.output
    );
  }

  /**
   * Check if budget allows an operation
   */
  canAfford(estimatedCost: number): boolean {
    if (this.budget === null) return true;
    return this.getTotalCost() + estimatedCost <= this.budget;
  }

  /**
   * Get usage history
   */
  getHistory(): TokenUsage[] {
    return [...this.usageHistory];
  }

  /**
   * Get usage for a specific phase
   */
  getPhaseUsage(phase: string): TokenUsage[] {
    return this.usageHistory.filter(u => u.phase === phase);
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.usageHistory = [];
    this.lastWarningLevel = 0;
    this.callbacks.onCostUpdate?.(this.getStatistics());
  }

  /**
   * Export cost data for persistence
   */
  export(): {
    history: TokenUsage[];
    budget: number | null;
    timestamp: number;
  } {
    return {
      history: this.usageHistory,
      budget: this.budget,
      timestamp: Date.now(),
    };
  }

  /**
   * Import cost data
   */
  import(data: { history: TokenUsage[]; budget?: number | null }): void {
    this.usageHistory = data.history;
    if (data.budget !== undefined) {
      this.budget = data.budget;
    }
    this.callbacks.onCostUpdate?.(this.getStatistics());
    this.checkBudget();
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Check budget and emit warnings
   */
  private checkBudget(): void {
    if (this.budget === null) return;

    const percentage = this.getTotalCost() / this.budget;

    for (let i = this.warningThresholds.length - 1; i >= 0; i--) {
      const threshold = this.warningThresholds[i];
      if (percentage >= threshold && i >= this.lastWarningLevel) {
        this.lastWarningLevel = i + 1;

        const warning: BudgetWarning = {
          level: i === 2 ? 'critical' : i === 1 ? 'warning' : 'info',
          message: this.getWarningMessage(percentage, threshold),
          currentCost: this.getTotalCost(),
          budget: this.budget,
          percentage: percentage * 100,
        };

        this.callbacks.onBudgetWarning?.(warning);
        break;
      }
    }
  }

  /**
   * Get warning message for threshold
   */
  private getWarningMessage(percentage: number, threshold: number): string {
    if (threshold >= 0.95) {
      return `Budget nearly exhausted! ${(percentage * 100).toFixed(1)}% used.`;
    }
    if (threshold >= 0.8) {
      return `Budget warning: ${(percentage * 100).toFixed(1)}% of budget used.`;
    }
    return `Budget info: ${(percentage * 100).toFixed(1)}% of budget used.`;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a cost tracker instance
 */
export function createCostTracker(
  callbacks?: CostTrackerCallbacks,
  budget?: number
): CostTracker {
  return new CostTracker(callbacks, budget);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(3)}¢`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Format tokens for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return String(tokens);
}

/**
 * Get cost summary string
 */
export function getCostSummary(stats: CostStatistics): string {
  const lines: string[] = [];

  lines.push(`Total: ${formatCost(stats.totalCost)}`);
  lines.push(`Tokens: ${formatTokens(stats.totalInputTokens)} in / ${formatTokens(stats.totalOutputTokens)} out`);

  if (Object.keys(stats.costByPhase).length > 0) {
    lines.push('');
    lines.push('By Phase:');
    for (const [phase, data] of Object.entries(stats.costByPhase)) {
      lines.push(`  ${phase}: ${formatCost(data.cost)}`);
    }
  }

  return lines.join('\n');
}
