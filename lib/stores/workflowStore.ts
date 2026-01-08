import { create } from 'zustand';
import type { OrchestratorEvent } from '@/lib/ai/orchestrator';

/**
 * Workflow State Types
 */
export type WorkflowPhase = 
  | 'idle'
  | 'analyzing'
  | 'planning'
  | 'implementing'
  | 'verifying'
  | 'complete'
  | 'error';

export interface WorkflowStep {
  id: string;
  agent?: string;
  phase: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  message?: string;
  timestamp: number;
}

export interface WorkflowState {
  phase: WorkflowPhase;
  currentAgent: string | null;
  steps: WorkflowStep[];
  error: string | null;
  isActive: boolean;
}

export interface WorkflowActions {
  setPhase: (phase: WorkflowPhase) => void;
  setCurrentAgent: (agent: string | null) => void;
  addStep: (step: Omit<WorkflowStep, 'id' | 'timestamp'>) => void;
  updateStep: (id: string, updates: Partial<WorkflowStep>) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  handleOrchestratorEvent: (event: OrchestratorEvent) => void;
}

const initialState: WorkflowState = {
  phase: 'idle',
  currentAgent: null,
  steps: [],
  error: null,
  isActive: false,
};

/**
 * Workflow Store
 * Manages the state of multi-agent orchestration workflows
 */
export const useWorkflowStore = create<WorkflowState & WorkflowActions>((set, get) => ({
  ...initialState,

  setPhase: (phase) => set({ phase, isActive: phase !== 'idle' && phase !== 'complete' && phase !== 'error' }),
  
  setCurrentAgent: (agent) => set({ currentAgent: agent }),
  
  addStep: (step) => set((state) => ({
    steps: [
      ...state.steps,
      {
        ...step,
        id: 'step-' + performance.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9),
        timestamp: performance.now(),
      },
    ],
  })),
  
  updateStep: (id, updates) => set((state) => ({
    steps: state.steps.map((step) =>
      step.id === id ? { ...step, ...updates } : step
    ),
  })),
  
  setError: (error) => set({ error, phase: error ? 'error' : get().phase }),
  
  reset: () => set(initialState),

  handleOrchestratorEvent: (event) => {
    const { setPhase, setCurrentAgent, addStep, setError } = get();

    switch (event.type) {
      case 'STATE_CHANGE':
        if (event.state) {
          const phaseMap: Record<string, WorkflowPhase> = {
            ANALYZING: 'analyzing',
            PLANNING: 'planning',
            IMPLEMENTING: 'implementing',
            VERIFYING: 'verifying',
            COMPLETE: 'complete',
            ERROR: 'error',
          };
          setPhase(phaseMap[event.state] || 'idle');
        }
        break;

      case 'AGENT_INVOKED':
        if (event.agent) {
          setCurrentAgent(event.agent);
          addStep({
            agent: event.agent,
            phase: event.phase || 'unknown',
            status: 'active',
            message: 'Invoking ' + event.agent,
          });
        }
        break;

      case 'AGENT_RESPONSE':
        if (event.agent) {
          const steps = get().steps;
          const activeStep = steps.find(
            (s) => s.agent === event.agent && s.status === 'active'
          );
          if (activeStep) {
            get().updateStep(activeStep.id, {
              status: 'completed',
              message: (event.response as Record<string, string>)?.summary || 'Completed',
            });
          }
        }
        break;

      case 'COMPLETE':
        setPhase('complete');
        setCurrentAgent(null);
        break;

      case 'ERROR':
        setError((event.error as Record<string, string>)?.message || 'Unknown error occurred');
        break;

      default:
        // Handle other event types as needed
        break;
    }
  },
}));
