/**
 * Document Store Implementation
 *
 * In-memory document store with localStorage persistence.
 * For production, replace with a database-backed implementation.
 */

import type {
  StoredDocument,
  DocumentStore,
  DocumentType,
  DocumentSearchQuery,
  DocumentSearchResult,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'bolt_documents';
const MAX_DOCUMENTS = 100;

// =============================================================================
// IN-MEMORY STORE
// =============================================================================

class InMemoryDocumentStore implements DocumentStore {
  private documents: Map<string, StoredDocument> = new Map();
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load documents from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const docs = JSON.parse(stored) as StoredDocument[];
        for (const doc of docs) {
          this.documents.set(doc.id, doc);
        }
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to load documents from storage:', error);
      this.initialized = true;
    }
  }

  /**
   * Save documents to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const docs = Array.from(this.documents.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch (error) {
      console.error('Failed to save documents to storage:', error);
    }
  }

  /**
   * Generate a unique document ID
   */
  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get a document by ID
   */
  async get(id: string): Promise<StoredDocument | null> {
    return this.documents.get(id) || null;
  }

  /**
   * Get all documents of a type
   */
  async getByType(type: DocumentType): Promise<StoredDocument[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.type === type)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Search documents
   */
  async search(query: DocumentSearchQuery): Promise<DocumentSearchResult> {
    let results = Array.from(this.documents.values());

    // Filter by types
    if (query.types && query.types.length > 0) {
      results = results.filter(doc => query.types!.includes(doc.type));
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(doc =>
        query.tags!.some(tag => doc.tags.includes(tag))
      );
    }

    // Filter by session
    if (query.sessionId) {
      results = results.filter(doc => doc.sessionId === query.sessionId);
    }

    // Filter by status
    if (query.status) {
      results = results.filter(doc => doc.metadata.status === query.status);
    }

    // Filter by date range
    if (query.dateRange) {
      if (query.dateRange.from) {
        results = results.filter(doc => doc.createdAt >= query.dateRange!.from!);
      }
      if (query.dateRange.to) {
        results = results.filter(doc => doc.createdAt <= query.dateRange!.to!);
      }
    }

    // Text search
    if (query.query) {
      const lowerQuery = query.query.toLowerCase();
      results = results.filter(doc =>
        doc.title.toLowerCase().includes(lowerQuery) ||
        doc.description.toLowerCase().includes(lowerQuery) ||
        doc.content.toLowerCase().includes(lowerQuery) ||
        doc.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    // Sort by most recent
    results.sort((a, b) => b.updatedAt - a.updatedAt);

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    return {
      documents: paginated,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Save a new document
   */
  async save(
    document: Omit<StoredDocument, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<StoredDocument> {
    const now = Date.now();
    const newDoc: StoredDocument = {
      ...document,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Enforce max documents limit
    if (this.documents.size >= MAX_DOCUMENTS) {
      // Remove oldest documents
      const docs = Array.from(this.documents.values())
        .sort((a, b) => a.updatedAt - b.updatedAt);
      const toRemove = docs.slice(0, this.documents.size - MAX_DOCUMENTS + 1);
      for (const doc of toRemove) {
        this.documents.delete(doc.id);
      }
    }

    this.documents.set(newDoc.id, newDoc);
    this.saveToStorage();

    return newDoc;
  }

  /**
   * Update an existing document
   */
  async update(id: string, updates: Partial<StoredDocument>): Promise<StoredDocument> {
    const existing = this.documents.get(id);
    if (!existing) {
      throw new Error(`Document not found: ${id}`);
    }

    const updated: StoredDocument = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    this.documents.set(id, updated);
    this.saveToStorage();

    return updated;
  }

  /**
   * Delete a document
   */
  async delete(id: string): Promise<boolean> {
    const existed = this.documents.has(id);
    this.documents.delete(id);
    this.saveToStorage();
    return existed;
  }

  /**
   * Get documents for a session
   */
  async getBySession(sessionId: string): Promise<StoredDocument[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.sessionId === sessionId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get recent documents
   */
  async getRecent(limit = 10): Promise<StoredDocument[]> {
    return Array.from(this.documents.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  /**
   * Clear all documents (for testing)
   */
  async clear(): Promise<void> {
    this.documents.clear();
    this.saveToStorage();
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let documentStore: DocumentStore | null = null;

export function getDocumentStore(): DocumentStore {
  if (!documentStore) {
    documentStore = new InMemoryDocumentStore();
  }
  return documentStore;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface SynthesisData {
  summary: string;
  findings: unknown[];
  competitors?: unknown[];
  recommendations: string[];
  sources: Array<{ url: string }>;
  confidence: number;
}

/**
 * Create a research document from synthesis
 */
export function createResearchDocument(
  synthesis: SynthesisData,
  sessionId: string,
  title?: string
): Omit<StoredDocument, 'id' | 'createdAt' | 'updatedAt' | 'version'> {
  // Build markdown content
  const content = buildResearchContent(synthesis);

  return {
    type: 'research-synthesis',
    title: title || 'Research Synthesis',
    description: synthesis.summary,
    content,
    structuredData: synthesis as unknown as Record<string, unknown>,
    metadata: {
      source: 'research',
      confidence: synthesis.confidence,
      sources: synthesis.sources.map(s => s.url),
      wordCount: content.split(/\s+/).length,
      status: 'complete',
    },
    tags: extractTags(synthesis),
    relatedDocuments: [],
    sessionId,
  };
}

function buildResearchContent(synthesis: SynthesisData): string {
  const lines: string[] = [];

  lines.push('# Research Synthesis');
  lines.push('');
  lines.push('## Summary');
  lines.push(synthesis.summary);
  lines.push('');

  if (synthesis.findings?.length > 0) {
    lines.push('## Key Findings');
    for (const finding of synthesis.findings as Array<{ title: string; category: string; importance: string; description: string }>) {
      lines.push(`### ${finding.title}`);
      lines.push(`*Category: ${finding.category} | Importance: ${finding.importance}*`);
      lines.push('');
      lines.push(finding.description);
      lines.push('');
    }
  }

  if (synthesis.competitors && synthesis.competitors.length > 0) {
    lines.push('## Competitors');
    for (const competitor of synthesis.competitors as Array<{ name: string; description: string; strengths: string[]; weaknesses: string[] }>) {
      lines.push(`### ${competitor.name}`);
      lines.push(competitor.description);
      lines.push('');
      lines.push('**Strengths:**');
      for (const s of competitor.strengths) {
        lines.push(`- ${s}`);
      }
      lines.push('');
      lines.push('**Weaknesses:**');
      for (const w of competitor.weaknesses) {
        lines.push(`- ${w}`);
      }
      lines.push('');
    }
  }

  if (synthesis.recommendations?.length > 0) {
    lines.push('## Recommendations');
    for (const rec of synthesis.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Confidence: ${Math.round(synthesis.confidence * 100)}%*`);

  return lines.join('\n');
}

function extractTags(synthesis: SynthesisData): string[] {
  const tags = new Set<string>();

  // Add finding categories
  for (const finding of (synthesis.findings || []) as Array<{ category: string }>) {
    tags.add(finding.category);
  }

  // Add competitor names (normalized)
  for (const competitor of (synthesis.competitors || []) as Array<{ name: string }>) {
    tags.add(competitor.name.toLowerCase().replace(/\s+/g, '-'));
  }

  return Array.from(tags);
}
