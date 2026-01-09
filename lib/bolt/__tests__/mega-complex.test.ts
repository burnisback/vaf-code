/**
 * Mega-Complex Integration Tests
 *
 * End-to-end tests for mega-complex classification, orchestration,
 * and state machine behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyRequest,
  detectMegaComplexIndicators,
  isMegaComplex,
} from '../ai/classifier';
import { createOrchestrator } from '../orchestration/machine';
import type { MegaComplexIndicators } from '../ai/classifier/types';

// =============================================================================
// MEGA-COMPLEX CLASSIFICATION TESTS
// =============================================================================

describe('Mega-Complex Classification', () => {
  describe('detectMegaComplexIndicators', () => {
    it('should detect research keywords', () => {
      const indicators = detectMegaComplexIndicators(
        'Research competitors and analyze the market trends'
      );

      expect(indicators.needsResearch).toBe(true);
      expect(indicators.researchKeywords).toContain('research');
      expect(indicators.researchKeywords).toContain('analyze');
    });

    it('should detect product keywords', () => {
      const indicators = detectMegaComplexIndicators(
        'Build a complete platform for e-commerce'
      );

      expect(indicators.productKeywords).toContain('platform');
    });

    it('should detect scale indicators', () => {
      const indicators = detectMegaComplexIndicators(
        'Create a comprehensive enterprise solution'
      );

      expect(indicators.scaleIndicators).toContain('comprehensive');
      expect(indicators.scaleIndicators).toContain('enterprise');
    });

    it('should detect implementation intent with product keywords', () => {
      const indicators = detectMegaComplexIndicators(
        'Build a SaaS platform'
      );

      expect(indicators.needsProductDefinition).toBe(true);
      expect(indicators.productKeywords).toContain('platform');
    });
  });

  describe('isMegaComplex', () => {
    it('should return true for full mega-complex scenario', () => {
      const indicators: MegaComplexIndicators = {
        needsResearch: true,
        needsProductDefinition: true,
        needsArchitecture: true,
        hasMultiplePhases: true,
        researchKeywords: ['research', 'analyze'],
        productKeywords: ['platform', 'application'],
        scaleIndicators: ['complete', 'enterprise'],
      };

      expect(isMegaComplex(indicators)).toBe(true);
    });

    it('should return false when research is missing', () => {
      const indicators: MegaComplexIndicators = {
        needsResearch: false,
        needsProductDefinition: true,
        needsArchitecture: true,
        hasMultiplePhases: true,
        researchKeywords: [],
        productKeywords: ['platform'],
        scaleIndicators: ['complete'],
      };

      expect(isMegaComplex(indicators)).toBe(false);
    });

    it('should return false when product definition is missing', () => {
      const indicators: MegaComplexIndicators = {
        needsResearch: true,
        needsProductDefinition: false,
        needsArchitecture: true,
        hasMultiplePhases: true,
        researchKeywords: ['research'],
        productKeywords: [],
        scaleIndicators: ['complete'],
      };

      expect(isMegaComplex(indicators)).toBe(false);
    });

    it('should return false when architecture/phases are missing', () => {
      const indicators: MegaComplexIndicators = {
        needsResearch: true,
        needsProductDefinition: true,
        needsArchitecture: false,
        hasMultiplePhases: false,
        researchKeywords: ['research'],
        productKeywords: ['platform'],
        scaleIndicators: [],
      };

      expect(isMegaComplex(indicators)).toBe(false);
    });
  });

  describe('classifyRequest', () => {
    it('should classify mega-complex prompts correctly', () => {
      const result = classifyRequest(
        'Research learning management systems and build a complete LMS platform'
      );

      expect(result.mode).toBe('mega-complex');
      expect(result.megaComplexIndicators).toBeDefined();
      expect(result.megaComplexIndicators?.needsResearch).toBe(true);
      expect(result.megaComplexIndicators?.needsProductDefinition).toBe(true);
    });

    it('should NOT classify simple research as mega-complex', () => {
      const result = classifyRequest('Research the best React frameworks');

      expect(result.mode).not.toBe('mega-complex');
    });

    it('should NOT classify simple build as mega-complex', () => {
      const result = classifyRequest('Build a login form');

      expect(result.mode).not.toBe('mega-complex');
    });

    it('should NOT classify questions as mega-complex', () => {
      // Note: "What is the best way to build X" is classified as simple/moderate
      // because it contains "build" (implementation keyword). Use a pure question.
      const result = classifyRequest('What are the benefits of using React?');

      expect(result.mode).toBe('question');
    });

    it('should detect mega-complex with competitor analysis', () => {
      const result = classifyRequest(
        'Research CRM systems, compare competitors like Salesforce and HubSpot, and build a complete CRM platform'
      );

      expect(result.mode).toBe('mega-complex');
      expect(result.megaComplexIndicators?.researchKeywords).toContain('research');
      expect(result.megaComplexIndicators?.researchKeywords).toContain('compare');
      expect(result.megaComplexIndicators?.researchKeywords).toContain('competitors');
    });
  });
});

// =============================================================================
// ORCHESTRATION STATE MACHINE TESTS
// =============================================================================

describe('Orchestration State Machine', () => {
  describe('State Transitions', () => {
    it('should start in idle state', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      expect(orchestrator.state).toBe('idle');
    });

    it('should transition to researching on START_RESEARCH', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });

      expect(orchestrator.state).toBe('researching');
    });

    it('should transition to awaiting-approval after research completes', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 'sess_1' } });

      expect(orchestrator.state).toBe('awaiting-approval');
      expect(orchestrator.context.researchSessionId).toBe('sess_1');
    });

    it('should transition to defining-product after research approval', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 'sess_1' } });
      orchestrator.send({ type: 'USER_APPROVE' });

      expect(orchestrator.state).toBe('defining-product');
    });

    it('should transition through full flow', () => {
      const states: string[] = [];
      const orchestrator = createOrchestrator(
        { originalPrompt: 'Test' },
        {
          onStateChange: (from, to) => {
            states.push(to);
          },
        }
      );

      // Research
      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 's1' } });
      orchestrator.send({ type: 'USER_APPROVE' });

      // PRD
      orchestrator.send({ type: 'PRODUCT_DEFINED', payload: { prdId: 'prd1' } });
      orchestrator.send({ type: 'USER_APPROVE' });

      // Architecture
      orchestrator.send({ type: 'ARCHITECTURE_COMPLETE', payload: { archId: 'arch1' } });
      orchestrator.send({ type: 'USER_APPROVE' });

      expect(states).toContain('researching');
      expect(states).toContain('defining-product');
      expect(states).toContain('generating-architecture');
      expect(states).toContain('planning-phase');
      expect(orchestrator.context.researchSessionId).toBe('s1');
      expect(orchestrator.context.prdId).toBe('prd1');
      expect(orchestrator.context.architectureId).toBe('arch1');
    });
  });

  describe('Pause/Resume', () => {
    it('should handle pause correctly', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      expect(orchestrator.state).toBe('researching');

      orchestrator.send({ type: 'USER_PAUSE' });
      expect(orchestrator.state).toBe('paused');
    });

    it('should resume to previous state', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'USER_PAUSE' });
      orchestrator.send({ type: 'USER_RESUME' });

      expect(orchestrator.state).toBe('researching');
    });
  });

  describe('Abort', () => {
    it('should handle abort correctly', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'USER_ABORT' });

      expect(orchestrator.state).toBe('idle');
    });
  });

  describe('Checkpoints', () => {
    it('should save and restore checkpoints', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 's1' } });

      const checkpoint = orchestrator.saveCheckpoint('user-pause');
      expect(checkpoint.state).toBe('awaiting-approval');
      expect(checkpoint.context.researchSessionId).toBe('s1');

      orchestrator.send({ type: 'USER_APPROVE' });
      expect(orchestrator.state).toBe('defining-product');

      const restored = orchestrator.restoreCheckpoint(checkpoint.id);
      expect(restored).toBe(true);
      expect(orchestrator.state).toBe('awaiting-approval');
    });

    it('should return false for invalid checkpoint', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      const restored = orchestrator.restoreCheckpoint('invalid-id');
      expect(restored).toBe(false);
    });
  });

  describe('Progress', () => {
    it('should calculate progress correctly', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      const progress1 = orchestrator.getProgress();
      expect(progress1.percentage).toBeLessThan(100);
      expect(progress1.percentage).toBeGreaterThanOrEqual(0);

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 's1' } });

      const progress2 = orchestrator.getProgress();
      // After research complete, we're in awaiting-approval
      // The stage details should reflect current state
      expect(progress2.stageDetails).toBeDefined();
      expect(progress2.percentage).toBeLessThan(100);

      // Move to next phase to have completed stages
      orchestrator.send({ type: 'USER_APPROVE' });
      orchestrator.send({ type: 'PRODUCT_DEFINED', payload: { prdId: 'prd1' } });

      const progress3 = orchestrator.getProgress();
      expect(progress3.completedStages.length).toBeGreaterThan(0);
      expect(progress3.completedStages).toContain('Research');
      expect(progress3.percentage).toBeGreaterThan(progress1.percentage);
    });
  });

  describe('Callbacks', () => {
    it('should call onStateChange callback', () => {
      const onStateChange = vi.fn();
      const orchestrator = createOrchestrator(
        { originalPrompt: 'Test' },
        { onStateChange }
      );

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });

      expect(onStateChange).toHaveBeenCalledWith('idle', 'researching', expect.any(Object));
    });

    it('should call onResearchComplete callback', () => {
      const onResearchComplete = vi.fn();
      const orchestrator = createOrchestrator(
        { originalPrompt: 'Test' },
        { onResearchComplete }
      );

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 's1' } });

      expect(onResearchComplete).toHaveBeenCalledWith('s1');
    });

    it('should call onApprovalNeeded callback', () => {
      const onApprovalNeeded = vi.fn();
      const orchestrator = createOrchestrator(
        { originalPrompt: 'Test' },
        { onApprovalNeeded }
      );

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'RESEARCH_COMPLETE', payload: { sessionId: 's1' } });

      expect(onApprovalNeeded).toHaveBeenCalledWith('research');
    });

    it('should call onError callback', () => {
      const onError = vi.fn();
      const orchestrator = createOrchestrator(
        { originalPrompt: 'Test' },
        { onError }
      );

      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      orchestrator.send({ type: 'ERROR', payload: { message: 'Test error' } });

      expect(onError).toHaveBeenCalledWith('Test error');
    });
  });

  describe('Available Actions', () => {
    it('should return correct available actions for each state', () => {
      const orchestrator = createOrchestrator({ originalPrompt: 'Test' });

      // Idle state
      const idleActions = orchestrator.getAvailableActions();
      expect(idleActions).toContain('START_RESEARCH');

      // Researching state
      orchestrator.send({ type: 'START_RESEARCH', payload: { prompt: 'Test' } });
      const researchingActions = orchestrator.getAvailableActions();
      expect(researchingActions).toContain('RESEARCH_COMPLETE');
      expect(researchingActions).toContain('USER_PAUSE');
      expect(researchingActions).toContain('USER_ABORT');
    });
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  it('should handle empty prompt', () => {
    const result = classifyRequest('');
    expect(result.mode).toBe('simple');
  });

  it('should handle very long prompts', () => {
    const longPrompt = 'Research and build '.repeat(100) + 'a complete platform';
    const result = classifyRequest(longPrompt);
    // Should still classify reasonably
    expect(['complex', 'mega-complex']).toContain(result.mode);
  });

  it('should handle mixed case', () => {
    const result = classifyRequest(
      'RESEARCH Learning Management Systems and BUILD a Complete Platform'
    );
    expect(result.mode).toBe('mega-complex');
  });

  it('should handle prompts with special characters', () => {
    const result = classifyRequest(
      'Research e-commerce & build a complete SaaS platform (end-to-end)!'
    );
    // Should handle without errors
    expect(result.mode).toBeDefined();
  });
});
