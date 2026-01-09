/**
 * Research Synthesizer
 *
 * Uses AI to synthesize research findings into actionable insights,
 * competitor analysis, and feature recommendations.
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import type {
  ResearchSession,
  ResearchSynthesis,
  ResearchFinding,
  CompetitorAnalysis,
  SourceReference,
  FeatureMatrix,
  FeatureSupport,
} from './types';
import { formatContentForAI } from './client';

// =============================================================================
// TYPES
// =============================================================================

export interface SynthesisRequest {
  /** The research session to synthesize */
  session: ResearchSession;

  /** Focus areas for synthesis */
  focusAreas?: Array<'competitors' | 'features' | 'market' | 'technical'>;

  /** Maximum length of synthesis content */
  maxLength?: number;
}

export interface SynthesisResult {
  /** Whether synthesis succeeded */
  success: boolean;

  /** The synthesis */
  synthesis?: ResearchSynthesis;

  /** Error if failed */
  error?: string;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SYNTHESIS_SYSTEM_PROMPT = `You are an expert research analyst specializing in product development.

Your job is to synthesize web research into actionable insights for building a product.

<output_format>
Provide your synthesis as JSON:
\`\`\`json
{
  "summary": "Executive summary (2-3 sentences)",
  "findings": [
    {
      "category": "feature|pricing|technology|market|user-need|gap|trend",
      "title": "Finding title",
      "description": "Detailed description",
      "evidence": ["supporting quotes or data"],
      "sources": ["source URLs"],
      "importance": "high|medium|low"
    }
  ],
  "competitors": [
    {
      "name": "Competitor name",
      "url": "https://...",
      "description": "Brief description",
      "features": ["key features"],
      "pricing": "pricing info if known",
      "strengths": ["strengths"],
      "weaknesses": ["weaknesses"],
      "targetAudience": "who they target"
    }
  ],
  "featureMatrix": {
    "features": ["Feature 1", "Feature 2"],
    "products": ["Competitor A", "Competitor B"],
    "matrix": [["full", "partial"], ["none", "full"]]
  },
  "recommendations": ["actionable recommendations for the product"],
  "sources": [
    {
      "url": "https://...",
      "title": "Source title",
      "domain": "domain.com",
      "credibility": 0.8,
      "usedFor": ["what info was extracted"]
    }
  ],
  "confidence": 0.85
}
\`\`\`
</output_format>

<rules>
1. Focus on actionable insights, not just information
2. Identify clear patterns across sources
3. Distinguish between facts and opinions
4. Rate confidence based on source quality and agreement
5. Prioritize findings by their impact on product decisions
6. Be specific about competitor strengths/weaknesses
7. Feature matrix should show realistic support levels
</rules>`;

// =============================================================================
// SYNTHESIZER FUNCTION
// =============================================================================

/**
 * Synthesize research session into insights
 */
export async function synthesizeResearch(
  request: SynthesisRequest
): Promise<SynthesisResult> {
  const { session, focusAreas = ['competitors', 'features', 'market'], maxLength = 50000 } = request;

  try {
    // Build the synthesis prompt
    const prompt = buildSynthesisPrompt(session, focusAreas, maxLength);

    // Generate synthesis using AI
    const response = await ai.generate({
      model: MODELS.PRO,
      system: SYNTHESIS_SYSTEM_PROMPT,
      prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    // Parse the response
    const synthesis = parseSynthesisResponse(response.text);

    return {
      success: true,
      synthesis,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Synthesis failed',
    };
  }
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildSynthesisPrompt(
  session: ResearchSession,
  focusAreas: string[],
  maxLength: number
): string {
  // Format extracted content
  const contentTexts: string[] = [];
  let currentLength = 0;

  for (const content of session.extractedContent) {
    const formatted = formatContentForAI(content);
    if (currentLength + formatted.length > maxLength) break;
    contentTexts.push(formatted);
    currentLength += formatted.length;
  }

  // Format search results summary
  const searchSummary = session.executedSearches
    .flatMap(s => s.results.slice(0, 3).map(r => `- ${r.title}: ${r.snippet}`))
    .slice(0, 30)
    .join('\n');

  return `<research_objective>
${session.objective}
</research_objective>

<focus_areas>
${focusAreas.join(', ')}
</focus_areas>

<search_results_summary>
${searchSummary}
</search_results_summary>

<extracted_content>
${contentTexts.join('\n\n---\n\n')}
</extracted_content>

<instructions>
Synthesize this research into actionable insights for building a product.

For each focus area, identify:
1. Key findings with evidence
2. Patterns across multiple sources
3. Gaps or opportunities
4. Specific recommendations

If competitor analysis is a focus, create a feature comparison matrix.

Be specific and cite sources where possible.
</instructions>`;
}

// =============================================================================
// RESPONSE PARSER
// =============================================================================

function parseSynthesisResponse(responseText: string): ResearchSynthesis {
  // Extract JSON from response
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1] : responseText;

  const jsonStart = jsonText.indexOf('{');
  const jsonEnd = jsonText.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON found in synthesis response');
  }

  const cleanJson = jsonText.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(cleanJson);

  // Build the synthesis object
  const synthesis: ResearchSynthesis = {
    summary: (parsed.summary as string) || 'Research synthesis complete.',
    findings: ((parsed.findings as Record<string, unknown>[]) || []).map((f): ResearchFinding => ({
      category: (f.category as ResearchFinding['category']) || 'feature',
      title: (f.title as string) || 'Finding',
      description: (f.description as string) || '',
      evidence: (f.evidence as string[]) || [],
      sources: (f.sources as string[]) || [],
      importance: (f.importance as ResearchFinding['importance']) || 'medium',
    })),
    competitors: ((parsed.competitors as Record<string, unknown>[]) || []).map((c): CompetitorAnalysis => ({
      name: (c.name as string) || 'Unknown',
      url: (c.url as string) || '',
      description: (c.description as string) || '',
      features: (c.features as string[]) || [],
      pricing: c.pricing as string | undefined,
      strengths: (c.strengths as string[]) || [],
      weaknesses: (c.weaknesses as string[]) || [],
      targetAudience: c.targetAudience as string | undefined,
    })),
    featureMatrix: parsed.featureMatrix ? {
      features: ((parsed.featureMatrix as Record<string, unknown>).features as string[]) || [],
      products: ((parsed.featureMatrix as Record<string, unknown>).products as string[]) || [],
      matrix: ((parsed.featureMatrix as Record<string, unknown>).matrix as FeatureSupport[][]) || [],
    } : undefined,
    recommendations: (parsed.recommendations as string[]) || [],
    sources: ((parsed.sources as Record<string, unknown>[]) || []).map((s): SourceReference => ({
      url: (s.url as string) || '',
      title: (s.title as string) || '',
      domain: (s.domain as string) || '',
      credibility: (s.credibility as number) || 0.5,
      usedFor: (s.usedFor as string[]) || [],
    })),
    confidence: (parsed.confidence as number) || 0.5,
  };

  return synthesis;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate a text report from synthesis
 */
export function generateSynthesisReport(synthesis: ResearchSynthesis): string {
  const lines: string[] = [];

  lines.push('# Research Synthesis Report');
  lines.push('');
  lines.push('## Executive Summary');
  lines.push(synthesis.summary);
  lines.push('');

  // Key Findings
  if (synthesis.findings.length > 0) {
    lines.push('## Key Findings');
    lines.push('');

    const byCategory = synthesis.findings.reduce((acc, f) => {
      if (!acc[f.category]) acc[f.category] = [];
      acc[f.category].push(f);
      return acc;
    }, {} as Record<string, ResearchFinding[]>);

    for (const [category, findings] of Object.entries(byCategory)) {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      for (const finding of findings) {
        const importance = finding.importance === 'high' ? '**[HIGH]**' : finding.importance === 'low' ? '[low]' : '';
        lines.push(`- ${importance} **${finding.title}**: ${finding.description}`);
      }
      lines.push('');
    }
  }

  // Competitors
  if (synthesis.competitors && synthesis.competitors.length > 0) {
    lines.push('## Competitor Analysis');
    lines.push('');

    for (const competitor of synthesis.competitors) {
      lines.push(`### ${competitor.name}`);
      lines.push(`- **URL**: ${competitor.url}`);
      lines.push(`- **Description**: ${competitor.description}`);
      if (competitor.pricing) {
        lines.push(`- **Pricing**: ${competitor.pricing}`);
      }
      lines.push(`- **Strengths**: ${competitor.strengths.join(', ')}`);
      lines.push(`- **Weaknesses**: ${competitor.weaknesses.join(', ')}`);
      lines.push('');
    }
  }

  // Feature Matrix
  if (synthesis.featureMatrix && synthesis.featureMatrix.features.length > 0) {
    lines.push('## Feature Comparison Matrix');
    lines.push('');

    const { features, products, matrix } = synthesis.featureMatrix;

    // Header
    lines.push('| Feature | ' + products.join(' | ') + ' |');
    lines.push('|' + '-|'.repeat(products.length + 1));

    // Rows
    for (let i = 0; i < features.length; i++) {
      const row = matrix[i] || [];
      const cells = row.map(cell => {
        switch (cell) {
          case 'full': return 'Yes';
          case 'partial': return 'Partial';
          case 'premium': return 'Premium';
          case 'none': return 'No';
          default: return '?';
        }
      });
      lines.push(`| ${features[i]} | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }

  // Recommendations
  if (synthesis.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const rec of synthesis.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Sources
  if (synthesis.sources.length > 0) {
    lines.push('## Sources');
    lines.push('');
    for (const source of synthesis.sources) {
      lines.push(`- [${source.title}](${source.url}) (${source.domain})`);
    }
  }

  lines.push('');
  lines.push(`---`);
  lines.push(`*Confidence: ${Math.round(synthesis.confidence * 100)}%*`);

  return lines.join('\n');
}
