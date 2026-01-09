/**
 * Orchestration State Machine (Client-Safe)
 *
 * Implements the state machine for multi-phase project execution.
 * This module is client-safe - no genkit or server-only dependencies.
 */

import type {
  OrchestrationState,
  OrchestrationEvent,
  OrchestrationContext,
  Orchestrator,
  OrchestrationCallbacks,
  CheckpointData,
  ExecutionProgress,
} from './types';

// =============================================================================
// STATE TRANSITIONS
// =============================================================================

type StateTransition = {
  [K in OrchestrationEvent['type']]?: OrchestrationState;
};

/**
 * State transition table defining valid transitions for each state
 */
const STATE_TRANSITIONS: Record<OrchestrationState, StateTransition> = {
  idle: {
    START_RESEARCH: 'researching',
    START_PRODUCT_DEFINITION: 'defining-product',
    START_ARCHITECTURE: 'generating-architecture',
    START_PHASE: 'planning-phase',
  },
  researching: {
    RESEARCH_COMPLETE: 'awaiting-approval',
    ERROR: 'failed',
    USER_ABORT: 'idle',
    USER_PAUSE: 'paused',
  },
  'defining-product': {
    PRODUCT_DEFINED: 'awaiting-approval',
    ERROR: 'failed',
    USER_ABORT: 'idle',
    USER_PAUSE: 'paused',
  },
  'generating-architecture': {
    ARCHITECTURE_COMPLETE: 'awaiting-approval',
    ERROR: 'failed',
    USER_ABORT: 'idle',
    USER_PAUSE: 'paused',
  },
  'planning-phase': {
    START_PHASE: 'executing-phase',
    ERROR: 'failed',
    USER_ABORT: 'idle',
    USER_PAUSE: 'paused',
  },
  'executing-phase': {
    PHASE_COMPLETE: 'verifying',
    ERROR: 'failed',
    USER_ABORT: 'idle',
    USER_PAUSE: 'paused',
  },
  verifying: {
    VERIFICATION_COMPLETE: 'awaiting-approval',
    ERROR: 'refining',
    USER_ABORT: 'idle',
  },
  refining: {
    REFINEMENT_COMPLETE: 'verifying',
    ERROR: 'failed',
    USER_ABORT: 'idle',
  },
  'awaiting-approval': {
    USER_APPROVE: 'idle', // Will be overridden based on context
    USER_REJECT: 'idle',
    USER_ABORT: 'idle',
  },
  paused: {
    USER_RESUME: 'idle', // Will restore previous state
    USER_ABORT: 'idle',
    RESET: 'idle',
  },
  complete: {
    RESET: 'idle',
  },
  failed: {
    RESET: 'idle',
    USER_RESUME: 'idle',
  },
};

// =============================================================================
// STAGE DEFINITIONS
// =============================================================================

const STAGES = [
  { name: 'Research', state: 'researching' as OrchestrationState },
  { name: 'Product Definition', state: 'defining-product' as OrchestrationState },
  { name: 'Architecture', state: 'generating-architecture' as OrchestrationState },
  { name: 'Implementation', state: 'executing-phase' as OrchestrationState },
  { name: 'Verification', state: 'verifying' as OrchestrationState },
];

// =============================================================================
// STATE MACHINE IMPLEMENTATION
// =============================================================================

/**
 * Create an orchestrator instance
 */
export function createOrchestrator(
  initialContext: Partial<OrchestrationContext>,
  callbacks?: OrchestrationCallbacks
): Orchestrator {
  let state: OrchestrationState = 'idle';
  let previousState: OrchestrationState | null = null;
  const subscribers: Array<(state: OrchestrationState, context: OrchestrationContext) => void> = [];
  const checkpoints: Map<string, CheckpointData> = new Map();

  let context: OrchestrationContext = {
    projectId: initialContext.projectId || `proj_${Date.now()}`,
    originalPrompt: initialContext.originalPrompt || '',
    completedPhases: initialContext.completedPhases || [],
    failedPhases: initialContext.failedPhases || [],
    currentIteration: initialContext.currentIteration || 0,
    maxIterations: initialContext.maxIterations || 3,
    timestamps: initialContext.timestamps || {
      started: Date.now(),
      lastUpdated: Date.now(),
    },
    metrics: initialContext.metrics || {
      totalDuration: 0,
      verificationAttempts: 0,
    },
    ...initialContext,
  };

  function updateContext(updates: Partial<OrchestrationContext>): void {
    context = {
      ...context,
      ...updates,
      timestamps: {
        ...context.timestamps,
        lastUpdated: Date.now(),
      },
    };
  }

  function transition(event: OrchestrationEvent): void {
    const transitions = STATE_TRANSITIONS[state];
    let nextState = transitions?.[event.type];

    // Handle missing transitions
    if (nextState === undefined) {
      console.warn(`[Orchestrator] No transition for event ${event.type} in state ${state}`);
      return;
    }

    // Special handling for approval-based transitions
    if (state === 'awaiting-approval' && event.type === 'USER_APPROVE') {
      nextState = getNextStateAfterApproval(context);
    }

    // Special handling for verification complete
    if (state === 'verifying' && event.type === 'VERIFICATION_COMPLETE') {
      const payload = event.payload as { success: boolean; errors?: string[] };
      if (payload.success) {
        nextState = hasMorePhases(context) ? 'planning-phase' : 'complete';
      } else {
        nextState = context.currentIteration < context.maxIterations ? 'refining' : 'failed';
      }
    }

    // Special handling for pause/resume
    if (event.type === 'USER_PAUSE') {
      previousState = state;
    }
    if (event.type === 'USER_RESUME' && previousState) {
      nextState = previousState;
      previousState = null;
    }

    // Perform transition
    const fromState = state;
    state = nextState;

    // Update context based on event
    updateContextFromEvent(event);

    // Notify callbacks
    callbacks?.onStateChange?.(fromState, state, context);

    // State-specific callbacks
    handleStateCallbacks(state, event);

    // Notify subscribers
    for (const subscriber of subscribers) {
      subscriber(state, context);
    }

    // Auto-checkpoint on significant transitions
    if (shouldAutoCheckpoint(fromState, state)) {
      orchestrator.saveCheckpoint('auto');
    }
  }

  function updateContextFromEvent(event: OrchestrationEvent): void {
    switch (event.type) {
      case 'START_RESEARCH':
        updateContext({ originalPrompt: event.payload.prompt });
        break;

      case 'RESEARCH_COMPLETE':
        updateContext({
          researchSessionId: event.payload.sessionId,
          metrics: {
            ...context.metrics,
            researchDuration: Date.now() - context.timestamps.started,
          },
        });
        break;

      case 'PRODUCT_DEFINED':
        updateContext({
          prdId: event.payload.prdId,
          metrics: {
            ...context.metrics,
            planningDuration: (context.metrics.planningDuration || 0) +
              (Date.now() - (context.timestamps.phaseStarted || context.timestamps.started)),
          },
        });
        break;

      case 'ARCHITECTURE_COMPLETE':
        updateContext({ architectureId: event.payload.archId });
        break;

      case 'START_PHASE':
        updateContext({
          currentPhaseId: event.payload.phaseId,
          timestamps: { ...context.timestamps, phaseStarted: Date.now() },
        });
        break;

      case 'PHASE_COMPLETE':
        if (event.payload.success) {
          updateContext({
            completedPhases: [...context.completedPhases, event.payload.phaseId],
            metrics: {
              ...context.metrics,
              implementationDuration: (context.metrics.implementationDuration || 0) +
                (Date.now() - (context.timestamps.phaseStarted || Date.now())),
            },
          });
        } else {
          updateContext({
            failedPhases: [
              ...context.failedPhases,
              { phaseId: event.payload.phaseId, reason: 'Execution failed' },
            ],
          });
        }
        break;

      case 'VERIFICATION_COMPLETE':
        updateContext({
          metrics: {
            ...context.metrics,
            verificationAttempts: context.metrics.verificationAttempts + 1,
          },
        });
        break;

      case 'ERROR':
        updateContext({ error: event.payload.message });
        break;

      case 'RESET':
        updateContext({
          researchSessionId: undefined,
          prdId: undefined,
          architectureId: undefined,
          currentPhaseId: undefined,
          completedPhases: [],
          failedPhases: [],
          currentIteration: 0,
          error: undefined,
          timestamps: { started: Date.now(), lastUpdated: Date.now() },
          metrics: { totalDuration: 0, verificationAttempts: 0 },
        });
        break;
    }
  }

  function handleStateCallbacks(newState: OrchestrationState, event: OrchestrationEvent): void {
    switch (event.type) {
      case 'RESEARCH_COMPLETE':
        callbacks?.onResearchComplete?.(context.researchSessionId!);
        callbacks?.onApprovalNeeded?.('research');
        break;

      case 'PRODUCT_DEFINED':
        callbacks?.onPRDReady?.(context.prdId!);
        callbacks?.onApprovalNeeded?.('prd');
        break;

      case 'ARCHITECTURE_COMPLETE':
        callbacks?.onArchitectureReady?.(context.architectureId!);
        callbacks?.onApprovalNeeded?.('architecture');
        break;

      case 'START_PHASE':
        callbacks?.onPhaseStart?.((event.payload as { phaseId: string }).phaseId);
        break;

      case 'PHASE_COMPLETE': {
        const payload = event.payload as { phaseId: string; success: boolean };
        callbacks?.onPhaseComplete?.(payload.phaseId, payload.success);
        break;
      }

      case 'ERROR':
        callbacks?.onError?.((event.payload as { message: string }).message);
        break;
    }

    if (newState === 'complete') {
      // Update total duration
      updateContext({
        metrics: {
          ...context.metrics,
          totalDuration: Date.now() - context.timestamps.started,
        },
      });
      callbacks?.onComplete?.(context);
    }
  }

  function getNextStateAfterApproval(ctx: OrchestrationContext): OrchestrationState {
    // After research approval, define product
    if (ctx.researchSessionId && !ctx.prdId) {
      return 'defining-product';
    }

    // After PRD approval, generate architecture
    if (ctx.prdId && !ctx.architectureId) {
      return 'generating-architecture';
    }

    // After architecture approval, start first phase
    if (ctx.architectureId && ctx.completedPhases.length === 0 && !ctx.currentPhaseId) {
      return 'planning-phase';
    }

    // After phase verification, check for more phases
    if (hasMorePhases(ctx)) {
      return 'planning-phase';
    }

    return 'complete';
  }

  function hasMorePhases(ctx: OrchestrationContext): boolean {
    // If we have an architecture, check if there are remaining phases
    // This is a simplified check - the actual check would load the architecture
    // and compare completed phases to all phases
    if (!ctx.architectureId) return false;

    // For now, assume we track this externally or the architecture has been loaded
    // A more complete implementation would query the document store
    return false;
  }

  function shouldAutoCheckpoint(from: OrchestrationState, to: OrchestrationState): boolean {
    // Checkpoint on significant state changes
    const significantStates: OrchestrationState[] = [
      'awaiting-approval',
      'complete',
      'failed',
    ];
    return significantStates.includes(to);
  }

  const orchestrator: Orchestrator = {
    get state() {
      return state;
    },

    get context() {
      return { ...context };
    },

    send(event: OrchestrationEvent): void {
      transition(event);
    },

    subscribe(callback): () => void {
      subscribers.push(callback);
      return () => {
        const index = subscribers.indexOf(callback);
        if (index > -1) subscribers.splice(index, 1);
      };
    },

    getAvailableActions(): OrchestrationEvent['type'][] {
      const transitions = STATE_TRANSITIONS[state];
      return Object.keys(transitions || {}) as OrchestrationEvent['type'][];
    },

    saveCheckpoint(reason = 'auto'): CheckpointData {
      const checkpoint: CheckpointData = {
        id: `cp_${Date.now()}`,
        state,
        context: { ...context },
        createdAt: Date.now(),
        reason,
      };
      checkpoints.set(checkpoint.id, checkpoint);
      return checkpoint;
    },

    restoreCheckpoint(checkpointId: string): boolean {
      const checkpoint = checkpoints.get(checkpointId);
      if (!checkpoint) return false;

      state = checkpoint.state;
      context = {
        ...context,
        ...checkpoint.context,
        timestamps: { ...context.timestamps, lastUpdated: Date.now() },
      };

      for (const subscriber of subscribers) {
        subscriber(state, context);
      }

      return true;
    },

    getProgress(): ExecutionProgress {
      const currentIndex = STAGES.findIndex(s =>
        s.state === state ||
        (state === 'awaiting-approval' && s.state === getPreviousActiveState(context)) ||
        (state === 'planning-phase' && s.state === 'executing-phase')
      );

      const completedStages = STAGES.slice(0, Math.max(0, currentIndex)).map(s => s.name);
      const remainingStages = STAGES.slice(currentIndex + 1).map(s => s.name);

      const percentage = STAGES.length > 0
        ? Math.round(((completedStages.length + 0.5) / STAGES.length) * 100)
        : 0;

      return {
        percentage: state === 'complete' ? 100 : Math.min(percentage, 99),
        stage: STAGES[currentIndex]?.name || getStateDescription(state),
        stageDetails: getStateDescription(state),
        completedStages,
        remainingStages,
      };
    },
  };

  return orchestrator;
}

// =============================================================================
// HELPERS
// =============================================================================

function getPreviousActiveState(context: OrchestrationContext): OrchestrationState {
  if (context.completedPhases.length > 0) return 'executing-phase';
  if (context.architectureId) return 'generating-architecture';
  if (context.prdId) return 'defining-product';
  if (context.researchSessionId) return 'researching';
  return 'idle';
}

/**
 * Get human-readable description of a state
 */
export function getStateDescription(state: OrchestrationState): string {
  const descriptions: Record<OrchestrationState, string> = {
    idle: 'Ready to start',
    researching: 'Conducting web research...',
    'defining-product': 'Creating product requirements...',
    'generating-architecture': 'Designing technical architecture...',
    'planning-phase': 'Planning implementation phase...',
    'executing-phase': 'Executing implementation...',
    verifying: 'Verifying build...',
    refining: 'Fixing errors...',
    'awaiting-approval': 'Waiting for your approval',
    paused: 'Paused',
    complete: 'Project complete!',
    failed: 'Failed - manual intervention needed',
  };
  return descriptions[state];
}

/**
 * Check if a state is a terminal state
 */
export function isTerminalState(state: OrchestrationState): boolean {
  return state === 'complete' || state === 'failed';
}

/**
 * Check if a state allows user intervention
 */
export function allowsUserIntervention(state: OrchestrationState): boolean {
  return state === 'awaiting-approval' || state === 'paused' || state === 'failed';
}

/**
 * Get the approval type for awaiting-approval state
 */
export function getApprovalType(context: OrchestrationContext): 'research' | 'prd' | 'architecture' | 'phase' | null {
  if (context.researchSessionId && !context.prdId) return 'research';
  if (context.prdId && !context.architectureId) return 'prd';
  if (context.architectureId && context.completedPhases.length === 0) return 'architecture';
  if (context.currentPhaseId) return 'phase';
  return null;
}
