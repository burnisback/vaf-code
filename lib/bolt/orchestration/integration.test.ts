/**
 * Orchestration Integration Tests
 *
 * Tests for the complete orchestration pipeline integration.
 * Verifies that all components work together correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createOrchestrator,
  getStateDescription,
  isTerminalState,
  allowsUserIntervention,
} from './machine';
import {
  createCostTracker,
  formatCost,
  formatTokens,
} from './costTracker';
import {
  createApprovalManager,
  getApprovalTypeTitle,
  formatDecisionTime,
} from './approvalManager';
import type {
  OrchestrationState,
  Orchestrator,
} from './types';

// =============================================================================
// STATE MACHINE INTEGRATION TESTS
// =============================================================================

describe('State Machine Integration', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = createOrchestrator({ originalPrompt: 'Build a todo app' });
  });

  describe('Full Flow Simulation', () => {
    it('should progress through major states with correct transitions', () => {
      const states: OrchestrationState[] = [];

      orchestrator.subscribe((state) => {
        states.push(state);
      });

      // Start research
      orchestrator.send({
        type: 'START_RESEARCH',
        payload: { prompt: 'Build a todo app' },
      });
      expect(orchestrator.state).toBe('researching');

      // Complete research -> awaiting-approval
      orchestrator.send({
        type: 'RESEARCH_COMPLETE',
        payload: { sessionId: 'research_123' },
      });
      expect(orchestrator.state).toBe('awaiting-approval');

      // Approve -> defining-product
      orchestrator.send({ type: 'USER_APPROVE' });
      expect(orchestrator.state).toBe('defining-product');

      // Complete PRD -> awaiting-approval
      orchestrator.send({
        type: 'PRODUCT_DEFINED',
        payload: { prdId: 'prd_123' },
      });
      expect(orchestrator.state).toBe('awaiting-approval');

      // Approve -> generating-architecture
      orchestrator.send({ type: 'USER_APPROVE' });
      expect(orchestrator.state).toBe('generating-architecture');

      // Complete architecture -> awaiting-approval
      orchestrator.send({
        type: 'ARCHITECTURE_COMPLETE',
        payload: { archId: 'arch_123' },
      });
      expect(orchestrator.state).toBe('awaiting-approval');

      // Verify we went through expected states
      expect(states).toContain('researching');
      expect(states).toContain('awaiting-approval');
      expect(states).toContain('defining-product');
      expect(states).toContain('generating-architecture');
    });

    it('should handle rejection flow', () => {
      orchestrator.send({
        type: 'START_RESEARCH',
        payload: { prompt: 'Build a todo app' },
      });

      orchestrator.send({
        type: 'RESEARCH_COMPLETE',
        payload: { sessionId: 'research_123' },
      });

      expect(orchestrator.state).toBe('awaiting-approval');

      // Reject research
      orchestrator.send({
        type: 'USER_REJECT',
        payload: { reason: 'Need more detail' },
      });

      // After rejection, goes to idle
      expect(orchestrator.state).toBe('idle');
    });

    it('should handle pause and resume', () => {
      orchestrator.send({
        type: 'START_RESEARCH',
        payload: { prompt: 'Build a todo app' },
      });

      // Pause
      orchestrator.send({ type: 'USER_PAUSE' });
      expect(orchestrator.state).toBe('paused');

      // Resume
      orchestrator.send({ type: 'USER_RESUME' });
      expect(orchestrator.state).toBe('researching');
    });

    it('should track context throughout flow', () => {
      orchestrator.send({
        type: 'START_RESEARCH',
        payload: { prompt: 'Build a todo app' },
      });

      orchestrator.send({
        type: 'RESEARCH_COMPLETE',
        payload: { sessionId: 'research_123' },
      });

      expect(orchestrator.context.researchSessionId).toBe('research_123');

      orchestrator.send({ type: 'USER_APPROVE' });
      orchestrator.send({
        type: 'PRODUCT_DEFINED',
        payload: { prdId: 'prd_456' },
      });

      expect(orchestrator.context.prdId).toBe('prd_456');
      expect(orchestrator.context.researchSessionId).toBe('research_123');

      orchestrator.send({ type: 'USER_APPROVE' });
      orchestrator.send({
        type: 'ARCHITECTURE_COMPLETE',
        payload: { archId: 'arch_789' },
      });

      expect(orchestrator.context.architectureId).toBe('arch_789');
      expect(orchestrator.context.prdId).toBe('prd_456');
      expect(orchestrator.context.researchSessionId).toBe('research_123');
    });
  });

  describe('Error Handling Integration', () => {
    it('should transition to failed on error', () => {
      orchestrator.send({
        type: 'START_RESEARCH',
        payload: { prompt: 'Build a todo app' },
      });

      orchestrator.send({
        type: 'ERROR',
        payload: { message: 'Network error' },
      });

      expect(orchestrator.state).toBe('failed');
      expect(orchestrator.context.error).toBe('Network error');
    });

    it('should allow reset after failure', () => {
      orchestrator.send({
        type: 'START_RESEARCH',
        payload: { prompt: 'Build a todo app' },
      });

      orchestrator.send({
        type: 'ERROR',
        payload: { message: 'Temporary error' },
      });

      expect(orchestrator.state).toBe('failed');

      // Reset to start over
      orchestrator.send({ type: 'RESET' });

      expect(orchestrator.state).toBe('idle');
    });
  });

  describe('State Description Integration', () => {
    it('should provide descriptions for all states', () => {
      const states: OrchestrationState[] = [
        'idle',
        'researching',
        'defining-product',
        'generating-architecture',
        'planning-phase',
        'executing-phase',
        'verifying',
        'refining',
        'awaiting-approval',
        'paused',
        'complete',
        'failed',
      ];

      for (const state of states) {
        const description = getStateDescription(state);
        expect(description).toBeTruthy();
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      }
    });

    it('should correctly identify terminal states', () => {
      expect(isTerminalState('complete')).toBe(true);
      expect(isTerminalState('failed')).toBe(true);
      expect(isTerminalState('researching')).toBe(false);
      expect(isTerminalState('executing-phase')).toBe(false);
    });

    it('should correctly identify user intervention states', () => {
      expect(allowsUserIntervention('awaiting-approval')).toBe(true);
      expect(allowsUserIntervention('paused')).toBe(true);
      expect(allowsUserIntervention('researching')).toBe(false);
      expect(allowsUserIntervention('complete')).toBe(false);
    });
  });
});

// =============================================================================
// COST TRACKER INTEGRATION TESTS
// =============================================================================

describe('Cost Tracker Integration', () => {
  let onCostUpdate: ReturnType<typeof vi.fn>;
  let onBudgetWarning: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCostUpdate = vi.fn();
    onBudgetWarning = vi.fn();
  });

  describe('Multi-Phase Cost Tracking', () => {
    it('should track costs across multiple phases', () => {
      const costTracker = createCostTracker({
        onCostUpdate,
        onBudgetWarning,
      }, 1.00);

      // Research phase
      costTracker.recordUsage({
        input: 5000,
        output: 2000,
        model: 'pro',
        phase: 'research',
        operation: 'Web research',
      });

      // PRD phase
      costTracker.recordUsage({
        input: 3000,
        output: 4000,
        model: 'pro',
        phase: 'prd',
        operation: 'Generate PRD',
      });

      // Architecture phase
      costTracker.recordUsage({
        input: 4000,
        output: 5000,
        model: 'pro',
        phase: 'architecture',
        operation: 'Generate architecture',
      });

      // Implementation phases
      for (let i = 1; i <= 5; i++) {
        costTracker.recordUsage({
          input: 1000,
          output: 500,
          model: 'flash',
          phase: `phase_${i}`,
          operation: 'Task execution',
        });
      }

      const stats = costTracker.getStatistics();

      // Verify totals
      expect(stats.totalInputTokens).toBe(5000 + 3000 + 4000 + 5000);
      expect(stats.totalOutputTokens).toBe(2000 + 4000 + 5000 + 2500);
      expect(stats.operationCount).toBe(8);

      // Verify phase breakdown
      expect(stats.costByPhase['research']).toBeDefined();
      expect(stats.costByPhase['prd']).toBeDefined();
      expect(stats.costByPhase['architecture']).toBeDefined();

      // Verify model cost breakdown
      expect(stats.costByModel['pro'].cost).toBeGreaterThan(0);
      expect(stats.costByModel['flash'].cost).toBeGreaterThan(0);
    });

    it('should trigger budget warnings at correct thresholds', () => {
      // Set up with $1 budget
      const tracker = createCostTracker({
        onBudgetWarning,
      }, 1.00);

      // Add costs to reach 50%
      tracker.recordUsage({
        input: 200000, // 200k input at pro rate = $0.25
        output: 50000, // 50k output at pro rate = $0.25
        model: 'pro',
        phase: 'test',
        operation: 'Test 50%',
      });

      // Should trigger info warning at 50%
      expect(onBudgetWarning).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' })
      );

      // Add more to exceed budget (triggers critical)
      tracker.recordUsage({
        input: 200000,
        output: 60000,
        model: 'pro',
        phase: 'test',
        operation: 'Test exceed',
      });

      // Should trigger critical warning when budget exceeded
      expect(onBudgetWarning).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'critical' })
      );
    });

    it('should correctly estimate costs before operations', () => {
      const costTracker = createCostTracker({});
      const estimatedCost = costTracker.estimateCost(10000, 5000, 'pro');

      // Pro: $1.25/M input + $5.00/M output
      // 10000 * 0.00000125 + 5000 * 0.000005 = 0.0125 + 0.025 = 0.0375
      expect(estimatedCost).toBeCloseTo(0.0375, 4);
    });

    it('should track whether operations can be afforded', () => {
      const costTracker = createCostTracker({}, 0.01);

      // Small operation should be affordable
      expect(costTracker.canAfford(0.005)).toBe(true);

      // Large operation should not be affordable
      expect(costTracker.canAfford(0.02)).toBe(false);

      // After spending, budget status changes
      costTracker.recordUsage({
        input: 1000,
        output: 500,
        model: 'flash',
        phase: 'test',
        operation: 'Small op',
      });

      const status = costTracker.getBudgetStatus();
      expect(status.remaining).toBeLessThan(0.01);
    });
  });

  describe('Formatting Integration', () => {
    it('should format costs correctly', () => {
      // Small values (< $0.01) use cent format
      expect(formatCost(0)).toBe('$0.000¢');
      expect(formatCost(0.001)).toBe('$0.100¢');
      expect(formatCost(0.005)).toBe('$0.500¢');
      // Larger values use dollar format
      expect(formatCost(0.01)).toBe('$0.0100');
      expect(formatCost(0.1234)).toBe('$0.1234');
      expect(formatCost(1.5)).toBe('$1.5000');
      expect(formatCost(10.999)).toBe('$10.9990');
    });

    it('should format tokens correctly', () => {
      expect(formatTokens(0)).toBe('0');
      expect(formatTokens(500)).toBe('500');
      expect(formatTokens(1500)).toBe('1.5K');
      expect(formatTokens(15000)).toBe('15.0K');
      expect(formatTokens(1500000)).toBe('1.50M');
    });
  });
});

// =============================================================================
// APPROVAL MANAGER INTEGRATION TESTS
// =============================================================================

describe('Approval Manager Integration', () => {
  let approvalManager: ApprovalManager;
  let onApprovalRequested: ReturnType<typeof vi.fn>;
  let onApproved: ReturnType<typeof vi.fn>;
  let onRejected: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onApprovalRequested = vi.fn();
    onApproved = vi.fn();
    onRejected = vi.fn();

    approvalManager = createApprovalManager({
      callbacks: {
        onApprovalRequested,
        onApproved,
        onRejected,
      },
    });
  });

  describe('Full Approval Flow', () => {
    it('should handle research → PRD → architecture approval flow', async () => {
      // Research approval
      const researchRequest = approvalManager.requestApproval(
        'research',
        'Research Complete',
        'Review research findings',
        { findings: ['Finding 1', 'Finding 2'] }
      );

      expect(onApprovalRequested).toHaveBeenCalledWith(researchRequest);
      expect(approvalManager.hasPendingApproval()).toBe(true);

      approvalManager.approve(researchRequest.id);
      expect(onApproved).toHaveBeenCalled();

      // PRD approval
      const prdRequest = approvalManager.requestApproval(
        'prd',
        'PRD Generated',
        'Review product requirements',
        { title: 'Todo App', features: [] }
      );

      approvalManager.approve(prdRequest.id);

      // Architecture approval
      const archRequest = approvalManager.requestApproval(
        'architecture',
        'Architecture Ready',
        'Review technical architecture',
        { components: [], phases: [] }
      );

      approvalManager.approve(archRequest.id);

      // Verify all approved
      const stats = approvalManager.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.approved).toBe(3);
      expect(stats.pending).toBe(0);
    });

    it('should handle rejection with feedback', () => {
      const request = approvalManager.requestApproval(
        'prd',
        'PRD Generated',
        'Review requirements',
        { title: 'App' }
      );

      approvalManager.reject(request.id, 'Missing user stories');

      expect(onRejected).toHaveBeenCalledWith(request, 'Missing user stories');

      const updated = approvalManager.getRequest(request.id);
      expect(updated?.status).toBe('rejected');
      expect(updated?.rejectionReason).toBe('Missing user stories');
    });

    it('should handle concurrent approval requests', async () => {
      const requests = [
        approvalManager.requestApproval('phase', 'Phase 1', 'Review', {}),
        approvalManager.requestApproval('phase', 'Phase 2', 'Review', {}),
        approvalManager.requestApproval('phase', 'Phase 3', 'Review', {}),
      ];

      expect(approvalManager.getPendingRequests().length).toBe(3);

      // Approve all
      for (const request of requests) {
        approvalManager.approve(request.id);
      }

      expect(approvalManager.getPendingRequests().length).toBe(0);

      const stats = approvalManager.getStatistics();
      expect(stats.approved).toBe(3);
    });
  });

  describe('Auto-Approve Integration', () => {
    it('should auto-approve configured types', async () => {
      const autoManager = createApprovalManager({
        autoApprove: { research: true, prd: true },
        callbacks: { onApproved },
      });

      const request = autoManager.requestApproval(
        'research',
        'Research',
        'Auto-approve test',
        {}
      );

      // Wait for auto-approve
      await new Promise(resolve => setTimeout(resolve, 150));

      const updated = autoManager.getRequest(request.id);
      expect(updated?.status).toBe('approved');
    });

    it('should not auto-approve non-configured types', async () => {
      const autoManager = createApprovalManager({
        autoApprove: { research: true },
      });

      const request = autoManager.requestApproval(
        'architecture',
        'Architecture',
        'Should not auto-approve',
        {}
      );

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(request.status).toBe('pending');
    });
  });

  describe('waitForApproval Integration', () => {
    it('should resolve when approved', async () => {
      const request = approvalManager.requestApproval(
        'prd',
        'PRD',
        'Test',
        {}
      );

      // Approve after short delay
      setTimeout(() => {
        approvalManager.approve(request.id);
      }, 50);

      const result = await approvalManager.waitForApproval(request.id);

      expect(result.approved).toBe(true);
      expect(result.decisionTime).toBeGreaterThanOrEqual(50);
    });

    it('should resolve when rejected', async () => {
      const request = approvalManager.requestApproval(
        'prd',
        'PRD',
        'Test',
        {}
      );

      setTimeout(() => {
        approvalManager.reject(request.id, 'Not good');
      }, 50);

      const result = await approvalManager.waitForApproval(request.id);

      expect(result.approved).toBe(false);
      expect(result.reason).toBe('Not good');
    });
  });

  describe('Helper Functions', () => {
    it('should return correct approval type titles', () => {
      expect(getApprovalTypeTitle('research')).toBe('Research Results');
      expect(getApprovalTypeTitle('prd')).toBe('Product Requirements');
      expect(getApprovalTypeTitle('architecture')).toBe('Technical Architecture');
      expect(getApprovalTypeTitle('phase')).toBe('Implementation Phase');
      expect(getApprovalTypeTitle('fix')).toBe('Error Fix');
    });

    it('should format decision times correctly', () => {
      expect(formatDecisionTime(500)).toBe('500ms');
      expect(formatDecisionTime(1500)).toBe('1.5s');
      expect(formatDecisionTime(30000)).toBe('30.0s');
      expect(formatDecisionTime(65000)).toBe('1m 5s');
      expect(formatDecisionTime(120000)).toBe('2m 0s');
    });
  });
});

// =============================================================================
// COMBINED SYSTEM INTEGRATION TESTS
// =============================================================================

describe('Combined System Integration', () => {
  it('should integrate orchestrator with cost tracker', () => {
    const costTracker = createCostTracker({}, 5.00);
    const orchestrator = createOrchestrator({ originalPrompt: 'Build app' });

    // Simulate orchestration with cost tracking
    orchestrator.send({
      type: 'START_RESEARCH',
      payload: { prompt: 'Build app' },
    });

    // Track research costs
    costTracker.recordUsage({
      input: 5000,
      output: 2000,
      model: 'pro',
      phase: 'research',
      operation: 'Initial research',
    });

    expect(orchestrator.state).toBe('researching');
    expect(costTracker.getTotalCost()).toBeGreaterThan(0);

    orchestrator.send({
      type: 'RESEARCH_COMPLETE',
      payload: { sessionId: 'r1' },
    });

    // PRD generation
    orchestrator.send({ type: 'USER_APPROVE' });
    costTracker.recordUsage({
      input: 3000,
      output: 4000,
      model: 'pro',
      phase: 'prd',
      operation: 'Generate PRD',
    });

    expect(orchestrator.state).toBe('defining-product');

    // Verify cost tracking throughout
    const stats = costTracker.getStatistics();
    expect(stats.costByPhase['research']).toBeDefined();
    expect(stats.costByPhase['prd']).toBeDefined();
  });

  it('should integrate orchestrator with approval manager', () => {
    const approvalManager = createApprovalManager();
    const orchestrator = createOrchestrator({ originalPrompt: 'Build app' });

    orchestrator.send({
      type: 'START_RESEARCH',
      payload: { prompt: 'Build app' },
    });

    orchestrator.send({
      type: 'RESEARCH_COMPLETE',
      payload: { sessionId: 'r1' },
    });

    expect(orchestrator.state).toBe('awaiting-approval');

    // Create approval request
    const request = approvalManager.requestApproval(
      'research',
      'Research Complete',
      'Review findings',
      { sessionId: 'r1' }
    );

    expect(approvalManager.hasPendingApproval()).toBe(true);

    // Approve and advance orchestrator
    approvalManager.approve(request.id);
    orchestrator.send({ type: 'USER_APPROVE' });

    expect(orchestrator.state).toBe('defining-product');
    expect(approvalManager.hasPendingApproval()).toBe(false);
  });

  it('should track full pipeline cost and approvals', () => {
    const costTracker = createCostTracker({}, 10.00);
    const approvalManager = createApprovalManager();
    const orchestrator = createOrchestrator({ originalPrompt: 'Build todo app' });

    // Start
    orchestrator.send({
      type: 'START_RESEARCH',
      payload: { prompt: 'Build todo app' },
    });

    // Phase 1: Research
    costTracker.recordUsage({
      input: 2000,
      output: 1000,
      model: 'pro',
      phase: 'research',
      operation: 'Research execution',
    });
    orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 'r1' } });
    const r1 = approvalManager.requestApproval('research', 'Research Complete', 'Review', {});
    approvalManager.approve(r1.id);
    orchestrator.send({ type: 'USER_APPROVE' });

    // Phase 2: PRD
    costTracker.recordUsage({
      input: 2000,
      output: 1000,
      model: 'pro',
      phase: 'prd',
      operation: 'PRD execution',
    });
    orchestrator.send({ type: 'PRODUCT_DEFINED', payload: { prdId: 'prd1' } });
    const r2 = approvalManager.requestApproval('prd', 'PRD Complete', 'Review', {});
    approvalManager.approve(r2.id);
    orchestrator.send({ type: 'USER_APPROVE' });

    // Phase 3: Architecture
    costTracker.recordUsage({
      input: 2000,
      output: 1000,
      model: 'pro',
      phase: 'architecture',
      operation: 'Architecture execution',
    });
    orchestrator.send({ type: 'ARCHITECTURE_COMPLETE', payload: { archId: 'arch1' } });
    const r3 = approvalManager.requestApproval('architecture', 'Architecture Complete', 'Review', {});
    approvalManager.approve(r3.id);
    orchestrator.send({ type: 'USER_APPROVE' });

    // Verify final state (after architecture approval, goes to planning-phase)
    expect(orchestrator.state).toBe('planning-phase');

    // Verify cost tracking
    const costStats = costTracker.getStatistics();
    expect(costStats.operationCount).toBe(3);
    expect(costStats.totalCost).toBeGreaterThan(0);

    // Verify approval statistics
    const approvalStats = approvalManager.getStatistics();
    expect(approvalStats.total).toBe(3);
    expect(approvalStats.approved).toBe(3);
  });
});

// =============================================================================
// EDGE CASES AND ERROR SCENARIOS
// =============================================================================

describe('Edge Cases and Error Scenarios', () => {
  describe('Concurrent Operations', () => {
    it('should handle rapid state transitions', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      // Rapid transitions
      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 'r1' } });
      orchestrator.send({ type: 'USER_APPROVE' });
      orchestrator.send({ type: 'PRODUCT_DEFINED', payload: { prdId: 'p1' } });

      // Should be in awaiting-approval
      expect(orchestrator.state).toBe('awaiting-approval');
    });

    it('should handle multiple cost recordings in quick succession', () => {
      const costTracker = createCostTracker({});

      // Rapid recordings
      for (let i = 0; i < 100; i++) {
        costTracker.recordUsage({
          input: 100,
          output: 50,
          model: 'flash-lite',
          phase: 'test',
          operation: `Op ${i}`,
        });
      }

      const stats = costTracker.getStatistics();
      expect(stats.operationCount).toBe(100);
      expect(stats.totalInputTokens).toBe(10000);
    });
  });

  describe('Invalid State Transitions', () => {
    it('should ignore invalid events', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      // Try to complete research before starting
      orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 'r1' } });
      expect(orchestrator.state).toBe('idle');

      // Start properly
      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      expect(orchestrator.state).toBe('researching');

      // Try to approve (invalid in researching state)
      orchestrator.send({ type: 'USER_APPROVE' });
      expect(orchestrator.state).toBe('researching');
    });
  });

  describe('Budget Exhaustion', () => {
    it('should track when budget is exceeded', () => {
      const costTracker = createCostTracker({}, 0.01);

      // Exceed budget
      costTracker.recordUsage({
        input: 50000,
        output: 20000,
        model: 'pro',
        phase: 'test',
        operation: 'Large operation',
      });

      expect(costTracker.getTotalCost()).toBeGreaterThan(0.01);

      const status = costTracker.getBudgetStatus();
      expect(status.remaining).toBe(0); // Clamped to 0
      expect(costTracker.canAfford(0.001)).toBe(false);
    });
  });

  describe('Approval Timeout', () => {
    it('should handle expired approvals', async () => {
      const onExpired = vi.fn();
      const manager = createApprovalManager({
        defaultTimeout: 100,
        callbacks: { onExpired },
      });

      const request = manager.requestApproval(
        'prd',
        'PRD',
        'Test',
        {},
        { timeout: 50 }
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await manager.waitForApproval(request.id);
      expect(result.approved).toBe(false);
      expect(result.reason).toBe('Request expired');
    });
  });
});

// =============================================================================
// STATISTICS AND METRICS
// =============================================================================

describe('Statistics and Metrics', () => {
  it('should calculate accurate cost statistics', () => {
    const costTracker = createCostTracker({});

    // Add varied operations
    costTracker.recordUsage({
      input: 10000,
      output: 5000,
      model: 'pro',
      phase: 'research',
      operation: 'Research',
    });

    costTracker.recordUsage({
      input: 5000,
      output: 2000,
      model: 'flash',
      phase: 'implementation',
      operation: 'Code gen',
    });

    costTracker.recordUsage({
      input: 1000,
      output: 500,
      model: 'flash-lite',
      phase: 'verification',
      operation: 'Verify',
    });

    const stats = costTracker.getStatistics();

    // Verify totals
    expect(stats.totalInputTokens).toBe(16000);
    expect(stats.totalOutputTokens).toBe(7500);
    expect(stats.operationCount).toBe(3);

    // Verify model breakdown has cost data
    expect(stats.costByModel['pro'].cost).toBeGreaterThan(0);
    expect(stats.costByModel['flash'].cost).toBeGreaterThan(0);
    expect(stats.costByModel['flash-lite'].cost).toBeGreaterThan(0);

    // Verify average cost
    expect(stats.averageCostPerOperation).toBeGreaterThan(0);
    expect(stats.averageCostPerOperation).toBe(stats.totalCost / 3);
  });

  it('should calculate accurate approval statistics', () => {
    const manager = createApprovalManager();

    // Create and process various approvals
    const r1 = manager.requestApproval('research', 'R1', '', {});
    const r2 = manager.requestApproval('prd', 'R2', '', {});
    const r3 = manager.requestApproval('architecture', 'R3', '', {});
    const r4 = manager.requestApproval('phase', 'R4', '', {});

    manager.approve(r1.id);
    manager.approve(r2.id);
    manager.reject(r3.id, 'Need changes');
    // r4 left pending

    const stats = manager.getStatistics();

    expect(stats.total).toBe(4);
    expect(stats.approved).toBe(2);
    expect(stats.rejected).toBe(1);
    expect(stats.pending).toBe(1);

    // Type breakdown
    expect(stats.byType['research'].count).toBe(1);
    expect(stats.byType['research'].approved).toBe(1);
    expect(stats.byType['architecture'].count).toBe(1);
    expect(stats.byType['architecture'].approved).toBe(0);
  });
});
