/**
 * PRD Generator (Server-Side Only)
 *
 * Generates comprehensive Product Requirements Documents from research analysis.
 * ONLY import this file in server-side code (API routes).
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import type { ResearchSynthesis } from '../research/types';
import type {
  ProductRequirementsDocument,
  ResearchAnalysis,
  PRDGenerationRequest,
  PRDGenerationResult,
  FeatureSpecification,
  FeatureCategory,
} from './types';
import { analyzeResearch } from './analyzer';
import { getDocumentStore } from '../documents/store';

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const PRD_GENERATION_PROMPT = `You are a senior product manager creating a Product Requirements Document.

Based on research analysis, create a comprehensive PRD that will guide engineering teams.

<rules>
1. Be specific and actionable - avoid vague requirements
2. Prioritize features using MoSCoW (Must, Should, Could, Won't)
3. Include clear acceptance criteria for each feature
4. Write user stories in standard format
5. Consider MVP scope vs future releases
6. Address non-functional requirements
7. Define measurable success metrics
</rules>

<output_format>
Return JSON PRD:
\`\`\`json
{
  "name": "Product Name",
  "tagline": "One-line description",
  "summary": "Executive summary paragraph",
  "problem": {
    "statement": "The core problem",
    "currentSolutions": ["existing solution 1"],
    "painPoints": ["pain point 1"],
    "marketGap": "The opportunity"
  },
  "audience": [
    {
      "name": "Segment name",
      "description": "Description",
      "characteristics": ["characteristic 1"],
      "needs": ["need 1"],
      "value": "How product helps"
    }
  ],
  "goals": [
    {
      "id": "goal_1",
      "description": "Goal description",
      "type": "business|user|technical",
      "priority": "critical|high|medium|low",
      "successCriteria": ["criteria 1"],
      "timeframe": "mvp|v1|v2|future"
    }
  ],
  "features": [
    {
      "id": "feature_1",
      "name": "Feature name",
      "description": "Detailed description",
      "benefit": "User-facing benefit",
      "category": "core|user-management|content|collaboration|analytics|integration|admin|monetization|other",
      "priority": "must|should|could|wont",
      "complexity": 1-5,
      "userStories": [
        {
          "id": "story_1",
          "role": "user type",
          "action": "what they want to do",
          "benefit": "why they want it"
        }
      ],
      "acceptanceCriteria": ["criterion 1"],
      "dependencies": ["feature_id"],
      "technicalNotes": "optional technical considerations",
      "releaseTarget": "mvp|v1|v2|future"
    }
  ],
  "nonFunctional": {
    "performance": {
      "pageLoadTime": "< 3s",
      "apiResponseTime": "< 500ms",
      "concurrentUsers": "1000+",
      "other": []
    },
    "security": {
      "authentication": ["JWT", "OAuth"],
      "authorization": ["RBAC"],
      "dataProtection": ["encryption at rest"],
      "compliance": ["GDPR"]
    },
    "accessibility": {
      "wcagLevel": "AA",
      "requirements": ["keyboard navigation"]
    },
    "scalability": {
      "userGrowth": "10x in year 1",
      "dataGrowth": "100GB/month",
      "considerations": []
    },
    "reliability": {
      "uptime": "99.9%",
      "backupStrategy": "daily",
      "recoveryTime": "< 1 hour"
    },
    "usability": {
      "targetDevices": ["desktop", "mobile"],
      "browsers": ["Chrome", "Firefox", "Safari"],
      "languages": ["English"],
      "uxPrinciples": ["intuitive", "consistent"]
    }
  },
  "metrics": [
    {
      "name": "Metric name",
      "description": "What it measures",
      "target": "Target value",
      "measurement": "How measured",
      "priority": "primary|secondary"
    }
  ],
  "constraints": [
    {
      "type": "technical|business|legal|time|budget",
      "description": "Constraint description",
      "impact": "How it affects product",
      "mitigation": "How to address it"
    }
  ],
  "openQuestions": ["Question 1"]
}
\`\`\`
</output_format>`;

// =============================================================================
// GENERATOR FUNCTION
// =============================================================================

/**
 * Generate a PRD from research
 * NOTE: This function uses genkit and must only be called from server-side code
 */
export async function generatePRD(
  request: PRDGenerationRequest
): Promise<PRDGenerationResult> {
  try {
    // Get research data
    let synthesis: ResearchSynthesis | null = null;

    if (request.researchId) {
      const store = getDocumentStore();
      const doc = await store.get(request.researchId);
      if (doc?.structuredData) {
        synthesis = doc.structuredData as unknown as ResearchSynthesis;
      }
    } else if (request.researchData) {
      synthesis = request.researchData as unknown as ResearchSynthesis;
    }

    if (!synthesis) {
      return {
        success: false,
        error: 'No research data provided or found',
      };
    }

    // Analyze research
    const analysis = await analyzeResearch(synthesis, {
      productType: request.focusAreas?.join(', '),
    });

    // Build PRD generation prompt
    const prompt = buildPRDPrompt(synthesis, analysis, request);

    // Generate PRD
    const response = await ai.generate({
      model: MODELS.PRO,
      system: PRD_GENERATION_PROMPT,
      prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    // Parse response
    const prd = parsePRDResponse(response.text, request.productName);

    // Add metadata
    prd.researchRefs = request.researchId ? [request.researchId] : [];

    return {
      success: true,
      prd,
      analysis,
      suggestions: generateSuggestions(prd),
    };
  } catch (error) {
    console.error('[generator] Error generating PRD:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PRD generation failed',
    };
  }
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildPRDPrompt(
  synthesis: ResearchSynthesis,
  analysis: ResearchAnalysis,
  request: PRDGenerationRequest
): string {
  const parts: string[] = [];

  parts.push('<research_summary>');
  parts.push(synthesis.summary);
  parts.push('</research_summary>');

  parts.push('<analysis>');
  parts.push('Key Insights:');
  for (const insight of analysis.insights) {
    parts.push(`- ${insight}`);
  }
  parts.push('');
  parts.push('User Needs:');
  for (const need of analysis.userNeeds) {
    parts.push(`- [${need.importance}] ${need.need}`);
  }
  parts.push('');
  parts.push('Market Gaps:');
  for (const gap of analysis.gaps) {
    parts.push(`- ${gap}`);
  }
  parts.push('');
  parts.push('Differentiators:');
  for (const diff of analysis.differentiators) {
    parts.push(`- ${diff}`);
  }
  parts.push('');
  parts.push('Feature Priorities:');
  for (const fp of analysis.featurePriorities) {
    parts.push(`- [${fp.priority}] ${fp.feature}: ${fp.rationale}`);
  }
  parts.push('</analysis>');

  if (synthesis.competitors && synthesis.competitors.length > 0) {
    parts.push('<competitor_landscape>');
    for (const c of synthesis.competitors) {
      parts.push(`${c.name}: ${c.features.join(', ')}`);
    }
    parts.push('</competitor_landscape>');
  }

  if (request.productName) {
    parts.push(`<product_name>${request.productName}</product_name>`);
  }

  if (request.additionalContext) {
    parts.push(`<additional_context>${request.additionalContext}</additional_context>`);
  }

  if (request.focusAreas && request.focusAreas.length > 0) {
    parts.push(`<focus_areas>${request.focusAreas.join(', ')}</focus_areas>`);
  }

  parts.push('<instructions>');
  parts.push('Generate a comprehensive PRD based on this research and analysis.');
  parts.push('');
  parts.push('Ensure the PRD:');
  parts.push('1. Addresses identified user needs');
  parts.push('2. Differentiates from competitors');
  parts.push('3. Has clear MVP scope (must-have features)');
  parts.push('4. Includes measurable success metrics');
  parts.push('5. Has realistic technical requirements');
  parts.push('</instructions>');

  return parts.join('\n');
}

// =============================================================================
// RESPONSE PARSER
// =============================================================================

function parsePRDResponse(
  responseText: string,
  suggestedName?: string
): ProductRequirementsDocument {
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1] : responseText;

  const jsonStart = jsonText.indexOf('{');
  const jsonEnd = jsonText.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON found in PRD response');
  }

  const cleanJson = jsonText.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(cleanJson);

  // Build PRD with defaults
  const prd: ProductRequirementsDocument = {
    id: `prd_${Date.now()}`,
    name: parsed.name || suggestedName || 'New Product',
    tagline: parsed.tagline || '',
    summary: parsed.summary || '',
    problem: {
      statement: parsed.problem?.statement || '',
      currentSolutions: parsed.problem?.currentSolutions || [],
      painPoints: parsed.problem?.painPoints || [],
      marketGap: parsed.problem?.marketGap || '',
    },
    audience: (parsed.audience || []).map((a: Record<string, unknown>) => ({
      name: String(a.name || 'User'),
      description: String(a.description || ''),
      characteristics: Array.isArray(a.characteristics) ? a.characteristics.map(String) : [],
      needs: Array.isArray(a.needs) ? a.needs.map(String) : [],
      value: String(a.value || ''),
    })),
    goals: (parsed.goals || []).map((g: Record<string, unknown>, i: number) => ({
      id: String(g.id || `goal_${i + 1}`),
      description: String(g.description || ''),
      type: (g.type as 'business' | 'user' | 'technical') || 'business',
      priority: (g.priority as 'critical' | 'high' | 'medium' | 'low') || 'medium',
      successCriteria: Array.isArray(g.successCriteria) ? g.successCriteria.map(String) : [],
      timeframe: g.timeframe as 'mvp' | 'v1' | 'v2' | 'future' | undefined,
    })),
    features: (parsed.features || []).map((f: Record<string, unknown>, i: number): FeatureSpecification => ({
      id: String(f.id || `feature_${i + 1}`),
      name: String(f.name || `Feature ${i + 1}`),
      description: String(f.description || ''),
      benefit: String(f.benefit || ''),
      category: (f.category as FeatureCategory) || 'core',
      priority: (f.priority as 'must' | 'should' | 'could' | 'wont') || 'should',
      complexity: Math.min(5, Math.max(1, Number(f.complexity) || 3)),
      userStories: (Array.isArray(f.userStories) ? f.userStories : []).map((s: Record<string, unknown>, j: number) => ({
        id: String(s.id || `story_${i}_${j}`),
        role: String(s.role || 'user'),
        action: String(s.action || ''),
        benefit: String(s.benefit || ''),
        points: typeof s.points === 'number' ? s.points : undefined,
      })),
      acceptanceCriteria: Array.isArray(f.acceptanceCriteria) ? f.acceptanceCriteria.map(String) : [],
      dependencies: Array.isArray(f.dependencies) ? f.dependencies.map(String) : [],
      technicalNotes: typeof f.technicalNotes === 'string' ? f.technicalNotes : undefined,
      competitorRef: typeof f.competitorRef === 'string' ? f.competitorRef : undefined,
      releaseTarget: (f.releaseTarget as 'mvp' | 'v1' | 'v2' | 'future') || 'mvp',
    })),
    nonFunctional: {
      performance: {
        pageLoadTime: parsed.nonFunctional?.performance?.pageLoadTime || '< 3s',
        apiResponseTime: parsed.nonFunctional?.performance?.apiResponseTime || '< 500ms',
        concurrentUsers: parsed.nonFunctional?.performance?.concurrentUsers || '1000+',
        other: parsed.nonFunctional?.performance?.other || [],
      },
      security: {
        authentication: parsed.nonFunctional?.security?.authentication || ['JWT'],
        authorization: parsed.nonFunctional?.security?.authorization || ['RBAC'],
        dataProtection: parsed.nonFunctional?.security?.dataProtection || [],
        compliance: parsed.nonFunctional?.security?.compliance || [],
      },
      accessibility: {
        wcagLevel: parsed.nonFunctional?.accessibility?.wcagLevel || 'AA',
        requirements: parsed.nonFunctional?.accessibility?.requirements || [],
      },
      scalability: {
        userGrowth: parsed.nonFunctional?.scalability?.userGrowth || '',
        dataGrowth: parsed.nonFunctional?.scalability?.dataGrowth || '',
        considerations: parsed.nonFunctional?.scalability?.considerations || [],
      },
      reliability: {
        uptime: parsed.nonFunctional?.reliability?.uptime || '99.9%',
        backupStrategy: parsed.nonFunctional?.reliability?.backupStrategy || 'daily',
        recoveryTime: parsed.nonFunctional?.reliability?.recoveryTime || '< 1 hour',
      },
      usability: {
        targetDevices: parsed.nonFunctional?.usability?.targetDevices || ['desktop', 'mobile'],
        browsers: parsed.nonFunctional?.usability?.browsers || ['Chrome', 'Firefox', 'Safari'],
        languages: parsed.nonFunctional?.usability?.languages || ['English'],
        uxPrinciples: parsed.nonFunctional?.usability?.uxPrinciples || [],
      },
    },
    metrics: (parsed.metrics || []).map((m: Record<string, unknown>) => ({
      name: String(m.name || ''),
      description: String(m.description || ''),
      target: String(m.target || ''),
      measurement: String(m.measurement || ''),
      priority: (m.priority as 'primary' | 'secondary') || 'secondary',
    })),
    constraints: (parsed.constraints || []).map((c: Record<string, unknown>) => ({
      type: (c.type as 'technical' | 'business' | 'legal' | 'time' | 'budget') || 'technical',
      description: String(c.description || ''),
      impact: String(c.impact || ''),
      mitigation: typeof c.mitigation === 'string' ? c.mitigation : undefined,
    })),
    openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.map(String) : [],
    researchRefs: [],
    createdAt: Date.now(),
    status: 'draft',
    version: 1,
  };

  return prd;
}

// =============================================================================
// SUGGESTIONS
// =============================================================================

function generateSuggestions(prd: ProductRequirementsDocument): string[] {
  const suggestions: string[] = [];

  // Check feature count
  const mustFeatures = prd.features.filter(f => f.priority === 'must');
  if (mustFeatures.length > 10) {
    suggestions.push('Consider reducing MVP scope - too many must-have features');
  }
  if (mustFeatures.length === 0) {
    suggestions.push('No must-have features defined - consider prioritizing core features');
  }

  // Check user stories
  const featuresWithoutStories = prd.features.filter(f => f.userStories.length === 0);
  if (featuresWithoutStories.length > 0) {
    suggestions.push(`${featuresWithoutStories.length} features lack user stories`);
  }

  // Check acceptance criteria
  const featuresWithoutCriteria = prd.features.filter(f => f.acceptanceCriteria.length === 0);
  if (featuresWithoutCriteria.length > 0) {
    suggestions.push(`${featuresWithoutCriteria.length} features lack acceptance criteria`);
  }

  // Check metrics
  const primaryMetrics = prd.metrics.filter(m => m.priority === 'primary');
  if (primaryMetrics.length === 0) {
    suggestions.push('No primary success metrics defined');
  }

  // Check open questions
  if (prd.openQuestions.length > 5) {
    suggestions.push('Many open questions remain - consider addressing before development');
  }

  return suggestions;
}
