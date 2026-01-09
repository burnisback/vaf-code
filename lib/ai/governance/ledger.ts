/**
 * Ledger Writer
 *
 * Manages the audit trail for all governance decisions and actions.
 * Uses append-only JSONL format for immutability.
 */

import {
  type Stage,
  type DecisionObject,
  type LedgerEntry,
  ledgerEntrySchema,
} from './types';

/**
 * Action types for ledger entries
 */
export type LedgerAction =
  | 'WORK_ITEM_CREATED'
  | 'STAGE_ENTERED'
  | 'STAGE_COMPLETED'
  | 'DECISION_MADE'
  | 'ARTIFACT_CREATED'
  | 'REWORK_TRIGGERED'
  | 'ESCALATION_TRIGGERED'
  | 'WORK_ITEM_COMPLETED'
  | 'WORK_ITEM_CANCELLED';

/**
 * Generate a unique ledger entry ID
 */
function generateEntryId(): string {
  return `LE-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a ledger entry
 */
export function createLedgerEntry(
  workItemId: string,
  action: LedgerAction,
  options?: {
    agent?: string;
    stage?: Stage;
    details?: Record<string, unknown>;
    decision?: DecisionObject;
  }
): LedgerEntry {
  const entry: LedgerEntry = {
    id: generateEntryId(),
    timestamp: new Date().toISOString(),
    workItemId,
    action,
    agent: options?.agent,
    stage: options?.stage,
    details: options?.details,
    decision: options?.decision,
  };

  // Validate the entry
  ledgerEntrySchema.parse(entry);

  return entry;
}

/**
 * Serialize a ledger entry to JSONL format (single line)
 */
export function serializeLedgerEntry(entry: LedgerEntry): string {
  return JSON.stringify(entry);
}

/**
 * Parse a ledger entry from JSONL line
 */
export function parseLedgerEntry(line: string): LedgerEntry {
  const parsed = JSON.parse(line);
  return ledgerEntrySchema.parse(parsed) as LedgerEntry;
}

/**
 * In-memory ledger for browser environment
 * In production, this would write to a file or database
 */
class LedgerStore {
  private entries: LedgerEntry[] = [];
  private listeners: ((entry: LedgerEntry) => void)[] = [];

  /**
   * Append an entry to the ledger (immutable - append only)
   */
  append(entry: LedgerEntry): void {
    this.entries.push(entry);

    // Notify listeners
    for (const listener of this.listeners) {
      listener(entry);
    }

    // Also log to console for debugging
    console.log(`[LEDGER] ${entry.action}:`, entry);
  }

  /**
   * Get all entries
   */
  getAll(): LedgerEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries for a specific work item
   */
  getByWorkItem(workItemId: string): LedgerEntry[] {
    return this.entries.filter((e) => e.workItemId === workItemId);
  }

  /**
   * Get entries by action type
   */
  getByAction(action: LedgerAction): LedgerEntry[] {
    return this.entries.filter((e) => e.action === action);
  }

  /**
   * Get entries by stage
   */
  getByStage(stage: Stage): LedgerEntry[] {
    return this.entries.filter((e) => e.stage === stage);
  }

  /**
   * Get decisions for a work item
   */
  getDecisions(workItemId: string): DecisionObject[] {
    return this.entries
      .filter((e) => e.workItemId === workItemId && e.decision)
      .map((e) => e.decision!);
  }

  /**
   * Get decisions for a specific stage
   */
  getStageDecisions(workItemId: string, stage: Stage): DecisionObject[] {
    return this.entries
      .filter((e) => e.workItemId === workItemId && e.stage === stage && e.decision)
      .map((e) => e.decision!);
  }

  /**
   * Subscribe to new entries
   */
  subscribe(listener: (entry: LedgerEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Export ledger to JSONL string
   */
  exportToJsonl(): string {
    return this.entries.map(serializeLedgerEntry).join('\n');
  }

  /**
   * Import ledger from JSONL string
   */
  importFromJsonl(jsonl: string): void {
    const lines = jsonl.split('\n').filter((line) => line.trim());
    for (const line of lines) {
      const entry = parseLedgerEntry(line);
      this.entries.push(entry);
    }
  }

  /**
   * Clear the ledger (for testing only)
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get entry count
   */
  get count(): number {
    return this.entries.length;
  }
}

/**
 * Ledger class for managing audit trail
 */
export class Ledger {
  private store: LedgerStore;

  constructor() {
    this.store = new LedgerStore();
  }

  /**
   * Log work item creation
   */
  logWorkItemCreated(
    workItemId: string,
    details: { title: string; description: string; createdBy?: string }
  ): LedgerEntry {
    const entry = createLedgerEntry(workItemId, 'WORK_ITEM_CREATED', {
      details,
    });
    this.store.append(entry);
    return entry;
  }

  /**
   * Log stage entry
   */
  logStageEntered(workItemId: string, stage: Stage, agent?: string): LedgerEntry {
    const entry = createLedgerEntry(workItemId, 'STAGE_ENTERED', {
      stage,
      agent,
    });
    this.store.append(entry);
    return entry;
  }

  /**
   * Log stage completion
   */
  logStageCompleted(workItemId: string, stage: Stage, agent?: string): LedgerEntry {
    const entry = createLedgerEntry(workItemId, 'STAGE_COMPLETED', {
      stage,
      agent,
    });
    this.store.append(entry);
    return entry;
  }

  /**
   * Log a decision
   */
  logDecision(decision: DecisionObject): LedgerEntry {
    const entry = createLedgerEntry(decision.workItemId, 'DECISION_MADE', {
      stage: decision.stage,
      agent: decision.reviewerAgent,
      decision,
    });
    this.store.append(entry);
    return entry;
  }

  /**
   * Log artifact creation
   */
  logArtifactCreated(
    workItemId: string,
    stage: Stage,
    artifactName: string,
    agent: string
  ): LedgerEntry {
    const entry = createLedgerEntry(workItemId, 'ARTIFACT_CREATED', {
      stage,
      agent,
      details: { artifactName },
    });
    this.store.append(entry);
    return entry;
  }

  /**
   * Log rework triggered
   */
  logReworkTriggered(
    workItemId: string,
    stage: Stage,
    reason: string,
    iteration: number,
    requestedBy: string
  ): LedgerEntry {
    const entry = createLedgerEntry(workItemId, 'REWORK_TRIGGERED', {
      stage,
      agent: requestedBy,
      details: { reason, iteration },
    });
    this.store.append(entry);
    return entry;
  }

  /**
   * Log escalation triggered
   */
  logEscalationTriggered(
    workItemId: string,
    stage: Stage,
    reason: string,
    iteration: number,
    requestedBy: string
  ): LedgerEntry {
    const entry = createLedgerEntry(workItemId, 'ESCALATION_TRIGGERED', {
      stage,
      agent: requestedBy,
      details: { reason, iteration },
    });
    this.store.append(entry);
    return entry;
  }

  /**
   * Log work item completion
   */
  logWorkItemCompleted(workItemId: string): LedgerEntry {
    const entry = createLedgerEntry(workItemId, 'WORK_ITEM_COMPLETED', {
      stage: 'COMPLETED',
    });
    this.store.append(entry);
    return entry;
  }

  /**
   * Log work item cancellation
   */
  logWorkItemCancelled(workItemId: string, reason: string): LedgerEntry {
    const entry = createLedgerEntry(workItemId, 'WORK_ITEM_CANCELLED', {
      details: { reason },
    });
    this.store.append(entry);
    return entry;
  }

  /**
   * Get all entries for a work item
   */
  getWorkItemHistory(workItemId: string): LedgerEntry[] {
    return this.store.getByWorkItem(workItemId);
  }

  /**
   * Get all decisions for a work item
   */
  getWorkItemDecisions(workItemId: string): DecisionObject[] {
    return this.store.getDecisions(workItemId);
  }

  /**
   * Get decisions for a specific stage
   */
  getStageDecisions(workItemId: string, stage: Stage): DecisionObject[] {
    return this.store.getStageDecisions(workItemId, stage);
  }

  /**
   * Subscribe to ledger updates
   */
  subscribe(listener: (entry: LedgerEntry) => void): () => void {
    return this.store.subscribe(listener);
  }

  /**
   * Export to JSONL
   */
  export(): string {
    return this.store.exportToJsonl();
  }

  /**
   * Import from JSONL
   */
  import(jsonl: string): void {
    this.store.importFromJsonl(jsonl);
  }

  /**
   * Get entry count
   */
  get entryCount(): number {
    return this.store.count;
  }
}

// Singleton instance
export const governanceLedger = new Ledger();
