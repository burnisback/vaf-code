/**
 * Context Injection
 *
 * Intelligently selects and injects relevant documents into AI prompts.
 */

import type {
  StoredDocument,
  DocumentType,
  ContextInjectionRequest,
  ContextInjectionResult,
} from './types';
import { getDocumentStore } from './store';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_TOKENS = 8000;
const RELEVANCE_THRESHOLD = 0.3;

// Approximate tokens per character
const TOKENS_PER_CHAR = 0.25;

// =============================================================================
// CONTEXT INJECTION
// =============================================================================

/**
 * Select and format documents for injection into AI prompt
 */
export async function injectContext(
  request: ContextInjectionRequest
): Promise<ContextInjectionResult> {
  const {
    prompt,
    sessionId,
    documentTypes = ['research-synthesis', 'product-requirements', 'architecture'],
    maxTokens = DEFAULT_MAX_TOKENS,
    relevanceThreshold = RELEVANCE_THRESHOLD,
  } = request;

  const store = getDocumentStore();

  // Get candidate documents
  const searchResult = await store.search({
    types: documentTypes,
    sessionId,
    status: 'complete',
    limit: 20,
  });

  // Also include recent documents from other sessions if not enough
  let allDocs = searchResult.documents;
  if (allDocs.length < 5) {
    const recentDocs = await store.getRecent(10);
    const existingIds = new Set(allDocs.map(d => d.id));
    for (const doc of recentDocs) {
      if (!existingIds.has(doc.id) && documentTypes.includes(doc.type)) {
        allDocs.push(doc);
      }
    }
  }

  // Calculate relevance for each document
  const scored = allDocs.map(doc => ({
    document: doc,
    relevance: calculateRelevance(prompt, doc),
    summary: generateSummary(doc),
  }));

  // Filter by relevance threshold
  const relevant = scored
    .filter(s => s.relevance >= relevanceThreshold)
    .sort((a, b) => b.relevance - a.relevance);

  // Select documents within token budget
  const selected: typeof relevant = [];
  let currentTokens = 0;

  for (const item of relevant) {
    const docTokens = estimateTokens(item.document);
    if (currentTokens + docTokens <= maxTokens) {
      selected.push(item);
      currentTokens += docTokens;
    }
  }

  // Format context string
  const contextString = formatContextString(selected);

  return {
    selectedDocuments: selected,
    contextString,
    estimatedTokens: currentTokens,
  };
}

// =============================================================================
// RELEVANCE CALCULATION
// =============================================================================

/**
 * Calculate relevance of a document to a prompt
 */
function calculateRelevance(prompt: string, document: StoredDocument): number {
  const promptLower = prompt.toLowerCase();
  const docText = `${document.title} ${document.description} ${document.content} ${document.tags.join(' ')}`.toLowerCase();

  // Extract significant words from prompt (4+ chars)
  const promptWords = promptLower
    .split(/\s+/)
    .filter(w => w.length >= 4)
    .filter(w => !STOP_WORDS.has(w));

  if (promptWords.length === 0) return 0.5; // Default relevance

  // Count matches
  let matches = 0;
  for (const word of promptWords) {
    if (docText.includes(word)) {
      matches++;
    }
  }

  // Base relevance from keyword matching
  let relevance = promptWords.length > 0 ? matches / promptWords.length : 0;

  // Boost for document type alignment
  if (promptLower.includes('research') && document.type === 'research-synthesis') {
    relevance += 0.2;
  }
  if (promptLower.includes('feature') && document.type === 'feature-list') {
    relevance += 0.2;
  }
  if (promptLower.includes('requirement') && document.type === 'product-requirements') {
    relevance += 0.2;
  }
  if (promptLower.includes('architecture') && document.type === 'architecture') {
    relevance += 0.2;
  }

  // Recency boost (documents from last hour get bonus)
  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (document.updatedAt > hourAgo) {
    relevance += 0.1;
  }

  return Math.min(1, relevance);
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'been',
  'will', 'would', 'could', 'should', 'what', 'when', 'where', 'which',
  'about', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'under', 'again', 'further', 'then', 'once',
]);

// =============================================================================
// SUMMARY GENERATION
// =============================================================================

/**
 * Generate a brief summary of a document for context
 */
function generateSummary(document: StoredDocument): string {
  // Use description if short enough
  if (document.description.length <= 200) {
    return document.description;
  }

  // Extract first meaningful paragraph from content
  const paragraphs = document.content
    .split(/\n\n+/)
    .filter(p => p.length > 50 && !p.startsWith('#'));

  if (paragraphs.length > 0) {
    const first = paragraphs[0];
    return first.length <= 200 ? first : first.slice(0, 197) + '...';
  }

  return document.description.slice(0, 197) + '...';
}

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Estimate token count for a document
 */
function estimateTokens(document: StoredDocument): number {
  // Include title, description, and content
  const totalChars = document.title.length + document.description.length + document.content.length;
  return Math.ceil(totalChars * TOKENS_PER_CHAR);
}

// =============================================================================
// CONTEXT FORMATTING
// =============================================================================

interface SelectedDocument {
  document: StoredDocument;
  relevance: number;
  summary: string;
}

/**
 * Format selected documents into a context string
 */
function formatContextString(selected: SelectedDocument[]): string {
  if (selected.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('<previous_research>');
  lines.push('The following documents from previous research are relevant to this request:');
  lines.push('');

  for (const { document } of selected) {
    lines.push(`## ${document.title}`);
    lines.push(`*Type: ${document.type} | Tags: ${document.tags.join(', ')}*`);
    lines.push('');

    // Include structured data if available
    if (document.structuredData) {
      // For research synthesis, include key findings
      if (document.type === 'research-synthesis') {
        const data = document.structuredData as {
          summary?: string;
          recommendations?: string[];
          competitors?: Array<{ name: string }>;
        };
        if (data.summary) {
          lines.push(`**Summary:** ${data.summary}`);
        }
        if (data.recommendations && data.recommendations.length > 0) {
          lines.push('');
          lines.push('**Key Recommendations:**');
          for (const rec of data.recommendations.slice(0, 5)) {
            lines.push(`- ${rec}`);
          }
        }
        if (data.competitors && data.competitors.length > 0) {
          lines.push('');
          lines.push('**Competitors Analyzed:** ' + data.competitors.map(c => c.name).join(', '));
        }
      } else {
        // For other types, include the content directly (truncated)
        lines.push(document.content.slice(0, 2000));
      }
    } else {
      lines.push(document.content.slice(0, 2000));
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('</previous_research>');

  return lines.join('\n');
}

// =============================================================================
// PROMPT ENHANCEMENT
// =============================================================================

/**
 * Enhance a prompt with relevant context
 */
export async function enhancePromptWithContext(
  prompt: string,
  sessionId: string,
  options?: Partial<ContextInjectionRequest>
): Promise<{
  enhancedPrompt: string;
  context: ContextInjectionResult;
}> {
  const context = await injectContext({
    prompt,
    sessionId,
    ...options,
  });

  // If no context, return original prompt
  if (context.selectedDocuments.length === 0) {
    return { enhancedPrompt: prompt, context };
  }

  // Prepend context to prompt
  const enhancedPrompt = `${context.contextString}\n\n---\n\n${prompt}`;

  return { enhancedPrompt, context };
}
