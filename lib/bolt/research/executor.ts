/**
 * Research Executor
 *
 * Executes research plans by running searches, fetching content,
 * and building a knowledge base from results.
 */

import type {
  ResearchPlan,
  ResearchPhase,
  ResearchSession,
  SearchQuery,
  SearchResponse,
  ExtractedContent,
} from './types';
import { getResearchClient, mergeSearchResults } from './client';

// =============================================================================
// TYPES
// =============================================================================

export interface ExecutionCallbacks {
  /** Called when a phase starts */
  onPhaseStart?: (phase: ResearchPhase) => void;

  /** Called when a phase completes */
  onPhaseComplete?: (phase: ResearchPhase, results: SearchResponse[]) => void;

  /** Called when a search completes */
  onSearchComplete?: (query: SearchQuery, result: SearchResponse) => void;

  /** Called when content is extracted */
  onContentExtracted?: (content: ExtractedContent) => void;

  /** Called on any error */
  onError?: (error: Error, context: string) => void;

  /** Called with progress updates */
  onProgress?: (progress: ExecutionProgress) => void;
}

export interface ExecutionProgress {
  /** Current phase index */
  currentPhase: number;

  /** Total phases */
  totalPhases: number;

  /** Current query index within phase */
  currentQuery: number;

  /** Total queries in current phase */
  totalQueries: number;

  /** Overall percentage (0-100) */
  percentage: number;

  /** Current action description */
  action: string;
}

export interface ExecutionResult {
  /** Whether execution completed successfully */
  success: boolean;

  /** Updated session with results */
  session: ResearchSession;

  /** Errors encountered */
  errors: Array<{ phase: string; error: string }>;

  /** Total duration in ms */
  duration: number;
}

// =============================================================================
// EXECUTOR CLASS
// =============================================================================

export class ResearchExecutor {
  private client = getResearchClient();
  private callbacks: ExecutionCallbacks;
  private aborted = false;

  constructor(callbacks: ExecutionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Execute a research plan
   */
  async execute(plan: ResearchPlan): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.aborted = false;

    // Create session
    const session: ResearchSession = {
      id: `session_${Date.now()}`,
      originalPrompt: plan.objective,
      objective: plan.objective,
      status: 'searching',
      plannedQueries: plan.phases.flatMap(p => p.queries),
      executedSearches: [],
      extractedContent: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const errors: ExecutionResult['errors'] = [];
    const totalQueries = session.plannedQueries.length;
    let completedQueries = 0;

    // Execute phases in order (respecting dependencies)
    const completedPhases = new Set<string>();

    for (let phaseIndex = 0; phaseIndex < plan.phases.length; phaseIndex++) {
      if (this.aborted) break;

      const phase = plan.phases[phaseIndex];

      // Check dependencies
      const dependenciesMet = phase.dependsOn.every(dep => completedPhases.has(dep));
      if (!dependenciesMet) {
        errors.push({ phase: phase.id, error: 'Dependencies not met' });
        continue;
      }

      // Update phase status
      phase.status = 'in_progress';
      this.callbacks.onPhaseStart?.(phase);

      const phaseResults: SearchResponse[] = [];

      // Execute searches in parallel (with concurrency limit)
      const searchPromises = phase.queries.map(async (query, queryIndex) => {
        if (this.aborted) return null;

        try {
          this.callbacks.onProgress?.({
            currentPhase: phaseIndex + 1,
            totalPhases: plan.phases.length,
            currentQuery: queryIndex + 1,
            totalQueries: phase.queries.length,
            percentage: Math.round((completedQueries / totalQueries) * 100),
            action: `Searching: ${query.query.slice(0, 50)}...`,
          });

          const result = await this.client.search(query);
          phaseResults.push(result);
          session.executedSearches.push(result);
          completedQueries++;

          this.callbacks.onSearchComplete?.(query, result);

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Search failed';
          errors.push({ phase: phase.id, error: `Query "${query.query}": ${errorMessage}` });
          this.callbacks.onError?.(error as Error, `Search: ${query.query}`);
          return null;
        }
      });

      await Promise.all(searchPromises);

      // Fetch content from top results
      if (!this.aborted && phaseResults.length > 0) {
        const merged = mergeSearchResults(phaseResults);
        const topUrls = merged.results.slice(0, 5).map(r => r.url);

        this.callbacks.onProgress?.({
          currentPhase: phaseIndex + 1,
          totalPhases: plan.phases.length,
          currentQuery: phase.queries.length,
          totalQueries: phase.queries.length,
          percentage: Math.round((completedQueries / totalQueries) * 100),
          action: 'Extracting content from top results...',
        });

        for (const url of topUrls) {
          if (this.aborted) break;

          try {
            const content = await this.client.fetchContent({
              url,
              extractionMode: 'article',
              maxLength: 30000,
            });
            session.extractedContent.push(content);
            this.callbacks.onContentExtracted?.(content);
          } catch (error) {
            // Content extraction failures are non-critical
            this.callbacks.onError?.(error as Error, `Fetch: ${url}`);
          }
        }
      }

      // Also fetch direct URLs if specified
      if (!this.aborted && phase.directUrls) {
        for (const url of phase.directUrls) {
          try {
            const content = await this.client.fetchContent({
              url,
              extractionMode: 'full',
            });
            session.extractedContent.push(content);
            this.callbacks.onContentExtracted?.(content);
          } catch (error) {
            this.callbacks.onError?.(error as Error, `Direct fetch: ${url}`);
          }
        }
      }

      // Mark phase complete
      phase.status = 'complete';
      completedPhases.add(phase.id);
      this.callbacks.onPhaseComplete?.(phase, phaseResults);
    }

    // Update session status
    session.status = this.aborted ? 'failed' : 'complete';
    session.updatedAt = Date.now();

    if (this.aborted) {
      session.error = 'Research was aborted';
    }

    return {
      success: !this.aborted && errors.length === 0,
      session,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Abort ongoing execution
   */
  abort(): void {
    this.aborted = true;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createResearchExecutor(callbacks?: ExecutionCallbacks): ResearchExecutor {
  return new ResearchExecutor(callbacks);
}
