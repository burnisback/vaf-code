/**
 * Research Planner
 *
 * AI-powered research planning that generates structured research plans
 * from user prompts. Identifies what to research, in what order, and
 * what outputs to produce.
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import type {
  ResearchPlan,
  ResearchPhase,
  SearchQuery,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface ResearchPlanningRequest {
  /** User's original prompt */
  prompt: string;

  /** Detected context from classification */
  context?: {
    domain?: string;
    productType?: string;
    goals?: string[];
  };

  /** Maximum number of search queries to generate */
  maxQueries?: number;

  /** Maximum research phases */
  maxPhases?: number;
}

export interface ResearchPlanningResult {
  /** Whether planning succeeded */
  success: boolean;

  /** The generated plan */
  plan?: ResearchPlan;

  /** Error if failed */
  error?: string;

  /** Planning reasoning */
  reasoning: string;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const RESEARCH_PLANNER_SYSTEM_PROMPT = `You are an expert research strategist. Your job is to create comprehensive research plans for product development.

<rules>
1. Break research into logical phases that build on each other
2. Generate specific, targeted search queries (not generic)
3. Consider multiple angles: competitors, features, market, technology
4. Order phases from foundational knowledge to specific details
5. Each phase should have 2-4 search queries
6. Include direct URLs if you know authoritative sources
7. Plan for synthesis and comparison at the end
</rules>

<research_types>
- competitor-analysis: Focus on existing products, their features, pricing, strengths/weaknesses
- market-research: Focus on market trends, user needs, industry reports
- feature-discovery: Focus on what features exist, best practices, innovation
- technical-research: Focus on implementation patterns, architectures, technologies
- mixed: Combination of above for comprehensive product research
</research_types>

<output_format>
Return a JSON research plan:
\`\`\`json
{
  "objective": "Clear statement of research goal",
  "type": "competitor-analysis|market-research|feature-discovery|technical-research|mixed",
  "phases": [
    {
      "id": "phase_1",
      "name": "Phase name",
      "description": "What this phase accomplishes",
      "queries": [
        {
          "query": "specific search query",
          "category": "competitor|technical|features|pricing|general",
          "maxResults": 10
        }
      ],
      "directUrls": ["https://known-authoritative-source.com"],
      "dependsOn": []
    }
  ],
  "expectedOutputs": ["What research will produce"],
  "estimatedTime": 10
}
\`\`\`
</output_format>`;

// =============================================================================
// PLANNER FUNCTION
// =============================================================================

/**
 * Generate a research plan from a user prompt
 */
export async function planResearch(
  request: ResearchPlanningRequest
): Promise<ResearchPlanningResult> {
  const { prompt, context, maxQueries = 15, maxPhases = 5 } = request;

  try {
    // Build the planning prompt
    const planningPrompt = buildPlanningPrompt(prompt, context, maxQueries, maxPhases);

    // Generate plan using AI
    const response = await ai.generate({
      model: MODELS.PRO,
      system: RESEARCH_PLANNER_SYSTEM_PROMPT,
      prompt: planningPrompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    });

    // Parse the response
    const { plan, reasoning } = parseResearchPlanResponse(response.text);

    // Validate and limit the plan
    const validatedPlan = validateAndLimitPlan(plan, maxQueries, maxPhases);

    return {
      success: true,
      plan: validatedPlan,
      reasoning,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Planning failed',
      reasoning: 'Error occurred during research planning.',
    };
  }
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildPlanningPrompt(
  prompt: string,
  context: ResearchPlanningRequest['context'],
  maxQueries: number,
  maxPhases: number
): string {
  let contextSection = '';

  if (context) {
    contextSection = `<detected_context>
${context.domain ? `Domain: ${context.domain}` : ''}
${context.productType ? `Product Type: ${context.productType}` : ''}
${context.goals ? `Goals: ${context.goals.join(', ')}` : ''}
</detected_context>`;
  }

  return `<user_request>
${prompt}
</user_request>

${contextSection}

<constraints>
- Maximum ${maxPhases} research phases
- Maximum ${maxQueries} total search queries across all phases
- Focus on actionable research that leads to product requirements
</constraints>

<instructions>
Create a research plan that will thoroughly investigate this topic.

Consider:
1. What competitors or existing solutions exist?
2. What features are essential vs. nice-to-have?
3. What do users need from this type of product?
4. What technologies or approaches are commonly used?
5. What gaps exist in the market?

Generate specific search queries that will find the best information.
</instructions>`;
}

// =============================================================================
// RESPONSE PARSER
// =============================================================================

function parseResearchPlanResponse(responseText: string): {
  plan: ResearchPlan;
  reasoning: string;
} {
  // Extract JSON from response
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1] : responseText;

  const jsonStart = jsonText.indexOf('{');
  const jsonEnd = jsonText.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON found in response');
  }

  const cleanJson = jsonText.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(cleanJson);

  // Build the plan
  const plan: ResearchPlan = {
    id: `research_${Date.now()}`,
    objective: parsed.objective || 'Research objective',
    type: parsed.type || 'mixed',
    phases: (parsed.phases || []).map((p: Record<string, unknown>, i: number): ResearchPhase => ({
      id: (p.id as string) || `phase_${i + 1}`,
      name: (p.name as string) || `Phase ${i + 1}`,
      description: (p.description as string) || '',
      queries: ((p.queries as Record<string, unknown>[]) || []).map((q: Record<string, unknown>): SearchQuery => ({
        query: q.query as string,
        category: (q.category as SearchQuery['category']) || 'general',
        maxResults: (q.maxResults as number) || 10,
        includeDomains: q.includeDomains as string[] | undefined,
        excludeDomains: q.excludeDomains as string[] | undefined,
      })),
      directUrls: (p.directUrls as string[]) || [],
      dependsOn: (p.dependsOn as string[]) || [],
      status: 'pending',
    })),
    expectedOutputs: (parsed.expectedOutputs as string[]) || [],
    estimatedTime: (parsed.estimatedTime as number) || 10,
  };

  // Extract reasoning (text before JSON)
  const reasoning = responseText.slice(0, jsonStart).trim() || 'Research plan generated.';

  return { plan, reasoning };
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateAndLimitPlan(
  plan: ResearchPlan,
  maxQueries: number,
  maxPhases: number
): ResearchPlan {
  // Limit phases
  const limitedPhases = plan.phases.slice(0, maxPhases);

  // Count and limit queries
  let queryCount = 0;
  const finalPhases: ResearchPhase[] = [];

  for (const phase of limitedPhases) {
    const remainingQueries = maxQueries - queryCount;
    if (remainingQueries <= 0) break;

    const limitedQueries = phase.queries.slice(0, remainingQueries);
    queryCount += limitedQueries.length;

    finalPhases.push({
      ...phase,
      queries: limitedQueries,
    });
  }

  return {
    ...plan,
    phases: finalPhases,
  };
}

// =============================================================================
// QUICK PLAN TEMPLATES
// =============================================================================

/**
 * Generate a quick plan for common research types
 */
export function generateQuickPlan(
  topic: string,
  type: ResearchPlan['type']
): ResearchPlan {
  const templates: Record<ResearchPlan['type'], () => ResearchPhase[]> = {
    'competitor-analysis': () => [
      {
        id: 'phase_1',
        name: 'Market Overview',
        description: 'Identify top competitors and their positioning',
        queries: [
          { query: `best ${topic} platforms 2024`, category: 'competitor', maxResults: 10 },
          { query: `${topic} alternatives comparison`, category: 'competitor', maxResults: 10 },
        ],
        dependsOn: [],
        status: 'pending',
      },
      {
        id: 'phase_2',
        name: 'Feature Analysis',
        description: 'Deep dive into competitor features',
        queries: [
          { query: `${topic} features comparison chart`, category: 'features', maxResults: 10 },
          { query: `${topic} pricing plans comparison`, category: 'pricing', maxResults: 10 },
        ],
        dependsOn: ['phase_1'],
        status: 'pending',
      },
    ],
    'market-research': () => [
      {
        id: 'phase_1',
        name: 'Market Trends',
        description: 'Understand current market state',
        queries: [
          { query: `${topic} market trends 2024`, category: 'general', maxResults: 10 },
          { query: `${topic} industry report`, category: 'general', maxResults: 10 },
        ],
        dependsOn: [],
        status: 'pending',
      },
      {
        id: 'phase_2',
        name: 'User Needs',
        description: 'Identify user pain points and needs',
        queries: [
          { query: `${topic} user problems`, category: 'general', maxResults: 10 },
          { query: `why ${topic} fail`, category: 'general', maxResults: 10 },
        ],
        dependsOn: ['phase_1'],
        status: 'pending',
      },
    ],
    'feature-discovery': () => [
      {
        id: 'phase_1',
        name: 'Core Features',
        description: 'Identify essential features',
        queries: [
          { query: `${topic} essential features`, category: 'features', maxResults: 10 },
          { query: `${topic} must-have features`, category: 'features', maxResults: 10 },
        ],
        dependsOn: [],
        status: 'pending',
      },
      {
        id: 'phase_2',
        name: 'Innovation',
        description: 'Find innovative and differentiating features',
        queries: [
          { query: `${topic} innovative features 2024`, category: 'features', maxResults: 10 },
          { query: `${topic} unique features`, category: 'features', maxResults: 10 },
        ],
        dependsOn: ['phase_1'],
        status: 'pending',
      },
    ],
    'technical-research': () => [
      {
        id: 'phase_1',
        name: 'Architecture',
        description: 'Understand technical approaches',
        queries: [
          { query: `${topic} architecture best practices`, category: 'technical', maxResults: 10 },
          { query: `how to build ${topic}`, category: 'technical', maxResults: 10 },
        ],
        dependsOn: [],
        status: 'pending',
      },
      {
        id: 'phase_2',
        name: 'Technology Stack',
        description: 'Identify common technologies',
        queries: [
          { query: `${topic} technology stack`, category: 'technical', maxResults: 10 },
          { query: `${topic} open source`, category: 'technical', maxResults: 10 },
        ],
        dependsOn: ['phase_1'],
        status: 'pending',
      },
    ],
    'mixed': () => [
      {
        id: 'phase_1',
        name: 'Market & Competitors',
        description: 'Understand the landscape',
        queries: [
          { query: `${topic} market overview`, category: 'general', maxResults: 10 },
          { query: `top ${topic} products`, category: 'competitor', maxResults: 10 },
        ],
        dependsOn: [],
        status: 'pending',
      },
      {
        id: 'phase_2',
        name: 'Features & Needs',
        description: 'Identify features and user needs',
        queries: [
          { query: `${topic} features list`, category: 'features', maxResults: 10 },
          { query: `${topic} user requirements`, category: 'general', maxResults: 10 },
        ],
        dependsOn: ['phase_1'],
        status: 'pending',
      },
      {
        id: 'phase_3',
        name: 'Implementation',
        description: 'Technical considerations',
        queries: [
          { query: `${topic} implementation guide`, category: 'technical', maxResults: 10 },
        ],
        dependsOn: ['phase_2'],
        status: 'pending',
      },
    ],
  };

  return {
    id: `quick_${Date.now()}`,
    objective: `Research ${topic} for product development`,
    type,
    phases: templates[type](),
    expectedOutputs: ['Competitive analysis', 'Feature recommendations', 'Technical approach'],
    estimatedTime: 5,
  };
}
