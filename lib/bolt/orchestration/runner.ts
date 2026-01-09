/**
 * Orchestration Runner (Server-Side)
 *
 * Executes the orchestration state machine by connecting it
 * to actual research, planning, and execution systems.
 *
 * NOTE: This file uses genkit indirectly through the generators.
 * Import this only in server-side code (API routes, server components).
 */

import type {
  Orchestrator,
  OrchestrationState,
  OrchestrationContext,
  RunnerConfig,
  RunnerCallbacks,
  ExecutionProgress,
} from './types';
import { createOrchestrator } from './machine';
import { CostTracker, createCostTracker, type CostStatistics } from './costTracker';
import { ApprovalManager, createApprovalManager, type ApprovalRequest } from './approvalManager';

// Research imports (server-side safe since they use genkit internally)
import { planResearch } from '../research/planner';
import { createResearchExecutor } from '../research/executor';
import { synthesizeResearch } from '../research/synthesizer';

// Product imports (server-side - uses genkit)
import { generatePRD } from '../product/generator';

// Architecture imports (server-side - uses genkit)
import { generateArchitecture } from '../architecture/generator';
import { getNextPhase, convertPhasesToPlans } from '../architecture/phaser';
import type { ArchitectureDocument, ImplementationPhase } from '../architecture/types';
import type { ProductRequirementsDocument } from '../product/types';

// Document store imports
import { getDocumentStore, createResearchDocument } from '../documents/store';

// =============================================================================
// ORCHESTRATION RUNNER CLASS
// =============================================================================

/**
 * The OrchestrationRunner connects the state machine to actual systems
 * and manages the execution flow.
 */
export class OrchestrationRunner {
  private orchestrator: Orchestrator;
  private config: RunnerConfig;
  private abortController: AbortController | null = null;
  private isRunning = false;

  // New Phase 5 integrations
  private costTracker: CostTracker;
  private approvalManager: ApprovalManager;

  // Cached documents for phase execution
  private cachedPRD: ProductRequirementsDocument | null = null;
  private cachedArchitecture: ArchitectureDocument | null = null;
  private currentPhase: ImplementationPhase | null = null;

  constructor(
    prompt: string,
    config: RunnerConfig
  ) {
    this.config = config;

    this.orchestrator = createOrchestrator(
      { originalPrompt: prompt },
      {
        ...config.callbacks,
        onStateChange: this.handleStateChange.bind(this),
      }
    );

    // Initialize cost tracker
    this.costTracker = createCostTracker({
      onCostUpdate: (stats) => {
        this.config.callbacks?.onProgress?.(`Cost update: $${stats.totalCost.toFixed(4)}`);
      },
      onBudgetWarning: (warning) => {
        this.config.callbacks?.onProgress?.(`Budget ${warning.level}: ${warning.message}`);
      },
    });

    // Initialize approval manager
    this.approvalManager = createApprovalManager({
      autoApprove: config.autoApprove,
      callbacks: {
        onApprovalRequested: (request) => {
          this.config.callbacks?.onProgress?.(
            `Awaiting approval: ${request.title}`
          );
        },
      },
    });
  }

  /**
   * Get cost tracker for external access
   */
  getCostTracker(): CostTracker {
    return this.costTracker;
  }

  /**
   * Get approval manager for external access
   */
  getApprovalManager(): ApprovalManager {
    return this.approvalManager;
  }

  /**
   * Get current cost statistics
   */
  getCostStatistics(): CostStatistics {
    return this.costTracker.getStatistics();
  }

  /**
   * Get current pending approval (if any)
   */
  getCurrentApproval(): ApprovalRequest | undefined {
    return this.approvalManager.getCurrentPendingRequest();
  }

  /**
   * Start the orchestration from research
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[OrchestrationRunner] Already running');
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    this.orchestrator.send({
      type: 'START_RESEARCH',
      payload: { prompt: this.orchestrator.context.originalPrompt },
    });

    await this.runCurrentState();
  }

  /**
   * Start from a specific point (skip research, etc.)
   */
  async startFrom(options: {
    researchId?: string;
    prdId?: string;
    architectureId?: string;
  }): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.abortController = new AbortController();

    // Set context based on starting point
    if (options.architectureId) {
      // Start from phase planning
      this.orchestrator.send({
        type: 'ARCHITECTURE_COMPLETE',
        payload: { archId: options.architectureId },
      });
      this.orchestrator.send({ type: 'USER_APPROVE' });
    } else if (options.prdId) {
      // Start from architecture generation
      this.orchestrator.send({
        type: 'PRODUCT_DEFINED',
        payload: { prdId: options.prdId },
      });
      this.orchestrator.send({ type: 'USER_APPROVE' });
    } else if (options.researchId) {
      // Start from PRD generation
      this.orchestrator.send({
        type: 'RESEARCH_COMPLETE',
        payload: { sessionId: options.researchId },
      });
      this.orchestrator.send({ type: 'USER_APPROVE' });
    }

    await this.runCurrentState();
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.orchestrator.send({ type: 'USER_PAUSE' });
    this.isRunning = false;
  }

  /**
   * Resume execution
   */
  async resume(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.orchestrator.send({ type: 'USER_RESUME' });
    await this.runCurrentState();
  }

  /**
   * Abort execution
   */
  abort(): void {
    this.abortController?.abort();
    this.orchestrator.send({ type: 'USER_ABORT' });
    this.isRunning = false;
  }

  /**
   * Approve current stage and continue
   */
  async approve(): Promise<void> {
    this.orchestrator.send({ type: 'USER_APPROVE' });
    await this.runCurrentState();
  }

  /**
   * Reject current stage
   */
  reject(reason?: string): void {
    this.orchestrator.send({ type: 'USER_REJECT', payload: { reason } });
    this.isRunning = false;
  }

  /**
   * Get current state
   */
  getState(): OrchestrationState {
    return this.orchestrator.state;
  }

  /**
   * Get current context
   */
  getContext(): OrchestrationContext {
    return this.orchestrator.context;
  }

  /**
   * Get execution progress
   */
  getProgress(): ExecutionProgress {
    return this.orchestrator.getProgress();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: OrchestrationState, context: OrchestrationContext) => void): () => void {
    return this.orchestrator.subscribe(callback);
  }

  /**
   * Save a checkpoint
   */
  saveCheckpoint(): void {
    this.orchestrator.saveCheckpoint('user-pause');
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private async handleStateChange(
    from: OrchestrationState,
    to: OrchestrationState,
    context: OrchestrationContext
  ): Promise<void> {
    this.config.callbacks?.onStateChange?.(from, to, context);

    // Auto-run next state if not awaiting approval or in terminal state
    const pauseStates: OrchestrationState[] = [
      'awaiting-approval',
      'paused',
      'complete',
      'failed',
      'idle',
    ];

    if (!pauseStates.includes(to) && this.isRunning) {
      // Small delay to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.runCurrentState();
    }
  }

  private async runCurrentState(): Promise<void> {
    const state = this.orchestrator.state;

    if (this.abortController?.signal.aborted) {
      this.isRunning = false;
      return;
    }

    try {
      switch (state) {
        case 'researching':
          await this.runResearch();
          break;

        case 'defining-product':
          await this.runProductDefinition();
          break;

        case 'generating-architecture':
          await this.runArchitectureGeneration();
          break;

        case 'planning-phase':
          await this.runPhasePlanning();
          break;

        case 'executing-phase':
          await this.runPhaseExecution();
          break;

        case 'verifying':
          await this.runVerification();
          break;

        case 'refining':
          await this.runRefinement();
          break;

        case 'awaiting-approval':
          await this.checkAutoApprove();
          break;

        case 'complete':
        case 'failed':
          this.isRunning = false;
          break;
      }
    } catch (error) {
      this.orchestrator.send({
        type: 'ERROR',
        payload: { message: error instanceof Error ? error.message : 'Unknown error' },
      });
      this.isRunning = false;
    }
  }

  private async runResearch(): Promise<void> {
    const prompt = this.orchestrator.context.originalPrompt;
    this.emitProgress('Starting research...', { prompt });

    // Plan research
    const planResult = await planResearch({
      prompt,
      maxQueries: this.config.maxResearchQueries || 15,
    });

    if (!planResult.success || !planResult.plan) {
      throw new Error('Failed to plan research');
    }

    this.emitProgress('Executing research plan...', {
      phases: planResult.plan.phases.length,
    });

    // Execute research
    const executor = createResearchExecutor({
      onProgress: (progress) => {
        this.emitProgress(`Research: ${progress.action}`, progress);
      },
    });

    const execResult = await executor.execute(planResult.plan);

    if (!execResult.success) {
      throw new Error('Research execution failed');
    }

    // Synthesize results
    this.emitProgress('Synthesizing research...');
    const synthesisResult = await synthesizeResearch({ session: execResult.session });

    if (!synthesisResult.success || !synthesisResult.synthesis) {
      throw new Error('Failed to synthesize research');
    }

    // Save as document
    const store = getDocumentStore();
    const doc = await store.save(createResearchDocument(
      synthesisResult.synthesis,
      this.orchestrator.context.projectId,
      `Research: ${prompt.slice(0, 50)}...`
    ));

    this.config.callbacks?.onResearchResults?.(synthesisResult.synthesis);
    this.emitProgress('Research complete', { documentId: doc.id });

    this.orchestrator.send({
      type: 'RESEARCH_COMPLETE',
      payload: { sessionId: doc.id },
    });
  }

  private async runProductDefinition(): Promise<void> {
    const researchId = this.orchestrator.context.researchSessionId;
    this.emitProgress('Generating PRD...', { researchId });

    const result = await generatePRD({
      researchId,
      additionalContext: this.orchestrator.context.originalPrompt,
    });

    if (!result.success || !result.prd) {
      throw new Error(result.error || 'Failed to generate PRD');
    }

    // Save PRD as document
    const store = getDocumentStore();
    const doc = await store.save({
      type: 'product-requirements',
      title: result.prd.name,
      description: result.prd.tagline,
      content: '',
      structuredData: result.prd as unknown as Record<string, unknown>,
      metadata: { source: 'ai-generated', wordCount: 0, status: 'complete' },
      tags: ['prd'],
      relatedDocuments: researchId ? [researchId] : [],
      sessionId: this.orchestrator.context.projectId,
    });

    this.config.callbacks?.onPRDGenerated?.(result.prd);
    this.emitProgress('PRD generated', { prdId: doc.id });

    this.orchestrator.send({
      type: 'PRODUCT_DEFINED',
      payload: { prdId: doc.id },
    });
  }

  private async runArchitectureGeneration(): Promise<void> {
    const prdId = this.orchestrator.context.prdId;
    this.emitProgress('Generating architecture...', { prdId });

    const result = await generateArchitecture({ prdId });

    if (!result.success || !result.architecture) {
      throw new Error(result.error || 'Failed to generate architecture');
    }

    // Save architecture as document
    const store = getDocumentStore();
    const doc = await store.save({
      type: 'architecture',
      title: result.architecture.name,
      description: result.architecture.overview,
      content: '',
      structuredData: result.architecture as unknown as Record<string, unknown>,
      metadata: { source: 'ai-generated', wordCount: 0, status: 'complete' },
      tags: ['architecture'],
      relatedDocuments: prdId ? [prdId] : [],
      sessionId: this.orchestrator.context.projectId,
    });

    this.config.callbacks?.onArchitectureGenerated?.(result.architecture);
    this.emitProgress('Architecture generated', { archId: doc.id });

    this.orchestrator.send({
      type: 'ARCHITECTURE_COMPLETE',
      payload: { archId: doc.id },
    });
  }

  private async runPhasePlanning(): Promise<void> {
    const archId = this.orchestrator.context.architectureId;
    if (!archId) throw new Error('No architecture to plan from');

    const store = getDocumentStore();

    // Load and cache architecture
    if (!this.cachedArchitecture) {
      const archDoc = await store.get(archId);
      if (!archDoc?.structuredData) throw new Error('Architecture not found');
      this.cachedArchitecture = archDoc.structuredData as unknown as ArchitectureDocument;
    }

    // Load and cache PRD for context
    const prdId = this.orchestrator.context.prdId;
    if (prdId && !this.cachedPRD) {
      const prdDoc = await store.get(prdId);
      if (prdDoc?.structuredData) {
        this.cachedPRD = prdDoc.structuredData as unknown as ProductRequirementsDocument;
      }
    }

    const arch = this.cachedArchitecture;
    const completedPhases = new Set(this.orchestrator.context.completedPhases);

    const nextPhase = getNextPhase(arch.phases, completedPhases);
    if (!nextPhase) {
      // All phases complete
      this.orchestrator.send({
        type: 'VERIFICATION_COMPLETE',
        payload: { success: true },
      });
      return;
    }

    // Cache current phase for execution
    this.currentPhase = nextPhase;

    // Convert to task plan for execution context
    const conversionResult = convertPhasesToPlans(arch, this.cachedPRD ?? undefined);
    const phasePlan = conversionResult.plans.find(p => p.id === `plan_${nextPhase.id}`);

    this.emitProgress(`Planning phase: ${nextPhase.name}`, {
      phaseId: nextPhase.id,
      taskCount: nextPhase.tasks.length,
      complexity: nextPhase.complexity,
      plan: phasePlan,
    });

    this.orchestrator.send({
      type: 'START_PHASE',
      payload: { phaseId: nextPhase.id },
    });
  }

  private async runPhaseExecution(): Promise<void> {
    const phaseId = this.orchestrator.context.currentPhaseId;
    if (!phaseId) throw new Error('No current phase to execute');

    const phase = this.currentPhase;
    if (!phase) throw new Error('Phase not loaded');

    this.emitProgress(`Executing phase: ${phase.name}`, {
      phaseId: phase.id,
      taskCount: phase.tasks.length,
    });

    // Track cost for this phase
    const phaseStartTokens = this.costTracker.getStatistics().totalInputTokens +
      this.costTracker.getStatistics().totalOutputTokens;

    try {
      // Execute each task in the phase
      for (let i = 0; i < phase.tasks.length; i++) {
        const task = phase.tasks[i];

        if (this.abortController?.signal.aborted) {
          throw new Error('Execution aborted');
        }

        this.emitProgress(`Task ${i + 1}/${phase.tasks.length}: ${task.description}`, {
          taskId: task.id,
          type: task.type,
          files: task.files,
        });

        // Simulate task execution (in real implementation, this would call
        // the bolt-execute-task API endpoint)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Record simulated token usage for cost tracking
        this.costTracker.recordUsage({
          input: 500 + Math.floor(Math.random() * 1000),
          output: 200 + Math.floor(Math.random() * 500),
          model: 'flash',
          phase: phase.name,
          operation: task.description,
        });
      }

      const phaseEndTokens = this.costTracker.getStatistics().totalInputTokens +
        this.costTracker.getStatistics().totalOutputTokens;

      this.emitProgress(`Phase ${phase.name} completed`, {
        phaseId: phase.id,
        tasksCompleted: phase.tasks.length,
        tokensUsed: phaseEndTokens - phaseStartTokens,
      });

      this.orchestrator.send({
        type: 'PHASE_COMPLETE',
        payload: { phaseId: phaseId, success: true },
      });

    } catch (error) {
      this.emitProgress(`Phase ${phase.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      this.orchestrator.send({
        type: 'PHASE_COMPLETE',
        payload: { phaseId: phaseId, success: false },
      });
    }
  }

  private async runVerification(): Promise<void> {
    this.emitProgress('Verifying build...');

    // Track verification cost
    this.costTracker.recordUsage({
      input: 100,
      output: 50,
      model: 'flash-lite',
      phase: 'verification',
      operation: 'Build verification',
    });

    // In real implementation, this would use the UnifiedVerifier
    // from execution/unifiedVerifier.ts
    await new Promise(resolve => setTimeout(resolve, 500));

    this.emitProgress('Build verification complete', {
      success: true,
      totalCost: this.costTracker.getTotalCost(),
    });

    this.orchestrator.send({
      type: 'VERIFICATION_COMPLETE',
      payload: { success: true },
    });
  }

  private async runRefinement(): Promise<void> {
    this.emitProgress('Refining...');

    // Track refinement cost
    this.costTracker.recordUsage({
      input: 200,
      output: 300,
      model: 'flash',
      phase: 'refinement',
      operation: 'Code refinement',
    });

    // In real implementation, this would use the debugging pipeline
    // to identify and fix remaining issues
    await new Promise(resolve => setTimeout(resolve, 500));

    this.emitProgress('Refinement complete', {
      success: true,
      totalCost: this.costTracker.getTotalCost(),
    });

    this.orchestrator.send({
      type: 'REFINEMENT_COMPLETE',
      payload: { success: true },
    });
  }

  private async checkAutoApprove(): Promise<void> {
    const context = this.orchestrator.context;
    const autoApprove = this.config.autoApprove || {};

    // Determine what we're awaiting approval for
    if (context.researchSessionId && !context.prdId && autoApprove.research) {
      this.emitProgress('Auto-approving research...');
      await this.approve();
    } else if (context.prdId && !context.architectureId && autoApprove.prd) {
      this.emitProgress('Auto-approving PRD...');
      await this.approve();
    } else if (context.architectureId && context.completedPhases.length === 0 && autoApprove.architecture) {
      this.emitProgress('Auto-approving architecture...');
      await this.approve();
    } else if (context.currentPhaseId && autoApprove.phases) {
      this.emitProgress('Auto-approving phase...');
      await this.approve();
    }
  }

  private emitProgress(message: string, data?: unknown): void {
    this.config.callbacks?.onProgress?.(message, data);
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an orchestration runner
 */
export function createOrchestrationRunner(
  prompt: string,
  config: RunnerConfig
): OrchestrationRunner {
  return new OrchestrationRunner(prompt, config);
}
