/**
 * Web Research Types
 *
 * Type definitions for web search, content extraction, and research synthesis.
 */

// =============================================================================
// SEARCH TYPES
// =============================================================================

export interface SearchQuery {
  /** The search query string */
  query: string;

  /** Category for the search (helps refine results) */
  category?: 'product' | 'technical' | 'competitor' | 'pricing' | 'features' | 'general';

  /** Maximum number of results to return */
  maxResults?: number;

  /** Domains to include (whitelist) */
  includeDomains?: string[];

  /** Domains to exclude (blacklist) */
  excludeDomains?: string[];

  /** Time filter for results */
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
}

export interface SearchResult {
  /** Unique identifier for this result */
  id: string;

  /** Page title */
  title: string;

  /** Page URL */
  url: string;

  /** Short description/snippet from search */
  snippet: string;

  /** Domain name extracted from URL */
  domain: string;

  /** Relevance score (0-1) */
  relevance: number;

  /** When the result was found */
  fetchedAt: number;
}

export interface SearchResponse {
  /** The original query */
  query: string;

  /** List of search results */
  results: SearchResult[];

  /** Total number of results available */
  totalResults: number;

  /** Whether the search was successful */
  success: boolean;

  /** Error message if search failed */
  error?: string;

  /** Time taken for search in ms */
  duration: number;
}

// =============================================================================
// CONTENT EXTRACTION TYPES
// =============================================================================

export interface ContentFetchRequest {
  /** URL to fetch content from */
  url: string;

  /** What type of content extraction to perform */
  extractionMode: 'full' | 'article' | 'structured' | 'summary';

  /** Specific selectors to extract (for structured mode) */
  selectors?: string[];

  /** Maximum content length to return */
  maxLength?: number;
}

export interface ExtractedContent {
  /** Source URL */
  url: string;

  /** Page title */
  title: string;

  /** Main content (cleaned text) */
  content: string;

  /** Extracted headings */
  headings: string[];

  /** Extracted lists (features, pricing tiers, etc.) */
  lists: ExtractedList[];

  /** Extracted tables */
  tables: ExtractedTable[];

  /** Key metadata */
  metadata: ContentMetadata;

  /** Extraction timestamp */
  extractedAt: number;
}

export interface ExtractedList {
  /** Context/heading before the list */
  context: string;

  /** List items */
  items: string[];

  /** List type */
  type: 'features' | 'pricing' | 'benefits' | 'steps' | 'generic';
}

export interface ExtractedTable {
  /** Table headers */
  headers: string[];

  /** Table rows */
  rows: string[][];

  /** Inferred table type */
  type: 'comparison' | 'pricing' | 'features' | 'specs' | 'generic';
}

export interface ContentMetadata {
  /** Meta description */
  description?: string;

  /** Open Graph title */
  ogTitle?: string;

  /** Open Graph description */
  ogDescription?: string;

  /** Published date if found */
  publishedDate?: string;

  /** Author if found */
  author?: string;

  /** Detected content type */
  contentType: 'product' | 'article' | 'documentation' | 'landing' | 'pricing' | 'unknown';
}

// =============================================================================
// RESEARCH SESSION TYPES
// =============================================================================

export interface ResearchSession {
  /** Unique session ID */
  id: string;

  /** Original user prompt that triggered research */
  originalPrompt: string;

  /** Research goal/objective */
  objective: string;

  /** Current status */
  status: 'planning' | 'searching' | 'extracting' | 'synthesizing' | 'complete' | 'failed';

  /** Planned search queries */
  plannedQueries: SearchQuery[];

  /** Executed searches */
  executedSearches: SearchResponse[];

  /** Extracted content from pages */
  extractedContent: ExtractedContent[];

  /** Synthesized findings */
  synthesis?: ResearchSynthesis;

  /** Session creation time */
  createdAt: number;

  /** Last update time */
  updatedAt: number;

  /** Error if failed */
  error?: string;
}

export interface ResearchSynthesis {
  /** Executive summary */
  summary: string;

  /** Key findings organized by category */
  findings: ResearchFinding[];

  /** Competitor analysis (if applicable) */
  competitors?: CompetitorAnalysis[];

  /** Feature comparison matrix */
  featureMatrix?: FeatureMatrix;

  /** Recommendations based on research */
  recommendations: string[];

  /** Sources used */
  sources: SourceReference[];

  /** Confidence level (0-1) */
  confidence: number;
}

export interface ResearchFinding {
  /** Finding category */
  category: 'feature' | 'pricing' | 'technology' | 'market' | 'user-need' | 'gap' | 'trend';

  /** Finding title */
  title: string;

  /** Detailed description */
  description: string;

  /** Supporting evidence */
  evidence: string[];

  /** Source URLs */
  sources: string[];

  /** Importance level */
  importance: 'high' | 'medium' | 'low';
}

export interface CompetitorAnalysis {
  /** Competitor name */
  name: string;

  /** Website URL */
  url: string;

  /** Brief description */
  description: string;

  /** Key features */
  features: string[];

  /** Pricing info if available */
  pricing?: string;

  /** Strengths */
  strengths: string[];

  /** Weaknesses */
  weaknesses: string[];

  /** Target audience */
  targetAudience?: string;
}

export interface FeatureMatrix {
  /** Feature names (rows) */
  features: string[];

  /** Competitor/product names (columns) */
  products: string[];

  /** Matrix data: features[i] x products[j] = support level */
  matrix: FeatureSupport[][];
}

export type FeatureSupport = 'full' | 'partial' | 'none' | 'unknown' | 'premium';

export interface SourceReference {
  /** Source URL */
  url: string;

  /** Source title */
  title: string;

  /** Source domain */
  domain: string;

  /** Credibility score (0-1) */
  credibility: number;

  /** What was extracted from this source */
  usedFor: string[];
}

// =============================================================================
// RESEARCH PLANNING TYPES
// =============================================================================

export interface ResearchPlan {
  /** Unique plan ID */
  id: string;

  /** Research objective */
  objective: string;

  /** Research type */
  type: 'competitor-analysis' | 'market-research' | 'feature-discovery' | 'technical-research' | 'mixed';

  /** Planned phases */
  phases: ResearchPhase[];

  /** Expected outputs */
  expectedOutputs: string[];

  /** Estimated time in minutes */
  estimatedTime: number;
}

export interface ResearchPhase {
  /** Phase ID */
  id: string;

  /** Phase name */
  name: string;

  /** Phase description */
  description: string;

  /** Search queries for this phase */
  queries: SearchQuery[];

  /** URLs to fetch directly */
  directUrls?: string[];

  /** Dependencies on other phases */
  dependsOn: string[];

  /** Status */
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface ResearchAPIRequest {
  /** Action type */
  action: 'search' | 'fetch' | 'synthesize' | 'plan';

  /** Search query (for search action) */
  searchQuery?: SearchQuery;

  /** Fetch request (for fetch action) */
  fetchRequest?: ContentFetchRequest;

  /** Session ID (for continuing research) */
  sessionId?: string;

  /** Full prompt (for planning) */
  prompt?: string;
}

export interface ResearchAPIResponse {
  /** Whether the request succeeded */
  success: boolean;

  /** Action that was performed */
  action: string;

  /** Search results (for search action) */
  searchResults?: SearchResponse;

  /** Extracted content (for fetch action) */
  extractedContent?: ExtractedContent;

  /** Research plan (for plan action) */
  researchPlan?: ResearchPlan;

  /** Synthesis (for synthesize action) */
  synthesis?: ResearchSynthesis;

  /** Session info */
  session?: {
    id: string;
    status: ResearchSession['status'];
  };

  /** Error message */
  error?: string;

  /** Duration in ms */
  duration: number;
}
