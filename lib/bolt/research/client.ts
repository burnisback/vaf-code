/**
 * Research Client
 *
 * Client-side utilities for interacting with the research API.
 */

import type {
  SearchQuery,
  SearchResponse,
  ContentFetchRequest,
  ExtractedContent,
  ResearchPlan,
  ResearchAPIRequest,
  ResearchAPIResponse,
} from './types';

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class ResearchClient {
  private baseUrl: string;

  constructor(baseUrl = '/api/research') {
    this.baseUrl = baseUrl;
  }

  /**
   * Execute a web search
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const response = await this.request({
      action: 'search',
      searchQuery: query,
    });

    if (!response.success || !response.searchResults) {
      throw new Error(response.error || 'Search failed');
    }

    return response.searchResults;
  }

  /**
   * Fetch and extract content from a URL
   */
  async fetchContent(request: ContentFetchRequest): Promise<ExtractedContent> {
    const response = await this.request({
      action: 'fetch',
      fetchRequest: request,
    });

    if (!response.success || !response.extractedContent) {
      throw new Error(response.error || 'Content fetch failed');
    }

    return response.extractedContent;
  }

  /**
   * Generate a research plan from a prompt
   */
  async planResearch(prompt: string): Promise<ResearchPlan> {
    const response = await this.request({
      action: 'plan',
      prompt,
    });

    if (!response.success || !response.researchPlan) {
      throw new Error(response.error || 'Research planning failed');
    }

    return response.researchPlan;
  }

  /**
   * Internal request helper
   */
  private async request(body: ResearchAPIRequest): Promise<ResearchAPIResponse> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok && response.status !== 429) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed: ${response.status}`);
    }

    return response.json();
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let researchClient: ResearchClient | null = null;

export function getResearchClient(): ResearchClient {
  if (!researchClient) {
    researchClient = new ResearchClient();
  }
  return researchClient;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate search queries for a research objective
 */
export function generateSearchQueries(
  objective: string,
  type: 'competitor' | 'feature' | 'market' | 'technical'
): SearchQuery[] {
  const queries: SearchQuery[] = [];

  switch (type) {
    case 'competitor':
      queries.push(
        { query: `${objective} competitors comparison`, category: 'competitor', maxResults: 10 },
        { query: `best ${objective} platforms 2024`, category: 'competitor', maxResults: 10 },
        { query: `${objective} alternatives`, category: 'competitor', maxResults: 10 }
      );
      break;

    case 'feature':
      queries.push(
        { query: `${objective} features list`, category: 'features', maxResults: 10 },
        { query: `${objective} must-have features`, category: 'features', maxResults: 10 },
        { query: `${objective} feature comparison`, category: 'features', maxResults: 10 }
      );
      break;

    case 'market':
      queries.push(
        { query: `${objective} market trends 2024`, category: 'general', maxResults: 10 },
        { query: `${objective} industry report`, category: 'general', maxResults: 10 },
        { query: `${objective} user needs pain points`, category: 'general', maxResults: 10 }
      );
      break;

    case 'technical':
      queries.push(
        { query: `${objective} architecture best practices`, category: 'technical', maxResults: 10 },
        { query: `${objective} technology stack`, category: 'technical', maxResults: 10 },
        { query: `${objective} implementation guide`, category: 'technical', maxResults: 10 }
      );
      break;
  }

  return queries;
}

/**
 * Merge and deduplicate search results
 */
export function mergeSearchResults(responses: SearchResponse[]): SearchResponse {
  const seenUrls = new Set<string>();
  const mergedResults: SearchResponse['results'] = [];

  for (const response of responses) {
    for (const result of response.results) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        mergedResults.push(result);
      }
    }
  }

  // Sort by relevance
  mergedResults.sort((a, b) => b.relevance - a.relevance);

  return {
    query: responses.map(r => r.query).join(' | '),
    results: mergedResults,
    totalResults: mergedResults.length,
    success: true,
    duration: responses.reduce((sum, r) => sum + r.duration, 0),
  };
}

/**
 * Extract key information from content for quick preview
 */
export function summarizeContent(content: ExtractedContent): {
  title: string;
  preview: string;
  highlights: string[];
} {
  return {
    title: content.title || content.url,
    preview: content.content.slice(0, 200) + (content.content.length > 200 ? '...' : ''),
    highlights: content.headings.slice(0, 5),
  };
}

/**
 * Calculate content relevance to a topic
 */
export function calculateRelevance(content: ExtractedContent, topic: string): number {
  const topicLower = topic.toLowerCase();
  const contentLower = `${content.title} ${content.content}`.toLowerCase();

  // Simple keyword matching
  const topicWords = topicLower.split(/\s+/).filter(w => w.length > 3);
  let matches = 0;

  for (const word of topicWords) {
    if (contentLower.includes(word)) {
      matches++;
    }
  }

  return topicWords.length > 0 ? matches / topicWords.length : 0;
}

/**
 * Format extracted content for AI consumption
 */
export function formatContentForAI(content: ExtractedContent): string {
  const parts: string[] = [];

  parts.push(`# ${content.title}`);
  parts.push(`Source: ${content.url}`);
  parts.push(`Type: ${content.metadata.contentType}`);
  parts.push('');

  if (content.metadata.description) {
    parts.push(`> ${content.metadata.description}`);
    parts.push('');
  }

  if (content.headings.length > 0) {
    parts.push('## Key Sections');
    for (const heading of content.headings.slice(0, 10)) {
      parts.push(`- ${heading}`);
    }
    parts.push('');
  }

  if (content.lists.length > 0) {
    parts.push('## Extracted Lists');
    for (const list of content.lists.slice(0, 5)) {
      if (list.context) {
        parts.push(`### ${list.context}`);
      }
      parts.push(`Type: ${list.type}`);
      for (const item of list.items.slice(0, 10)) {
        parts.push(`- ${item}`);
      }
      parts.push('');
    }
  }

  parts.push('## Content');
  parts.push(content.content.slice(0, 5000));

  return parts.join('\n');
}

/**
 * Filter search results by minimum relevance score
 */
export function filterByRelevance(results: SearchResponse, minRelevance = 0.5): SearchResponse {
  return {
    ...results,
    results: results.results.filter(r => r.relevance >= minRelevance),
    totalResults: results.results.filter(r => r.relevance >= minRelevance).length,
  };
}

/**
 * Group search results by domain
 */
export function groupByDomain(results: SearchResponse): Map<string, SearchResponse['results']> {
  const grouped = new Map<string, SearchResponse['results']>();

  for (const result of results.results) {
    const existing = grouped.get(result.domain) || [];
    existing.push(result);
    grouped.set(result.domain, existing);
  }

  return grouped;
}

/**
 * Extract unique domains from search results
 */
export function extractDomains(results: SearchResponse): string[] {
  const domains = new Set<string>();
  for (const result of results.results) {
    domains.add(result.domain);
  }
  return Array.from(domains);
}

/**
 * Check if content is likely a product page
 */
export function isProductPage(content: ExtractedContent): boolean {
  const productIndicators = ['pricing', 'features', 'sign up', 'get started', 'free trial', 'demo'];
  const combined = `${content.title} ${content.content}`.toLowerCase();

  let matches = 0;
  for (const indicator of productIndicators) {
    if (combined.includes(indicator)) {
      matches++;
    }
  }

  return matches >= 2 || content.metadata.contentType === 'product';
}

/**
 * Check if content is likely a comparison/review page
 */
export function isComparisonPage(content: ExtractedContent): boolean {
  const comparisonIndicators = ['vs', 'comparison', 'compare', 'alternative', 'review', 'best', 'top'];
  const combined = `${content.title} ${content.url}`.toLowerCase();

  for (const indicator of comparisonIndicators) {
    if (combined.includes(indicator)) {
      return true;
    }
  }

  return false;
}
