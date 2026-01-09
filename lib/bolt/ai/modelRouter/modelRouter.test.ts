/**
 * Model Router Tests
 *
 * Comprehensive test suite for smart model routing.
 */

import { describe, it, expect } from 'vitest';
import {
  selectModel,
  estimateCost,
  estimateCostForMode,
  createSessionTokens,
  recordTokenUsage,
  calculateSessionCost,
  formatSelectionLog,
  type SelectionContext,
  type ModelTier,
} from './index';

describe('Model Router', () => {
  // ==========================================================================
  // MODEL SELECTION TESTS
  // ==========================================================================

  describe('selectModel', () => {
    describe('classify phase', () => {
      it('should always return flash-lite for classify phase', () => {
        const modes = ['question', 'simple', 'moderate', 'complex', 'mega-complex'] as const;

        for (const mode of modes) {
          const context: SelectionContext = { phase: 'classify', mode };
          const result = selectModel(context);

          expect(result.tier).toBe('flash-lite');
          expect(result.reason).toContain('Flash-Lite');
        }
      });

      it('should return flash-lite even with high complexity score', () => {
        const context: SelectionContext = {
          phase: 'classify',
          mode: 'complex',
          complexityScore: 20,
        };
        const result = selectModel(context);

        expect(result.tier).toBe('flash-lite');
      });
    });

    describe('verify phase', () => {
      it('should always return flash-lite for verify phase', () => {
        const modes = ['question', 'simple', 'moderate', 'complex', 'mega-complex'] as const;

        for (const mode of modes) {
          const context: SelectionContext = { phase: 'verify', mode };
          const result = selectModel(context);

          expect(result.tier).toBe('flash-lite');
          expect(result.reason).toContain('Flash-Lite');
        }
      });
    });

    describe('investigate phase', () => {
      it('should return flash-lite for question mode', () => {
        const context: SelectionContext = { phase: 'investigate', mode: 'question' };
        const result = selectModel(context);

        expect(result.tier).toBe('flash-lite');
      });

      it('should return flash-lite for simple mode', () => {
        const context: SelectionContext = { phase: 'investigate', mode: 'simple' };
        const result = selectModel(context);

        expect(result.tier).toBe('flash-lite');
      });

      it('should return flash-lite for moderate mode with low complexity', () => {
        const context: SelectionContext = {
          phase: 'investigate',
          mode: 'moderate',
          complexityScore: 5,
        };
        const result = selectModel(context);

        expect(result.tier).toBe('flash-lite');
      });

      it('should upgrade to flash for complex mode with high complexity', () => {
        const context: SelectionContext = {
          phase: 'investigate',
          mode: 'complex',
          complexityScore: 12,
        };
        const result = selectModel(context);

        expect(result.tier).toBe('flash');
      });

      it('should return flash for mega-complex mode', () => {
        const context: SelectionContext = { phase: 'investigate', mode: 'mega-complex' };
        const result = selectModel(context);

        expect(result.tier).toBe('flash');
      });
    });

    describe('plan phase', () => {
      it('should return flash for simple mode', () => {
        const context: SelectionContext = { phase: 'plan', mode: 'simple' };
        const result = selectModel(context);

        expect(result.tier).toBe('flash');
      });

      it('should return flash for moderate mode', () => {
        const context: SelectionContext = { phase: 'plan', mode: 'moderate' };
        const result = selectModel(context);

        expect(result.tier).toBe('flash');
      });

      it('should return flash for complex mode with moderate complexity', () => {
        const context: SelectionContext = {
          phase: 'plan',
          mode: 'complex',
          complexityScore: 12,
        };
        const result = selectModel(context);

        expect(result.tier).toBe('flash');
      });

      it('should upgrade to pro for complex mode with high complexity', () => {
        const context: SelectionContext = {
          phase: 'plan',
          mode: 'complex',
          complexityScore: 16,
        };
        const result = selectModel(context);

        expect(result.tier).toBe('pro');
      });

      it('should return flash for mega-complex planning', () => {
        const context: SelectionContext = { phase: 'plan', mode: 'mega-complex' };
        const result = selectModel(context);

        expect(result.tier).toBe('flash');
      });
    });

    describe('execute phase', () => {
      it('should return flash for all modes', () => {
        const modes = ['simple', 'moderate', 'complex', 'mega-complex'] as const;

        for (const mode of modes) {
          const context: SelectionContext = { phase: 'execute', mode };
          const result = selectModel(context);

          expect(result.tier).toBe('flash');
        }
      });

      it('should not upgrade even with high complexity', () => {
        const context: SelectionContext = {
          phase: 'execute',
          mode: 'complex',
          complexityScore: 20,
        };
        const result = selectModel(context);

        expect(result.tier).toBe('flash');
      });
    });

    describe('prd phase', () => {
      it('should return pro for mega-complex mode', () => {
        const context: SelectionContext = { phase: 'prd', mode: 'mega-complex' };
        const result = selectModel(context);

        expect(result.tier).toBe('pro');
      });
    });

    describe('architecture phase', () => {
      it('should return pro for mega-complex mode', () => {
        const context: SelectionContext = { phase: 'architecture', mode: 'mega-complex' };
        const result = selectModel(context);

        expect(result.tier).toBe('pro');
      });

      it('should return pro for complex mode', () => {
        const context: SelectionContext = { phase: 'architecture', mode: 'complex' };
        const result = selectModel(context);

        expect(result.tier).toBe('pro');
      });
    });

    describe('research phase', () => {
      it('should return flash for mega-complex mode', () => {
        const context: SelectionContext = { phase: 'research', mode: 'mega-complex' };
        const result = selectModel(context);

        expect(result.tier).toBe('flash');
      });
    });

    describe('retry handling', () => {
      it('should upgrade flash-lite to flash on retry', () => {
        const context: SelectionContext = {
          phase: 'investigate',
          mode: 'simple',
          isRetry: true,
        };
        const result = selectModel(context);

        expect(result.tier).toBe('flash');
        expect(result.reason).toContain('Retry');
      });

      it('should not upgrade classify phase even on retry', () => {
        const context: SelectionContext = {
          phase: 'classify',
          mode: 'simple',
          isRetry: true,
        };
        const result = selectModel(context);

        // Classify phase logic runs after retry check, so it stays flash-lite
        expect(result.tier).toBe('flash-lite');
      });
    });

    describe('question mode', () => {
      it('should return flash-lite for all phases in question mode', () => {
        const phases = ['investigate', 'plan', 'execute'] as const;

        for (const phase of phases) {
          const context: SelectionContext = { phase, mode: 'question' };
          const result = selectModel(context);

          expect(result.tier).toBe('flash-lite');
        }
      });
    });
  });

  // ==========================================================================
  // COST ESTIMATION TESTS
  // ==========================================================================

  describe('estimateCost', () => {
    it('should calculate flash-lite cost correctly', () => {
      const result = estimateCost('flash-lite', 1_000_000, 1_000_000);

      expect(result.estimatedCost).toBeCloseTo(0.10 + 0.40); // $0.50
      expect(result.tier).toBe('flash-lite');
    });

    it('should calculate flash cost correctly', () => {
      const result = estimateCost('flash', 1_000_000, 1_000_000);

      expect(result.estimatedCost).toBeCloseTo(0.30 + 2.50); // $2.80
      expect(result.tier).toBe('flash');
    });

    it('should calculate pro cost correctly', () => {
      const result = estimateCost('pro', 1_000_000, 1_000_000);

      expect(result.estimatedCost).toBeCloseTo(1.25 + 10.00); // $11.25
      expect(result.tier).toBe('pro');
    });

    it('should handle smaller token counts', () => {
      const result = estimateCost('flash', 10_000, 5_000);

      // (10000/1M) * 0.30 + (5000/1M) * 2.50 = 0.003 + 0.0125 = 0.0155
      expect(result.estimatedCost).toBeCloseTo(0.0155);
    });
  });

  describe('estimateCostForMode', () => {
    it('should estimate question mode cost', () => {
      const result = estimateCostForMode('question');

      expect(result.tier).toBe('flash-lite');
      expect(result.inputTokens).toBe(3000);
      expect(result.outputTokens).toBe(2000);
    });

    it('should estimate simple mode cost', () => {
      const result = estimateCostForMode('simple');

      expect(result.tier).toBe('flash');
      expect(result.inputTokens).toBe(15000);
      expect(result.outputTokens).toBe(5000);
    });

    it('should estimate mega-complex mode cost', () => {
      const result = estimateCostForMode('mega-complex');

      expect(result.tier).toBe('flash');
      expect(result.inputTokens).toBe(800000);
      expect(result.outputTokens).toBe(200000);
    });
  });

  // ==========================================================================
  // TOKEN TRACKING TESTS
  // ==========================================================================

  describe('createSessionTokens', () => {
    it('should create empty session', () => {
      const session = createSessionTokens();

      expect(session.records).toHaveLength(0);
      expect(session.total.input).toBe(0);
      expect(session.total.output).toBe(0);
      expect(session.byTier['flash-lite'].input).toBe(0);
    });
  });

  describe('recordTokenUsage', () => {
    it('should record tokens correctly', () => {
      let session = createSessionTokens();

      session = recordTokenUsage(session, 'classify', 'flash-lite', {
        input: 1000,
        output: 500,
      });

      expect(session.records).toHaveLength(1);
      expect(session.total.input).toBe(1000);
      expect(session.total.output).toBe(500);
      expect(session.byTier['flash-lite'].input).toBe(1000);
    });

    it('should accumulate multiple records', () => {
      let session = createSessionTokens();

      session = recordTokenUsage(session, 'classify', 'flash-lite', {
        input: 1000,
        output: 500,
      });

      session = recordTokenUsage(session, 'execute', 'flash', {
        input: 5000,
        output: 2000,
      });

      expect(session.records).toHaveLength(2);
      expect(session.total.input).toBe(6000);
      expect(session.total.output).toBe(2500);
      expect(session.byTier['flash-lite'].input).toBe(1000);
      expect(session.byTier['flash'].input).toBe(5000);
    });

    it('should preserve immutability', () => {
      const session1 = createSessionTokens();
      const session2 = recordTokenUsage(session1, 'classify', 'flash-lite', {
        input: 1000,
        output: 500,
      });

      expect(session1.records).toHaveLength(0);
      expect(session2.records).toHaveLength(1);
    });
  });

  describe('calculateSessionCost', () => {
    it('should calculate cost from tokens', () => {
      let session = createSessionTokens();

      session = recordTokenUsage(session, 'classify', 'flash-lite', {
        input: 100_000,
        output: 50_000,
      });

      session = recordTokenUsage(session, 'execute', 'flash', {
        input: 200_000,
        output: 100_000,
      });

      const cost = calculateSessionCost(session);

      // Flash-lite: (100000/1M)*0.10 + (50000/1M)*0.40 = 0.01 + 0.02 = 0.03
      expect(cost.byTier['flash-lite']).toBeCloseTo(0.03);

      // Flash: (200000/1M)*0.30 + (100000/1M)*2.50 = 0.06 + 0.25 = 0.31
      expect(cost.byTier['flash']).toBeCloseTo(0.31);

      expect(cost.total).toBeCloseTo(0.34);
    });

    it('should calculate savings vs single-model', () => {
      let session = createSessionTokens();

      // Use flash-lite for 100k tokens where flash would cost more
      session = recordTokenUsage(session, 'classify', 'flash-lite', {
        input: 100_000,
        output: 50_000,
      });

      const cost = calculateSessionCost(session);

      expect(cost.savings).toBeDefined();
      expect(cost.savings!.savingsPercent).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // LOGGING TESTS
  // ==========================================================================

  describe('formatSelectionLog', () => {
    it('should format selection log correctly', () => {
      const context: SelectionContext = {
        phase: 'execute',
        mode: 'moderate',
        complexityScore: 6,
      };
      const selection = selectModel(context);
      const log = formatSelectionLog(context, selection);

      expect(log).toContain('[ModelRouter]');
      expect(log).toContain('execute/moderate');
      expect(log).toContain('complexity: 6');
      expect(log).toContain('FLASH');
    });

    it('should handle missing complexity score', () => {
      const context: SelectionContext = {
        phase: 'classify',
        mode: 'simple',
      };
      const selection = selectModel(context);
      const log = formatSelectionLog(context, selection);

      expect(log).not.toContain('complexity:');
    });
  });
});
