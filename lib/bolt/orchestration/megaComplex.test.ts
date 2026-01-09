/**
 * Mega-Complex Pipeline Tests
 *
 * Tests for Phase 5 components:
 * - Cost Tracker
 * - Approval Manager
 * - Integration tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CostTracker,
  createCostTracker,
  formatCost,
  formatTokens,
  getCostSummary,
  MODEL_COSTS,
  type CostStatistics,
  type BudgetWarning,
} from './costTracker';
import {
  ApprovalManager,
  createApprovalManager,
  getApprovalTypeTitle,
  getApprovalTypeDescription,
  formatDecisionTime,
  type ApprovalRequest,
} from './approvalManager';

// =============================================================================
// COST TRACKER TESTS
// =============================================================================

describe('Cost Tracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = createCostTracker();
  });

  describe('recordUsage', () => {
    it('should record token usage', () => {
      tracker.recordUsage({
        input: 1000,
        output: 500,
        model: 'flash',
      });

      const stats = tracker.getStatistics();
      expect(stats.totalInputTokens).toBe(1000);
      expect(stats.totalOutputTokens).toBe(500);
      expect(stats.operationCount).toBe(1);
    });

    it('should accumulate multiple usages', () => {
      tracker.recordUsage({
        input: 1000,
        output: 500,
        model: 'flash',
      });
      tracker.recordUsage({
        input: 2000,
        output: 1000,
        model: 'pro',
      });

      const stats = tracker.getStatistics();
      expect(stats.totalInputTokens).toBe(3000);
      expect(stats.totalOutputTokens).toBe(1500);
      expect(stats.operationCount).toBe(2);
    });

    it('should track by phase', () => {
      tracker.recordUsage({
        input: 1000,
        output: 500,
        model: 'flash',
        phase: 'research',
      });
      tracker.recordUsage({
        input: 2000,
        output: 1000,
        model: 'flash',
        phase: 'architecture',
      });

      const stats = tracker.getStatistics();
      expect(stats.tokensByPhase.research.input).toBe(1000);
      expect(stats.tokensByPhase.architecture.input).toBe(2000);
    });
  });

  describe('cost calculation', () => {
    it('should calculate cost correctly for flash-lite', () => {
      tracker.recordUsage({
        input: 1_000_000,
        output: 1_000_000,
        model: 'flash-lite',
      });

      const stats = tracker.getStatistics();
      expect(stats.totalCost).toBeCloseTo(
        MODEL_COSTS['flash-lite'].input + MODEL_COSTS['flash-lite'].output
      );
    });

    it('should calculate cost correctly for flash', () => {
      tracker.recordUsage({
        input: 1_000_000,
        output: 1_000_000,
        model: 'flash',
      });

      const stats = tracker.getStatistics();
      expect(stats.totalCost).toBeCloseTo(
        MODEL_COSTS['flash'].input + MODEL_COSTS['flash'].output
      );
    });

    it('should calculate cost correctly for pro', () => {
      tracker.recordUsage({
        input: 1_000_000,
        output: 1_000_000,
        model: 'pro',
      });

      const stats = tracker.getStatistics();
      expect(stats.totalCost).toBeCloseTo(
        MODEL_COSTS['pro'].input + MODEL_COSTS['pro'].output
      );
    });

    it('should track cost by model', () => {
      tracker.recordUsage({ input: 1000, output: 500, model: 'flash-lite' });
      tracker.recordUsage({ input: 2000, output: 1000, model: 'flash' });
      tracker.recordUsage({ input: 500, output: 250, model: 'pro' });

      const stats = tracker.getStatistics();
      expect(stats.costByModel['flash-lite'].input).toBe(1000);
      expect(stats.costByModel['flash'].input).toBe(2000);
      expect(stats.costByModel['pro'].input).toBe(500);
    });
  });

  describe('budget management', () => {
    it('should set and clear budget', () => {
      tracker.setBudget(1.0);
      let status = tracker.getBudgetStatus();
      expect(status.hasBudget).toBe(true);
      expect(status.budget).toBe(1.0);

      tracker.clearBudget();
      status = tracker.getBudgetStatus();
      expect(status.hasBudget).toBe(false);
    });

    it('should track remaining budget', () => {
      tracker.setBudget(1.0);
      tracker.recordUsage({
        input: 1_000_000,
        output: 0,
        model: 'flash-lite', // $0.075 per 1M input
      });

      const status = tracker.getBudgetStatus();
      expect(status.spent).toBeCloseTo(0.075);
      expect(status.remaining).toBeCloseTo(0.925);
    });

    it('should emit budget warnings', () => {
      const warnings: BudgetWarning[] = [];
      const trackerWithBudget = createCostTracker({
        onBudgetWarning: (w) => warnings.push(w),
      }, 0.10);

      // Add usage that exceeds 50%
      trackerWithBudget.recordUsage({
        input: 1_000_000,
        output: 0,
        model: 'flash-lite', // $0.075 = 75% of $0.10 budget
      });

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.level === 'warning' || w.level === 'info')).toBe(true);
    });

    it('should check if operation is affordable', () => {
      tracker.setBudget(0.10);
      tracker.recordUsage({
        input: 1_000_000,
        output: 0,
        model: 'flash-lite', // $0.075
      });

      const affordableSmall = tracker.canAfford(0.01);
      const affordableLarge = tracker.canAfford(0.10);

      expect(affordableSmall).toBe(true);
      expect(affordableLarge).toBe(false);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for planned operation', () => {
      const estimate = tracker.estimateCost(1_000_000, 500_000, 'flash');
      const expected = (1_000_000 / 1_000_000) * MODEL_COSTS.flash.input +
                       (500_000 / 1_000_000) * MODEL_COSTS.flash.output;
      expect(estimate).toBeCloseTo(expected);
    });
  });

  describe('export/import', () => {
    it('should export data', () => {
      tracker.recordUsage({ input: 1000, output: 500, model: 'flash' });
      tracker.setBudget(1.0);

      const exported = tracker.export();
      expect(exported.history.length).toBe(1);
      expect(exported.budget).toBe(1.0);
    });

    it('should import data', () => {
      const data = {
        history: [{
          input: 1000,
          output: 500,
          model: 'flash' as const,
          timestamp: Date.now(),
        }],
        budget: 2.0,
      };

      tracker.import(data);
      const stats = tracker.getStatistics();
      expect(stats.totalInputTokens).toBe(1000);
      expect(tracker.getBudgetStatus().budget).toBe(2.0);
    });
  });

  describe('reset', () => {
    it('should reset all data', () => {
      tracker.recordUsage({ input: 1000, output: 500, model: 'flash' });
      tracker.reset();

      const stats = tracker.getStatistics();
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.operationCount).toBe(0);
    });
  });
});

describe('Cost Formatting', () => {
  describe('formatCost', () => {
    it('should format small costs in cents', () => {
      expect(formatCost(0.001)).toContain('¢');
    });

    it('should format larger costs in dollars', () => {
      const formatted = formatCost(1.50);
      expect(formatted).toBe('$1.5000');
    });
  });

  describe('formatTokens', () => {
    it('should format millions', () => {
      expect(formatTokens(1_500_000)).toBe('1.50M');
    });

    it('should format thousands', () => {
      expect(formatTokens(1_500)).toBe('1.5K');
    });

    it('should format small numbers', () => {
      expect(formatTokens(500)).toBe('500');
    });
  });

  describe('getCostSummary', () => {
    it('should generate summary string', () => {
      const stats: CostStatistics = {
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalCost: 0.01,
        costByModel: {
          'flash-lite': { input: 0, output: 0, cost: 0 },
          'flash': { input: 1000, output: 500, cost: 0.01 },
          'pro': { input: 0, output: 0, cost: 0 },
        },
        costByPhase: { research: { tokens: 1500, cost: 0.01 } },
        tokensByPhase: { research: { input: 1000, output: 500 } },
        averageCostPerOperation: 0.01,
        operationCount: 1,
      };

      const summary = getCostSummary(stats);
      expect(summary).toContain('Total');
      expect(summary).toContain('Tokens');
    });
  });
});

// =============================================================================
// APPROVAL MANAGER TESTS
// =============================================================================

describe('Approval Manager', () => {
  let manager: ApprovalManager;

  beforeEach(() => {
    manager = createApprovalManager();
  });

  describe('requestApproval', () => {
    it('should create approval request', () => {
      const request = manager.requestApproval(
        'research',
        'Research Results',
        'Please review the research findings',
        { summary: 'Found 10 sources' }
      );

      expect(request.id).toBeDefined();
      expect(request.type).toBe('research');
      expect(request.status).toBe('pending');
    });

    it('should track requests', () => {
      manager.requestApproval('research', 'Test', 'Test', {});
      manager.requestApproval('prd', 'Test 2', 'Test 2', {});

      const pending = manager.getPendingRequests();
      expect(pending.length).toBe(2);
    });

    it('should support estimated cost and time', () => {
      const request = manager.requestApproval(
        'architecture',
        'Architecture',
        'Review architecture',
        {},
        { estimatedCost: 0.50, estimatedTime: 60000 }
      );

      expect(request.estimatedCost).toBe(0.50);
      expect(request.estimatedTime).toBe(60000);
    });
  });

  describe('approve/reject', () => {
    it('should approve request', () => {
      const request = manager.requestApproval('research', 'Test', 'Test', {});
      const approved = manager.approve(request.id);

      expect(approved).toBe(true);
      expect(manager.getRequest(request.id)?.status).toBe('approved');
    });

    it('should reject request with reason', () => {
      const request = manager.requestApproval('research', 'Test', 'Test', {});
      const rejected = manager.reject(request.id, 'Not comprehensive enough');

      expect(rejected).toBe(true);
      const updated = manager.getRequest(request.id);
      expect(updated?.status).toBe('rejected');
      expect(updated?.rejectionReason).toBe('Not comprehensive enough');
    });

    it('should not approve already resolved request', () => {
      const request = manager.requestApproval('research', 'Test', 'Test', {});
      manager.approve(request.id);
      const secondApprove = manager.approve(request.id);

      expect(secondApprove).toBe(false);
    });
  });

  describe('waitForApproval', () => {
    it('should resolve when approved', async () => {
      const request = manager.requestApproval('research', 'Test', 'Test', {});

      // Approve after a short delay
      setTimeout(() => manager.approve(request.id), 10);

      const result = await manager.waitForApproval(request.id);
      expect(result.approved).toBe(true);
    });

    it('should resolve when rejected', async () => {
      const request = manager.requestApproval('research', 'Test', 'Test', {});

      setTimeout(() => manager.reject(request.id, 'Rejected'), 10);

      const result = await manager.waitForApproval(request.id);
      expect(result.approved).toBe(false);
      expect(result.reason).toBe('Rejected');
    });

    it('should return immediately for resolved request', async () => {
      const request = manager.requestApproval('research', 'Test', 'Test', {});
      manager.approve(request.id);

      const result = await manager.waitForApproval(request.id);
      expect(result.approved).toBe(true);
    });
  });

  describe('auto-approve', () => {
    it('should auto-approve configured types', async () => {
      const autoManager = createApprovalManager({
        autoApprove: { research: true },
      });

      const request = autoManager.requestApproval('research', 'Test', 'Test', {});

      // Wait for auto-approve timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(autoManager.getRequest(request.id)?.status).toBe('approved');
    });

    it('should not auto-approve non-configured types', () => {
      const autoManager = createApprovalManager({
        autoApprove: { research: true },
      });

      const request = autoManager.requestApproval('prd', 'Test', 'Test', {});
      expect(request.status).toBe('pending');
    });

    it('should allow updating auto-approve settings', () => {
      manager.setAutoApprove('architecture', true);
      expect(manager.isAutoApproved('architecture')).toBe(true);

      manager.setAutoApprove('architecture', false);
      expect(manager.isAutoApproved('architecture')).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('should call onApprovalRequested', () => {
      const callback = vi.fn();
      const callbackManager = createApprovalManager({
        callbacks: { onApprovalRequested: callback },
      });

      callbackManager.requestApproval('research', 'Test', 'Test', {});
      expect(callback).toHaveBeenCalled();
    });

    it('should call onApproved', () => {
      const callback = vi.fn();
      const callbackManager = createApprovalManager({
        callbacks: { onApproved: callback },
      });

      const request = callbackManager.requestApproval('research', 'Test', 'Test', {});
      callbackManager.approve(request.id);

      expect(callback).toHaveBeenCalled();
    });

    it('should call onRejected', () => {
      const callback = vi.fn();
      const callbackManager = createApprovalManager({
        callbacks: { onRejected: callback },
      });

      const request = callbackManager.requestApproval('research', 'Test', 'Test', {});
      callbackManager.reject(request.id, 'Reason');

      expect(callback).toHaveBeenCalledWith(expect.anything(), 'Reason');
    });
  });

  describe('statistics', () => {
    it('should track approval statistics', () => {
      manager.requestApproval('research', 'R1', 'R1', {});
      manager.requestApproval('research', 'R2', 'R2', {});
      manager.requestApproval('prd', 'P1', 'P1', {});

      const r1 = manager.getRequestsByType('research')[0];
      const r2 = manager.getRequestsByType('research')[1];
      const p1 = manager.getRequestsByType('prd')[0];

      manager.approve(r1.id);
      manager.reject(r2.id);

      const stats = manager.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.byType.research.count).toBe(2);
      expect(stats.byType.research.approved).toBe(1);
    });
  });

  describe('getCurrentPendingRequest', () => {
    it('should return a pending request when multiple exist', () => {
      const first = manager.requestApproval('research', 'R1', 'R1', {});
      const second = manager.requestApproval('prd', 'P1', 'P1', {});

      const current = manager.getCurrentPendingRequest();
      // Should return one of the pending requests
      expect(current).toBeDefined();
      expect([first.id, second.id]).toContain(current?.id);
      expect(current?.status).toBe('pending');
    });

    it('should return undefined if no pending', () => {
      const request = manager.requestApproval('research', 'R1', 'R1', {});
      manager.approve(request.id);

      expect(manager.getCurrentPendingRequest()).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all requests', () => {
      manager.requestApproval('research', 'R1', 'R1', {});
      manager.requestApproval('prd', 'P1', 'P1', {});
      manager.clear();

      expect(manager.getAllRequests().length).toBe(0);
    });
  });
});

describe('Approval Helpers', () => {
  describe('getApprovalTypeTitle', () => {
    it('should return title for each type', () => {
      expect(getApprovalTypeTitle('research')).toBe('Research Results');
      expect(getApprovalTypeTitle('prd')).toBe('Product Requirements');
      expect(getApprovalTypeTitle('architecture')).toBe('Technical Architecture');
      expect(getApprovalTypeTitle('phase')).toBe('Implementation Phase');
      expect(getApprovalTypeTitle('fix')).toBe('Error Fix');
    });
  });

  describe('getApprovalTypeDescription', () => {
    it('should return description for each type', () => {
      expect(getApprovalTypeDescription('research')).toContain('research');
      expect(getApprovalTypeDescription('prd')).toContain('product');
      expect(getApprovalTypeDescription('architecture')).toContain('architecture');
    });
  });

  describe('formatDecisionTime', () => {
    it('should format milliseconds', () => {
      expect(formatDecisionTime(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDecisionTime(5000)).toBe('5.0s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDecisionTime(90000)).toBe('1m 30s');
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Cost Tracker + Approval Manager Integration', () => {
  it('should track cost with approval requests', () => {
    const tracker = createCostTracker();
    const manager = createApprovalManager();

    // Simulate research phase
    tracker.recordUsage({
      input: 5000,
      output: 2000,
      model: 'pro',
      phase: 'research',
      operation: 'Web search',
    });

    const researchRequest = manager.requestApproval(
      'research',
      'Research Complete',
      'Review research findings',
      { findingsCount: 15 },
      { estimatedCost: tracker.getTotalCost() }
    );

    expect(researchRequest.estimatedCost).toBeGreaterThan(0);

    // Approve and continue
    manager.approve(researchRequest.id);

    // Simulate PRD generation
    tracker.recordUsage({
      input: 3000,
      output: 5000,
      model: 'pro',
      phase: 'prd',
      operation: 'PRD generation',
    });

    const stats = tracker.getStatistics();
    expect(stats.costByPhase.research).toBeDefined();
    expect(stats.costByPhase.prd).toBeDefined();
    expect(Object.keys(stats.costByPhase).length).toBe(2);
  });

  it('should support budget-aware approval workflow', () => {
    const tracker = createCostTracker();
    tracker.setBudget(0.01);

    const manager = createApprovalManager();

    // Check if we can afford PRD generation
    const estimatedCost = tracker.estimateCost(5000, 3000, 'pro');
    const canAfford = tracker.canAfford(estimatedCost);

    if (canAfford) {
      manager.requestApproval('prd', 'Generate PRD', 'Generate product requirements', {});
    }

    // With $0.01 budget, pro model for 5K input + 3K output should be unaffordable
    expect(canAfford).toBe(false);
    expect(manager.getPendingRequests().length).toBe(0);
  });
});
