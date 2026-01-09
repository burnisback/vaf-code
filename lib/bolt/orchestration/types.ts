/**
 * Orchestration Types
 *
 * Types for managing multi-phase project execution.
 * This module defines the state machine types for orchestrating
 * research -> product definition -> architecture -> implementation flows.
 */

// =============================================================================
// STATE MACHINE TYPES
// =============================================================================

/**
 * Possible states in the orchestration state machine
 */
export type OrchestrationState =
  | 'idle'
  | 'researching'
  | 'defining-product'
  | 'generating-architecture'
  | 'planning-phase'
  | 'executing-phase'
  | 'verifying'
  | 'refining'
  | 'awaiting-approval'
  | 'paused'
  | 'complete'
  | 'failed';

/**
 * Events that can be sent to the orchestration state machine
 */
export type OrchestrationEvent =
  | { type: 'START_RESEARCH'; payload: { prompt: string } }
  | { type: 'RESEARCH_COMPLETE'; payload: { sessionId: string } }
  | { type: 'START_PRODUCT_DEFINITION' }
  | { type: 'PRODUCT_DEFINED'; payload: { prdId: string } }
  | { type: 'START_ARCHITECTURE' }
  | { type: 'ARCHITECTURE_COMPLETE'; payload: { archId: string } }
  | { type: 'START_PHASE'; payload: { phaseId: string } }
  | { type: 'PHASE_COMPLETE'; payload: { phaseId: string; success: boolean } }
  | { type: 'VERIFICATION_COMPLETE'; payload: { success: boolean; errors?: string[] } }
  | { type: 'REFINEMENT_COMPLETE'; payload: { success: boolean } }
  | { type: 'USER_APPROVE' }
  | { type: 'USER_REJECT'; payload: { reason?: string } }
  | { type: 'USER_PAUSE' }
  | { type: 'USER_RESUME' }
  | { type: 'USER_ABORT' }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'RESET' };

/**
 * Context maintained by the orchestration state machine
 */
export interface OrchestrationContext {
  /** Current project ID */
  projectId: string;

  /** Original user prompt */
  originalPrompt: string;

  /** Research session ID */
  researchSessionId?: string;

  /** PRD document ID */
  prdId?: string;

  /** Architecture document ID */
  architectureId?: string;

  /** Current implementation phase */
  currentPhaseId?: string;

  /** Completed phase IDs */
  completedPhases: string[];

  /** Failed phase IDs with reasons */
  failedPhases: Array<{ phaseId: string; reason: string }>;

  /** Current iteration for refinement */
  currentIteration: number;

  /** Maximum iterations before failing */
  maxIterations: number;

  /** Checkpoint data for recovery */
  checkpoint?: CheckpointData;

  /** Error message if in failed state */
  error?: string;

  /** Timestamps for tracking */
  timestamps: {
    started: number;
    lastUpdated: number;
    phaseStarted?: number;
  };

  /** Metrics for reporting */
  metrics: {
    totalDuration: number;
    researchDuration?: number;
    planningDuration?: number;
    implementationDuration?: number;
    verificationAttempts: number;
  };
}

/**
 * Data saved at a checkpoint for recovery
 */
export interface CheckpointData {
  /** Checkpoint ID */
  id: string;

  /** State at checkpoint */
  state: OrchestrationState;

  /** Context at checkpoint */
  context: Partial<OrchestrationContext>;

  /** When checkpoint was created */
  createdAt: number;

  /** Reason for checkpoint */
  reason: 'auto' | 'user-pause' | 'phase-complete' | 'error';
}

// =============================================================================
// ORCHESTRATOR TYPES
// =============================================================================

/**
 * The main orchestrator interface
 */
export interface Orchestrator {
  /** Current state */
  state: OrchestrationState;

  /** Current context */
  context: OrchestrationContext;

  /** Send an event to the state machine */
  send(event: OrchestrationEvent): void;

  /** Subscribe to state changes */
  subscribe(callback: (state: OrchestrationState, context: OrchestrationContext) => void): () => void;

  /** Get available actions for current state */
  getAvailableActions(): OrchestrationEvent['type'][];

  /** Save checkpoint */
  saveCheckpoint(reason?: CheckpointData['reason']): CheckpointData;

  /** Restore from checkpoint */
  restoreCheckpoint(checkpointId: string): boolean;

  /** Get execution progress */
  getProgress(): ExecutionProgress;
}

/**
 * Progress information for UI display
 */
export interface ExecutionProgress {
  /** Overall percentage (0-100) */
  percentage: number;

  /** Current stage name */
  stage: string;

  /** Stage details/description */
  stageDetails: string;

  /** Completed stages */
  completedStages: string[];

  /** Remaining stages */
  remainingStages: string[];

  /** Estimated time remaining in ms (if calculable) */
  estimatedTimeRemaining?: number;
}

// =============================================================================
// CALLBACK TYPES
// =============================================================================

/**
 * Callbacks for orchestration events
 */
export interface OrchestrationCallbacks {
  /** Called on state transition */
  onStateChange?: (from: OrchestrationState, to: OrchestrationState, context: OrchestrationContext) => void;

  /** Called when research completes */
  onResearchComplete?: (sessionId: string) => void;

  /** Called when PRD is ready */
  onPRDReady?: (prdId: string) => void;

  /** Called when architecture is ready */
  onArchitectureReady?: (archId: string) => void;

  /** Called when a phase starts */
  onPhaseStart?: (phaseId: string) => void;

  /** Called when a phase completes */
  onPhaseComplete?: (phaseId: string, success: boolean) => void;

  /** Called when user approval is needed */
  onApprovalNeeded?: (what: 'research' | 'prd' | 'architecture' | 'phase') => void;

  /** Called on error */
  onError?: (error: string) => void;

  /** Called on completion */
  onComplete?: (context: OrchestrationContext) => void;
}

// =============================================================================
// PROJECT TYPES
// =============================================================================

/**
 * A mega-project spanning research to implementation
 */
export interface MegaProject {
  /** Project ID */
  id: string;

  /** Project name */
  name: string;

  /** Original prompt */
  prompt: string;

  /** Current state */
  state: OrchestrationState;

  /** Context */
  context: OrchestrationContext;

  /** Checkpoints */
  checkpoints: CheckpointData[];

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

// =============================================================================
// RUNNER TYPES
// =============================================================================

/**
 * Configuration for the orchestration runner
 */
export interface RunnerConfig {
  /** Maximum research queries */
  maxResearchQueries?: number;

  /** Auto-approve stages (skip manual approval) */
  autoApprove?: {
    research?: boolean;
    prd?: boolean;
    architecture?: boolean;
    phases?: boolean;
  };

  /** Callbacks */
  callbacks?: RunnerCallbacks;
}

/**
 * Extended callbacks for the runner
 */
export interface RunnerCallbacks extends OrchestrationCallbacks {
  /** Called with detailed progress updates */
  onProgress?: (message: string, data?: unknown) => void;

  /** Called when research results are available */
  onResearchResults?: (synthesis: unknown) => void;

  /** Called when PRD is generated */
  onPRDGenerated?: (prd: unknown) => void;

  /** Called when architecture is generated */
  onArchitectureGenerated?: (arch: unknown) => void;
}
