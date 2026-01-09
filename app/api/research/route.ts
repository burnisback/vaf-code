/**
 * Research API Route
 *
 * Handles web search, content fetching, and research synthesis.
 * Uses server-side processing to avoid CORS issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  ResearchAPIRequest,
  ResearchAPIResponse,
  SearchQuery,
  SearchResponse,
  SearchResult,
  ContentFetchRequest,
  ExtractedContent,
  ExtractedList,
} from '@/lib/bolt/research/types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SEARCH_API_URL = process.env.SEARCH_API_URL || 'https://api.search.brave.com/res/v1/web/search';
const SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY;

// Rate limiting
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ResearchAPIResponse>> {
  const startTime = Date.now();

  try {
    // Rate limiting check
    const clientId = request.headers.get('x-forwarded-for') || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return NextResponse.json<ResearchAPIResponse>({
        success: false,
        action: 'rate_limited',
        error: 'Too many requests. Please wait a moment.',
        duration: Date.now() - startTime,
      }, { status: 429 });
    }

    const body = await request.json() as ResearchAPIRequest;
    const { action } = body;

    switch (action) {
      case 'search':
        if (!body.searchQuery) {
          return NextResponse.json<ResearchAPIResponse>({
            success: false,
            action: 'search',
            error: 'Missing searchQuery parameter',
            duration: Date.now() - startTime,
          }, { status: 400 });
        }
        return await handleSearch(body.searchQuery, startTime);

      case 'fetch':
        if (!body.fetchRequest) {
          return NextResponse.json<ResearchAPIResponse>({
            success: false,
            action: 'fetch',
            error: 'Missing fetchRequest parameter',
            duration: Date.now() - startTime,
          }, { status: 400 });
        }
        return await handleFetch(body.fetchRequest, startTime);

      case 'plan':
        if (!body.prompt) {
          return NextResponse.json<ResearchAPIResponse>({
            success: false,
            action: 'plan',
            error: 'Missing prompt parameter',
            duration: Date.now() - startTime,
          }, { status: 400 });
        }
        return await handlePlan(body.prompt, startTime);

      case 'synthesize':
        if (!body.sessionId) {
          return NextResponse.json<ResearchAPIResponse>({
            success: false,
            action: 'synthesize',
            error: 'Missing sessionId parameter',
            duration: Date.now() - startTime,
          }, { status: 400 });
        }
        return await handleSynthesize(body.sessionId, startTime);

      default:
        return NextResponse.json<ResearchAPIResponse>({
          success: false,
          action: 'unknown',
          error: `Unknown action: ${action}`,
          duration: Date.now() - startTime,
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[research] API error:', error);
    return NextResponse.json<ResearchAPIResponse>({
      success: false,
      action: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

// =============================================================================
// SEARCH HANDLER
// =============================================================================

async function handleSearch(
  query: SearchQuery,
  startTime: number
): Promise<NextResponse<ResearchAPIResponse>> {
  if (!SEARCH_API_KEY) {
    // Fallback to mock results for development
    console.log('[research] No BRAVE_SEARCH_API_KEY, using mock results');
    return NextResponse.json<ResearchAPIResponse>({
      success: true,
      action: 'search',
      searchResults: generateMockSearchResults(query),
      duration: Date.now() - startTime,
    });
  }

  try {
    // Build search URL
    const searchUrl = new URL(SEARCH_API_URL);
    searchUrl.searchParams.set('q', query.query);
    searchUrl.searchParams.set('count', String(query.maxResults || 10));

    if (query.timeRange && query.timeRange !== 'all') {
      const freshness: Record<string, string> = {
        day: 'pd',
        week: 'pw',
        month: 'pm',
        year: 'py',
      };
      searchUrl.searchParams.set('freshness', freshness[query.timeRange]);
    }

    // Execute search
    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': SEARCH_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`);
    }

    const data = await response.json();

    // Transform results
    const results: SearchResult[] = (data.web?.results || []).map((r: Record<string, unknown>, i: number) => ({
      id: `search_${Date.now()}_${i}`,
      title: (r.title as string) || '',
      url: (r.url as string) || '',
      snippet: (r.description as string) || '',
      domain: extractDomain((r.url as string) || ''),
      relevance: 1 - (i * 0.05), // Simple relevance based on position
      fetchedAt: Date.now(),
    }));

    // Apply domain filters
    const filteredResults = filterByDomain(results, query.includeDomains, query.excludeDomains);

    const searchResponse: SearchResponse = {
      query: query.query,
      results: filteredResults,
      totalResults: (data.web?.totalResults as number) || filteredResults.length,
      success: true,
      duration: Date.now() - startTime,
    };

    return NextResponse.json<ResearchAPIResponse>({
      success: true,
      action: 'search',
      searchResults: searchResponse,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[research] Search error:', error);
    return NextResponse.json<ResearchAPIResponse>({
      success: false,
      action: 'search',
      error: error instanceof Error ? error.message : 'Search failed',
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

// =============================================================================
// CONTENT FETCH HANDLER
// =============================================================================

async function handleFetch(
  fetchRequest: ContentFetchRequest,
  startTime: number
): Promise<NextResponse<ResearchAPIResponse>> {
  try {
    const { url, extractionMode, maxLength = 50000 } = fetchRequest;

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol - must be http or https');
    }

    // Fetch the page
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VAFResearchBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      const html = await response.text();

      // Extract content based on mode
      const extracted = extractContent(html, url, extractionMode, maxLength);

      return NextResponse.json<ResearchAPIResponse>({
        success: true,
        action: 'fetch',
        extractedContent: extracted,
        duration: Date.now() - startTime,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  } catch (error) {
    console.error('[research] Fetch error:', error);
    return NextResponse.json<ResearchAPIResponse>({
      success: false,
      action: 'fetch',
      error: error instanceof Error ? error.message : 'Fetch failed',
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

// =============================================================================
// PLAN HANDLER (Placeholder - Full implementation in Phase 11)
// =============================================================================

async function handlePlan(
  prompt: string,
  startTime: number
): Promise<NextResponse<ResearchAPIResponse>> {
  // This will be fully implemented in Phase 11
  // For now, return a basic plan structure

  return NextResponse.json<ResearchAPIResponse>({
    success: true,
    action: 'plan',
    researchPlan: {
      id: `plan_${Date.now()}`,
      objective: `Research: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`,
      type: 'mixed',
      phases: [
        {
          id: 'phase_1',
          name: 'Initial Search',
          description: 'Gather initial information',
          queries: [{ query: prompt, maxResults: 10 }],
          dependsOn: [],
          status: 'pending',
        },
      ],
      expectedOutputs: ['Research summary', 'Key findings'],
      estimatedTime: 5,
    },
    duration: Date.now() - startTime,
  });
}

// =============================================================================
// SYNTHESIZE HANDLER (Placeholder - Full implementation in Phase 11)
// =============================================================================

async function handleSynthesize(
  sessionId: string,
  startTime: number
): Promise<NextResponse<ResearchAPIResponse>> {
  // This will be fully implemented in Phase 11
  return NextResponse.json<ResearchAPIResponse>({
    success: false,
    action: 'synthesize',
    error: 'Synthesis not yet implemented - will be added in Phase 11',
    session: {
      id: sessionId,
      status: 'failed',
    },
    duration: Date.now() - startTime,
  }, { status: 501 });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(clientId);

  if (!record || now > record.resetAt) {
    requestCounts.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function filterByDomain(
  results: SearchResult[],
  include?: string[],
  exclude?: string[]
): SearchResult[] {
  let filtered = results;

  if (include && include.length > 0) {
    filtered = filtered.filter(r =>
      include.some(d => r.domain.includes(d))
    );
  }

  if (exclude && exclude.length > 0) {
    filtered = filtered.filter(r =>
      !exclude.some(d => r.domain.includes(d))
    );
  }

  return filtered;
}

function extractContent(
  html: string,
  url: string,
  mode: string,
  maxLength: number
): ExtractedContent {
  // Basic HTML content extraction
  // In production, use a library like cheerio or jsdom

  // Remove scripts and styles
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1] : undefined;

  // Extract OG title and description
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const ogTitle = ogTitleMatch ? ogTitleMatch[1] : undefined;

  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  const ogDescription = ogDescMatch ? ogDescMatch[1] : undefined;

  // Extract headings
  const headings: string[] = [];
  const headingMatches = cleaned.matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi);
  for (const match of headingMatches) {
    const heading = match[1].trim();
    if (heading && !headings.includes(heading)) {
      headings.push(heading);
    }
  }

  // Extract lists
  const lists: ExtractedList[] = [];
  const listMatches = cleaned.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/gi);
  for (const match of listMatches) {
    const items: string[] = [];
    const itemMatches = match[1].matchAll(/<li[^>]*>([^<]+)/gi);
    for (const item of itemMatches) {
      const text = item[1].trim();
      if (text) items.push(text);
    }
    if (items.length > 0) {
      lists.push({
        context: '',
        items,
        type: inferListType(items),
      });
    }
  }

  // Clean to plain text
  const plainText = cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

  return {
    url,
    title,
    content: plainText,
    headings: headings.slice(0, 20),
    lists: lists.slice(0, 10),
    tables: [], // Table extraction would need more sophisticated parsing
    metadata: {
      description,
      ogTitle,
      ogDescription,
      contentType: inferContentType(url, title, plainText),
    },
    extractedAt: Date.now(),
  };
}

function inferListType(items: string[]): ExtractedList['type'] {
  const combined = items.join(' ').toLowerCase();

  if (combined.includes('feature') || combined.includes('include')) return 'features';
  if (combined.includes('$') || combined.includes('price') || combined.includes('plan')) return 'pricing';
  if (combined.includes('benefit') || combined.includes('advantage')) return 'benefits';
  if (combined.includes('step') || /\d\./.test(combined)) return 'steps';

  return 'generic';
}

function inferContentType(url: string, title: string, content: string): ExtractedContent['metadata']['contentType'] {
  const combined = `${url} ${title} ${content}`.toLowerCase();

  if (combined.includes('pricing') || combined.includes('plans')) return 'pricing';
  if (combined.includes('documentation') || combined.includes('docs')) return 'documentation';
  if (combined.includes('blog') || combined.includes('article')) return 'article';
  if (combined.includes('features') || combined.includes('product')) return 'product';
  if (url.includes('landing') || title.includes('Welcome')) return 'landing';

  return 'unknown';
}

function generateMockSearchResults(query: SearchQuery): SearchResponse {
  // Generate mock results for development without API key
  const mockResults: SearchResult[] = [
    {
      id: 'mock_1',
      title: `${query.query} - Top Result`,
      url: 'https://example.com/result-1',
      snippet: `Comprehensive information about ${query.query}. This is a mock result for development.`,
      domain: 'example.com',
      relevance: 0.95,
      fetchedAt: Date.now(),
    },
    {
      id: 'mock_2',
      title: `Best ${query.query} Guide 2024`,
      url: 'https://example.com/result-2',
      snippet: `Complete guide to ${query.query} with examples and best practices.`,
      domain: 'example.com',
      relevance: 0.90,
      fetchedAt: Date.now(),
    },
    {
      id: 'mock_3',
      title: `${query.query} Comparison`,
      url: 'https://example.com/result-3',
      snippet: `Compare different options for ${query.query}.`,
      domain: 'example.com',
      relevance: 0.85,
      fetchedAt: Date.now(),
    },
    {
      id: 'mock_4',
      title: `Top 10 ${query.query} Solutions`,
      url: 'https://example.com/result-4',
      snippet: `Discover the top solutions for ${query.query} in this comprehensive review.`,
      domain: 'example.com',
      relevance: 0.80,
      fetchedAt: Date.now(),
    },
    {
      id: 'mock_5',
      title: `${query.query} Features and Pricing`,
      url: 'https://example.com/result-5',
      snippet: `Detailed breakdown of ${query.query} features and pricing options.`,
      domain: 'example.com',
      relevance: 0.75,
      fetchedAt: Date.now(),
    },
  ];

  return {
    query: query.query,
    results: mockResults.slice(0, query.maxResults || 10),
    totalResults: mockResults.length,
    success: true,
    duration: 100,
  };
}
