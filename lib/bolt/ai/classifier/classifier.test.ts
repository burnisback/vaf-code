/**
 * Classifier Tests
 *
 * Tests for the request complexity classifier.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyRequest,
  detectMegaComplexIndicators,
  isMegaComplex,
  getModeDescription,
  getModeLabel,
  getModeColor,
  getModelForMode,
  modeRequiresPlanning,
  modeRequiresResearch,
} from './index';

describe('classifyRequest', () => {
  describe('Question Mode', () => {
    it('should classify "What is X?" as question', () => {
      const result = classifyRequest('What is React?');
      expect(result.mode).toBe('question');
      expect(result.estimatedFiles).toBe(0);
    });

    it('should classify "How do I X?" as question', () => {
      const result = classifyRequest('How do I use useState in React?');
      expect(result.mode).toBe('question');
    });

    it('should classify "Why does X?" as question', () => {
      const result = classifyRequest('Why does useEffect run twice?');
      expect(result.mode).toBe('question');
    });

    it('should classify "Explain X" as question', () => {
      const result = classifyRequest('Explain the difference between props and state');
      expect(result.mode).toBe('question');
    });

    it('should classify prompts ending with ? as question', () => {
      const result = classifyRequest('The app is slow, any ideas?');
      expect(result.mode).toBe('question');
    });

    it('should NOT classify "How about we build X" as question', () => {
      const result = classifyRequest('How about we build a login form');
      expect(result.mode).not.toBe('question');
    });
  });

  describe('Simple Mode', () => {
    it('should classify single component request as simple', () => {
      const result = classifyRequest('Add a logout button');
      expect(result.mode).toBe('simple');
      expect(result.estimatedFiles).toBeLessThanOrEqual(2);
    });

    it('should classify simple styling request as simple', () => {
      const result = classifyRequest('Change the color of the title');
      expect(result.mode).toBe('simple');
    });

    it('should classify single file edit as simple', () => {
      const result = classifyRequest('Fix the typo in the footer');
      expect(result.mode).toBe('simple');
    });
  });

  describe('Moderate Mode', () => {
    it('should classify form with multiple elements as moderate', () => {
      const result = classifyRequest('Create a contact form component with input fields and a button');
      expect(result.mode).toBe('moderate');
    });

    it('should classify multi-component request as moderate', () => {
      const result = classifyRequest('Add a modal dialog with a form and button components inside');
      expect(result.mode).toBe('moderate');
    });

    it('should classify request with multiple file indicators as moderate', () => {
      const result = classifyRequest('Create a sidebar component with a menu and header');
      expect(result.mode).toBe('moderate');
    });
  });

  describe('Complex Mode', () => {
    it('should classify full application request as complex', () => {
      const result = classifyRequest('Build a complete e-commerce application with product catalog, shopping cart, checkout flow, user authentication, and order management system');
      expect(result.mode).toBe('complex');
    });

    it('should classify dashboard request as complex', () => {
      const result = classifyRequest('Create a full admin dashboard with user management system, analytics components, settings page, and multiple API endpoints');
      expect(result.mode).toBe('complex');
    });

    it('should classify multi-domain request as complex', () => {
      const result = classifyRequest('Build an admin panel with authentication, database models, and API endpoints');
      expect(result.mode).toBe('complex');
      expect(result.domains.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Mega-Complex Mode', () => {
    it('should classify research + build request as mega-complex', () => {
      const result = classifyRequest(
        'Research learning management systems, analyze competitors, and build a complete LMS platform with all features'
      );
      expect(result.mode).toBe('mega-complex');
      expect(result.megaComplexIndicators?.needsResearch).toBe(true);
    });

    it('should classify market research + implementation as mega-complex', () => {
      const result = classifyRequest(
        'Find the best practices for e-commerce platforms, compare competitors, and create a full shopping application'
      );
      expect(result.mode).toBe('mega-complex');
    });

    it('should NOT classify simple research request as mega-complex', () => {
      const result = classifyRequest('Research the best React frameworks');
      expect(result.mode).not.toBe('mega-complex');
    });

    it('should NOT classify simple build request as mega-complex', () => {
      const result = classifyRequest('Build a login page');
      expect(result.mode).not.toBe('mega-complex');
    });
  });

  describe('Domain Detection', () => {
    it('should detect frontend domain', () => {
      const result = classifyRequest('Create a React component');
      expect(result.domains).toContain('frontend');
    });

    it('should detect backend domain', () => {
      const result = classifyRequest('Create an API endpoint');
      expect(result.domains).toContain('backend');
    });

    it('should detect database domain', () => {
      const result = classifyRequest('Create a Prisma schema');
      expect(result.domains).toContain('database');
    });

    it('should detect auth domain', () => {
      const result = classifyRequest('Implement login functionality');
      expect(result.domains).toContain('auth');
    });

    it('should detect multiple domains', () => {
      const result = classifyRequest('Create a login page with JWT authentication and database storage');
      expect(result.domains.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Keyword Detection', () => {
    it('should detect file indicator keywords', () => {
      const result = classifyRequest('Create a button component and a modal');
      expect(result.detectedKeywords).toContain('button');
      expect(result.detectedKeywords).toContain('component');
      expect(result.detectedKeywords).toContain('modal');
    });
  });

  describe('Confidence Scores', () => {
    it('should have high confidence for questions', () => {
      const result = classifyRequest('What is React?');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should have moderate confidence for complex tasks', () => {
      const result = classifyRequest('Build a full application');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });
});

describe('detectMegaComplexIndicators', () => {
  it('should detect research keywords', () => {
    const indicators = detectMegaComplexIndicators('research competitors and analyze the market');
    expect(indicators.needsResearch).toBe(true);
    expect(indicators.researchKeywords).toContain('research');
    expect(indicators.researchKeywords).toContain('analyze');
  });

  it('should detect product keywords', () => {
    const indicators = detectMegaComplexIndicators('build a complete platform');
    expect(indicators.productKeywords).toContain('platform');
  });

  it('should detect scale keywords', () => {
    const indicators = detectMegaComplexIndicators('create a comprehensive enterprise solution');
    expect(indicators.scaleIndicators).toContain('comprehensive');
    expect(indicators.scaleIndicators).toContain('enterprise');
  });
});

describe('isMegaComplex', () => {
  it('should return true for full mega-complex indicators', () => {
    const indicators = {
      needsResearch: true,
      needsProductDefinition: true,
      needsArchitecture: true,
      hasMultiplePhases: true,
      researchKeywords: ['research'],
      productKeywords: ['platform'],
      scaleIndicators: ['complete'],
    };
    expect(isMegaComplex(indicators)).toBe(true);
  });

  it('should return false for partial indicators', () => {
    const indicators = {
      needsResearch: true,
      needsProductDefinition: false,
      needsArchitecture: false,
      hasMultiplePhases: false,
      researchKeywords: ['research'],
      productKeywords: [],
      scaleIndicators: [],
    };
    expect(isMegaComplex(indicators)).toBe(false);
  });
});

describe('Utility Functions', () => {
  describe('getModeDescription', () => {
    it('should return correct descriptions', () => {
      expect(getModeDescription('question')).toContain('Direct answer');
      expect(getModeDescription('simple')).toContain('Quick');
      expect(getModeDescription('moderate')).toContain('Standard');
      expect(getModeDescription('complex')).toContain('Planned');
      expect(getModeDescription('mega-complex')).toContain('pipeline');
    });
  });

  describe('getModeLabel', () => {
    it('should return short labels', () => {
      expect(getModeLabel('question')).toBe('Question');
      expect(getModeLabel('simple')).toBe('Simple');
      expect(getModeLabel('moderate')).toBe('Moderate');
      expect(getModeLabel('complex')).toBe('Complex');
      expect(getModeLabel('mega-complex')).toBe('Mega');
    });
  });

  describe('getModeColor', () => {
    it('should return colors', () => {
      expect(getModeColor('question')).toBe('blue');
      expect(getModeColor('simple')).toBe('green');
      expect(getModeColor('moderate')).toBe('yellow');
      expect(getModeColor('complex')).toBe('orange');
      expect(getModeColor('mega-complex')).toBe('purple');
    });
  });

  describe('getModelForMode', () => {
    it('should return flash for simple modes', () => {
      expect(getModelForMode('question')).toBe('flash');
      expect(getModelForMode('simple')).toBe('flash');
      expect(getModelForMode('moderate')).toBe('flash');
    });

    it('should return pro for complex modes', () => {
      expect(getModelForMode('complex')).toBe('pro');
      expect(getModelForMode('mega-complex')).toBe('pro');
    });
  });

  describe('modeRequiresPlanning', () => {
    it('should return true for complex modes', () => {
      expect(modeRequiresPlanning('complex')).toBe(true);
      expect(modeRequiresPlanning('mega-complex')).toBe(true);
    });

    it('should return false for simple modes', () => {
      expect(modeRequiresPlanning('question')).toBe(false);
      expect(modeRequiresPlanning('simple')).toBe(false);
      expect(modeRequiresPlanning('moderate')).toBe(false);
    });
  });

  describe('modeRequiresResearch', () => {
    it('should return true only for mega-complex', () => {
      expect(modeRequiresResearch('mega-complex')).toBe(true);
    });

    it('should return false for other modes', () => {
      expect(modeRequiresResearch('question')).toBe(false);
      expect(modeRequiresResearch('simple')).toBe(false);
      expect(modeRequiresResearch('moderate')).toBe(false);
      expect(modeRequiresResearch('complex')).toBe(false);
    });
  });
});
