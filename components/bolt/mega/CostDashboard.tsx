'use client';

/**
 * CostDashboard Component
 *
 * Displays real-time cost tracking and budget status.
 * Integrates with the cost tracker from Phase 5.
 */

import React from 'react';
import type { CostStatistics, BudgetWarning } from '@/lib/bolt/orchestration/costTracker';
import { formatCost, formatTokens } from '@/lib/bolt/orchestration/costTracker';

// =============================================================================
// ICONS
// =============================================================================

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CpuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

// =============================================================================
// TYPES
// =============================================================================

interface CostDashboardProps {
  /** Cost statistics */
  stats: CostStatistics;
  /** Budget limit (if set) */
  budget?: number;
  /** Current budget warning (if any) */
  warning?: BudgetWarning | null;
  /** Whether to show detailed breakdown */
  detailed?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CostDashboard({
  stats,
  budget,
  warning,
  detailed = false,
  compact = false,
}: CostDashboardProps) {
  // Budget percentage
  const budgetPercentage = budget ? (stats.totalCost / budget) * 100 : 0;
  const hasBudget = budget !== undefined && budget > 0;

  // Compact mode for inline display
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <DollarIcon className="w-3 h-3 text-zinc-500" />
        <span className="text-zinc-300">{formatCost(stats.totalCost)}</span>
        {hasBudget && (
          <>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-500">{formatCost(budget!)}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 rounded-lg border border-zinc-800/50 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-white">Cost Tracking</span>
        </div>
        <span className="text-sm font-mono text-emerald-400">
          {formatCost(stats.totalCost)}
        </span>
      </div>

      {/* Warning Banner */}
      {warning && (
        <div className={`px-3 py-2 flex items-center gap-2 text-sm ${
          warning.level === 'critical' ? 'bg-red-500/10 text-red-400' :
          warning.level === 'warning' ? 'bg-amber-500/10 text-amber-400' :
          'bg-blue-500/10 text-blue-400'
        }`}>
          <AlertIcon className="w-4 h-4" />
          <span>{warning.message}</span>
        </div>
      )}

      {/* Budget Progress */}
      {hasBudget && (
        <div className="px-3 py-2 border-b border-zinc-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-400">Budget Usage</span>
            <span className="text-xs text-zinc-500">
              {budgetPercentage.toFixed(1)}% of {formatCost(budget!)}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                budgetPercentage >= 95 ? 'bg-red-500' :
                budgetPercentage >= 80 ? 'bg-amber-500' :
                budgetPercentage >= 50 ? 'bg-yellow-500' :
                'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, budgetPercentage)}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="p-3 grid grid-cols-2 gap-3">
        {/* Total Tokens */}
        <StatCard
          icon={<CpuIcon className="w-4 h-4 text-violet-400" />}
          label="Input Tokens"
          value={formatTokens(stats.totalInputTokens)}
        />
        <StatCard
          icon={<CpuIcon className="w-4 h-4 text-fuchsia-400" />}
          label="Output Tokens"
          value={formatTokens(stats.totalOutputTokens)}
        />

        {/* Operations */}
        <StatCard
          icon={<TrendingUpIcon className="w-4 h-4 text-blue-400" />}
          label="Operations"
          value={String(stats.operationCount)}
        />
        <StatCard
          icon={<DollarIcon className="w-4 h-4 text-emerald-400" />}
          label="Avg Cost"
          value={formatCost(stats.averageCostPerOperation)}
        />
      </div>

      {/* Detailed Breakdown */}
      {detailed && (
        <>
          {/* Model Breakdown */}
          {Object.entries(stats.costByModel).some(([, v]) => v.cost > 0) && (
            <div className="px-3 py-2 border-t border-zinc-800/50">
              <h4 className="text-xs font-medium text-zinc-400 mb-2">By Model</h4>
              <div className="space-y-1">
                {Object.entries(stats.costByModel)
                  .filter(([, v]) => v.cost > 0)
                  .map(([model, data]) => (
                    <div key={model} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300 capitalize">{model}</span>
                      <span className="text-zinc-500">{formatCost(data.cost)}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Phase Breakdown */}
          {Object.keys(stats.costByPhase).length > 0 && (
            <div className="px-3 py-2 border-t border-zinc-800/50">
              <h4 className="text-xs font-medium text-zinc-400 mb-2">By Phase</h4>
              <div className="space-y-1">
                {Object.entries(stats.costByPhase).map(([phase, data]) => (
                  <div key={phase} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300 capitalize">{phase}</span>
                    <span className="text-zinc-500">{formatCost(data.cost)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-zinc-800/30 rounded p-2">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

// =============================================================================
// MINI COST DISPLAY
// =============================================================================

interface MiniCostDisplayProps {
  cost: number;
  budget?: number;
}

export function MiniCostDisplay({ cost, budget }: MiniCostDisplayProps) {
  const percentage = budget ? (cost / budget) * 100 : 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`font-mono ${
        percentage >= 95 ? 'text-red-400' :
        percentage >= 80 ? 'text-amber-400' :
        'text-emerald-400'
      }`}>
        {formatCost(cost)}
      </span>
      {budget && (
        <span className="text-zinc-500">
          / {formatCost(budget)}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// COST BADGE
// =============================================================================

interface CostBadgeProps {
  cost: number;
  size?: 'sm' | 'md';
}

export function CostBadge({ cost, size = 'sm' }: CostBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 rounded-full ${
      size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
    }`}>
      <DollarIcon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {formatCost(cost)}
    </span>
  );
}
