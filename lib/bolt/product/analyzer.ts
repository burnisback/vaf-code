/**
 * Research Analyzer (Server-Side Only)
 *
 * Analyzes research synthesis to extract actionable product insights.
 * ONLY import this file in server-side code (API routes).
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import type { ResearchSynthesis } from '../research/types';
import type { ResearchAnalysis } from './types';

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const ANALYSIS_SYSTEM_PROMPT = `You are a product strategist analyzing research to define product requirements.

Your job is to extract actionable insights from research that will inform product decisions.

<rules>
1. Focus on patterns across multiple sources
2. Prioritize based on user impact and market opportunity
3. Distinguish between table-stakes features and differentiators
4. Consider technical feasibility
5. Identify gaps competitors haven't addressed
</rules>

<output_format>
Return JSON analysis:
\`\`\`json
{
  "insights": ["key insight 1", "key insight 2"],
  "competitorFeatures": [
    {
      "feature": "Feature name",
      "competitors": ["Competitor A", "Competitor B"],
      "prevalence": "common|unique|standard"
    }
  ],
  "userNeeds": [
    {
      "need": "User need description",
      "importance": "critical|high|medium|low",
      "evidence": "Source of this need"
    }
  ],
  "gaps": ["Market gap 1", "Gap 2"],
  "differentiators": ["Potential differentiator 1"],
  "featurePriorities": [
    {
      "feature": "Feature name",
      "priority": "must|should|could",
      "rationale": "Why this priority"
    }
  ]
}
\`\`\`
</output_format>`;

// =============================================================================
// ANALYZER FUNCTION
// =============================================================================

/**
 * Analyze research synthesis to extract product insights
 * NOTE: This function uses genkit and must only be called from server-side code
 */
export async function analyzeResearch(
  synthesis: ResearchSynthesis,
  context?: { productType?: string; targetAudience?: string }
): Promise<ResearchAnalysis> {
  const prompt = buildAnalysisPrompt(synthesis, context);

  try {
    const response = await ai.generate({
      model: MODELS.PRO,
      system: ANALYSIS_SYSTEM_PROMPT,
      prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    });

    return parseAnalysisResponse(response.text);
  } catch (error) {
    console.error('[analyzer] Error analyzing research:', error);
    // Return minimal analysis on error
    return buildFallbackAnalysis(synthesis);
  }
}

// =============================================================================
// FALLBACK ANALYSIS
// =============================================================================

/**
 * Build fallback analysis when AI fails
 */
function buildFallbackAnalysis(synthesis: ResearchSynthesis): ResearchAnalysis {
  return {
    insights: [synthesis.summary],
    competitorFeatures: synthesis.competitors?.map(c => ({
      feature: c.features[0] || c.name,
      competitors: [c.name],
      prevalence: 'common' as const,
    })) || [],
    userNeeds: synthesis.findings
      .filter(f => f.category === 'user-need')
      .map(f => ({
        need: f.title,
        importance: f.importance as 'critical' | 'high' | 'medium' | 'low',
        evidence: f.sources[0] || 'Research',
      })),
    gaps: synthesis.findings
      .filter(f => f.category === 'gap')
      .map(f => f.title),
    differentiators: [],
    featurePriorities: synthesis.recommendations.map(rec => ({
      feature: rec,
      priority: 'should' as const,
      rationale: 'From research recommendations',
    })),
  };
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildAnalysisPrompt(
  synthesis: ResearchSynthesis,
  context?: { productType?: string; targetAudience?: string }
): string {
  const parts: string[] = [];

  if (context?.productType) {
    parts.push(`<product_type>${context.productType}</product_type>`);
  }
  if (context?.targetAudience) {
    parts.push(`<target_audience>${context.targetAudience}</target_audience>`);
  }

  parts.push('<research_summary>');
  parts.push(synthesis.summary);
  parts.push('</research_summary>');

  if (synthesis.findings.length > 0) {
    parts.push('<findings>');
    for (const finding of synthesis.findings) {
      parts.push(`- [${finding.category}/${finding.importance}] ${finding.title}: ${finding.description}`);
    }
    parts.push('</findings>');
  }

  if (synthesis.competitors && synthesis.competitors.length > 0) {
    parts.push('<competitors>');
    for (const competitor of synthesis.competitors) {
      parts.push(`## ${competitor.name}`);
      parts.push(`Features: ${competitor.features.join(', ')}`);
      parts.push(`Strengths: ${competitor.strengths.join(', ')}`);
      parts.push(`Weaknesses: ${competitor.weaknesses.join(', ')}`);
      parts.push('');
    }
    parts.push('</competitors>');
  }

  if (synthesis.featureMatrix) {
    parts.push('<feature_matrix>');
    parts.push(`Features: ${synthesis.featureMatrix.features.join(', ')}`);
    parts.push(`Products: ${synthesis.featureMatrix.products.join(', ')}`);
    parts.push('</feature_matrix>');
  }

  parts.push('<recommendations>');
  for (const rec of synthesis.recommendations) {
    parts.push(`- ${rec}`);
  }
  parts.push('</recommendations>');

  parts.push(`<confidence>${Math.round(synthesis.confidence * 100)}%</confidence>`);

  parts.push('<instructions>');
  parts.push('Analyze this research and extract:');
  parts.push('1. Key insights that should inform product decisions');
  parts.push('2. Features found across competitors (with prevalence)');
  parts.push('3. User needs with importance levels');
  parts.push('4. Market gaps and opportunities');
  parts.push('5. Potential differentiators');
  parts.push('6. Recommended feature priorities');
  parts.push('</instructions>');

  return parts.join('\n');
}

// =============================================================================
// RESPONSE PARSER
// =============================================================================

function parseAnalysisResponse(responseText: string): ResearchAnalysis {
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1] : responseText;

  const jsonStart = jsonText.indexOf('{');
  const jsonEnd = jsonText.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON found in analysis response');
  }

  const cleanJson = jsonText.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(cleanJson);

  return {
    insights: parsed.insights || [],
    competitorFeatures: (parsed.competitorFeatures || []).map((cf: Record<string, unknown>) => ({
      feature: String(cf.feature || ''),
      competitors: Array.isArray(cf.competitors) ? cf.competitors.map(String) : [],
      prevalence: (cf.prevalence as 'common' | 'unique' | 'standard') || 'common',
    })),
    userNeeds: (parsed.userNeeds || []).map((un: Record<string, unknown>) => ({
      need: String(un.need || ''),
      importance: (un.importance as 'critical' | 'high' | 'medium' | 'low') || 'medium',
      evidence: String(un.evidence || ''),
    })),
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
    differentiators: Array.isArray(parsed.differentiators) ? parsed.differentiators.map(String) : [],
    featurePriorities: (parsed.featurePriorities || []).map((fp: Record<string, unknown>) => ({
      feature: String(fp.feature || ''),
      priority: (fp.priority as 'must' | 'should' | 'could') || 'should',
      rationale: String(fp.rationale || ''),
    })),
  };
}
