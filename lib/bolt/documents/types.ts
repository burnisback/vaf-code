/**
 * Document Persistence Types
 *
 * Types for storing, retrieving, and managing research documents
 * and other generated artifacts that persist across sessions.
 */

// =============================================================================
// DOCUMENT TYPES
// =============================================================================

export interface StoredDocument {
  /** Unique document ID */
  id: string;

  /** Document type */
  type: DocumentType;

  /** Document title */
  title: string;

  /** Brief description */
  description: string;

  /** Full document content (markdown or structured) */
  content: string;

  /** Structured data (if applicable) */
  structuredData?: Record<string, unknown>;

  /** Document metadata */
  metadata: DocumentMetadata;

  /** Tags for categorization */
  tags: string[];

  /** Related document IDs */
  relatedDocuments: string[];

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;

  /** Session that created this document */
  sessionId: string;

  /** Version number (for updates) */
  version: number;
}

export type DocumentType =
  | 'research-synthesis'
  | 'competitor-analysis'
  | 'feature-list'
  | 'product-requirements'
  | 'architecture'
  | 'technical-spec'
  | 'user-stories'
  | 'implementation-plan'
  | 'custom';

export interface DocumentMetadata {
  /** Source of the document (research, user, ai-generated) */
  source: 'research' | 'user' | 'ai-generated' | 'imported';

  /** Confidence level (for AI-generated) */
  confidence?: number;

  /** Original sources (URLs, files) */
  sources?: string[];

  /** Word count */
  wordCount: number;

  /** Whether document is complete or draft */
  status: 'draft' | 'complete' | 'archived';

  /** Custom metadata fields */
  custom?: Record<string, string | number | boolean>;
}

// =============================================================================
// DOCUMENT STORE TYPES
// =============================================================================

export interface DocumentStore {
  /** Get a document by ID */
  get(id: string): Promise<StoredDocument | null>;

  /** Get all documents of a type */
  getByType(type: DocumentType): Promise<StoredDocument[]>;

  /** Search documents by query */
  search(query: DocumentSearchQuery): Promise<DocumentSearchResult>;

  /** Save a document */
  save(document: Omit<StoredDocument, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<StoredDocument>;

  /** Update a document */
  update(id: string, updates: Partial<StoredDocument>): Promise<StoredDocument>;

  /** Delete a document */
  delete(id: string): Promise<boolean>;

  /** Get documents for a session */
  getBySession(sessionId: string): Promise<StoredDocument[]>;

  /** Get recent documents */
  getRecent(limit?: number): Promise<StoredDocument[]>;
}

export interface DocumentSearchQuery {
  /** Text query */
  query?: string;

  /** Filter by types */
  types?: DocumentType[];

  /** Filter by tags */
  tags?: string[];

  /** Filter by session */
  sessionId?: string;

  /** Filter by date range */
  dateRange?: {
    from?: number;
    to?: number;
  };

  /** Filter by status */
  status?: DocumentMetadata['status'];

  /** Maximum results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

export interface DocumentSearchResult {
  /** Matching documents */
  documents: StoredDocument[];

  /** Total count (for pagination) */
  total: number;

  /** Whether there are more results */
  hasMore: boolean;
}

// =============================================================================
// CONTEXT INJECTION TYPES
// =============================================================================

export interface ContextInjectionRequest {
  /** Current user prompt */
  prompt: string;

  /** Session ID */
  sessionId: string;

  /** What types of documents to include */
  documentTypes?: DocumentType[];

  /** Maximum tokens to include */
  maxTokens?: number;

  /** Relevance threshold (0-1) */
  relevanceThreshold?: number;
}

export interface ContextInjectionResult {
  /** Documents selected for injection */
  selectedDocuments: Array<{
    document: StoredDocument;
    relevance: number;
    summary: string;
  }>;

  /** Formatted context string */
  contextString: string;

  /** Estimated token count */
  estimatedTokens: number;
}

// =============================================================================
// DOCUMENT TEMPLATES
// =============================================================================

export interface DocumentTemplate {
  /** Template ID */
  id: string;

  /** Template name */
  name: string;

  /** Document type this template creates */
  type: DocumentType;

  /** Template content with placeholders */
  template: string;

  /** Required fields */
  requiredFields: string[];

  /** Optional fields */
  optionalFields: string[];
}

// =============================================================================
// EXPORT/IMPORT TYPES
// =============================================================================

export interface ExportOptions {
  /** Format to export as */
  format: 'markdown' | 'json' | 'html' | 'pdf';

  /** Include metadata */
  includeMetadata?: boolean;

  /** Include related documents */
  includeRelated?: boolean;
}

export interface ImportResult {
  /** Whether import succeeded */
  success: boolean;

  /** Imported document */
  document?: StoredDocument;

  /** Error if failed */
  error?: string;
}
