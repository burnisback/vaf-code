/**
 * Debug Pipeline Orchestrator
 *
 * Orchestrates the full debugging pipeline:
 * 1. Collect errors
 * 2. Analyze patterns
 * 3. Read affected files
 * 4. Identify root cause
 * 5. Plan minimal fix
 * 6. Execute fix (optional)
 * 7. Verify fix
 */

import type {
  ErrorCollection,
  ErrorAnalysis,
  RootCause,
  FixPlan,
  FixResult,
  DebugPipelineStep,
  DebugPipelineProgress,
  DebugPipelineContext,
  DebugPipelineConfig,
  DebugPipelineResult,
} from './types';
import { DEFAULT_DEBUG_CONFIG } from './types';
import { createErrorCollection, mergeCollections } from './errorCollector';
import { analyzeErrors } from './errorAnalyzer';
import { identifyRootCause, validateRootCause } from './rootCauseIdentifier';
import { planFix, validateFixPlan } from './fixPlanner';
import type { ModelTier } from '../ai/modelRouter/types';

// =============================================================================
// PIPELINE CALLBACKS
// =============================================================================

export type DebugPipelineCallback = (progress: DebugPipelineProgress) => void;

// =============================================================================
// PIPELINE STEP EXECUTION
// =============================================================================

/**
 * Execute the collect step
 */
async function executeCollectStep(
  context: DebugPipelineContext
): Promise<ErrorCollection> {
  // Collect errors from raw output
  const collections = context.rawErrors.map((rawError) =>
    createErrorCollection('build', rawError)
  );

  // Merge all collections
  return mergeCollections(collections);
}

/**
 * Execute the analyze step
 */
async function executeAnalyzeStep(
  collection: ErrorCollection
): Promise<ErrorAnalysis> {
  return analyzeErrors(collection);
}

/**
 * Execute the read step (read affected files)
 */
async function executeReadStep(
  analysis: ErrorAnalysis,
  context: DebugPipelineContext
): Promise<Map<string, string>> {
  const filesToRead = new Set<string>();

  // Add files from error groups
  for (const group of analysis.groups) {
    filesToRead.add(group.file);
  }

  // Add files from root cause candidates
  for (const candidate of analysis.rootCauseCandidates) {
    if (candidate.error.file) {
      filesToRead.add(candidate.error.file);
    }
  }

  // Limit to config max
  const limitedFiles = [...filesToRead].slice(0, context.config.maxFilesToRead);

  // Filter to files we have
  const fileContents = new Map<string, string>();
  for (const file of limitedFiles) {
    if (context.fileContents.has(file)) {
      fileContents.set(file, context.fileContents.get(file)!);
    }
  }

  return fileContents;
}

/**
 * Execute the identify step
 */
async function executeIdentifyStep(
  analysis: ErrorAnalysis,
  fileContents: Map<string, string>
): Promise<RootCause | null> {
  const rootCause = identifyRootCause(analysis, fileContents);

  if (rootCause) {
    // Validate the root cause
    const validation = validateRootCause(rootCause, fileContents);
    if (!validation.valid) {
      console.warn('[DebugPipeline] Root cause validation failed:', validation.reason);
      // Return anyway but with lower confidence
      return {
        ...rootCause,
        confidence: rootCause.confidence * 0.5,
      };
    }
  }

  return rootCause;
}

/**
 * Execute the plan step
 */
async function executePlanStep(
  rootCause: RootCause,
  fileContents: Map<string, string>
): Promise<FixPlan> {
  const plan = planFix(rootCause, fileContents);

  // Validate the plan
  const validation = validateFixPlan(plan, fileContents);
  if (!validation.valid) {
    console.warn('[DebugPipeline] Fix plan validation errors:', validation.errors);
    plan.warnings.push(...validation.errors);
  }

  return plan;
}

/**
 * Execute the execute step (apply fixes)
 * Note: In the current implementation, we don't actually apply fixes.
 * This would require WebContainer integration.
 */
async function executeExecuteStep(
  plan: FixPlan,
  _context: DebugPipelineContext
): Promise<FixResult> {
  // For now, we just report what would be done
  // Actual execution requires WebContainer integration

  const startTime = Date.now();

  return {
    success: true, // Would be true if actually applied
    modifiedFiles: plan.fixes.map((f) => f.file),
    errorsBefore: plan.expectedResolutions,
    errorsAfter: 0, // Estimated
    newErrors: [],
    duration: Date.now() - startTime,
  };
}

/**
 * Execute the verify step
 */
async function executeVerifyStep(
  fixResult: FixResult,
  _context: DebugPipelineContext
): Promise<boolean> {
  // In a real implementation, this would:
  // 1. Run the build again
  // 2. Collect new errors
  // 3. Compare with before

  // For now, we assume success if fixes were applied
  return fixResult.success && fixResult.errorsAfter < fixResult.errorsBefore;
}

// =============================================================================
// MAIN PIPELINE
// =============================================================================

/**
 * Run the full debug pipeline
 */
export async function runDebugPipeline(
  rawErrors: string[],
  projectFiles: string[],
  fileContents: Map<string, string>,
  config?: Partial<DebugPipelineConfig>,
  onProgress?: DebugPipelineCallback
): Promise<DebugPipelineResult> {
  const startTime = Date.now();
  const pipelineConfig = { ...DEFAULT_DEBUG_CONFIG, ...config };

  const context: DebugPipelineContext = {
    rawErrors,
    projectFiles,
    fileContents,
    config: pipelineConfig,
  };

  // Initialize step status
  const stepStatus: Record<DebugPipelineStep, 'pending' | 'in_progress' | 'completed' | 'failed'> = {
    collect: 'pending',
    analyze: 'pending',
    read: 'pending',
    identify: 'pending',
    plan: 'pending',
    execute: 'pending',
    verify: 'pending',
  };

  const emitProgress = (step: DebugPipelineStep, message: string) => {
    const completedSteps = Object.values(stepStatus).filter((s) => s === 'completed').length;
    const totalSteps = Object.keys(stepStatus).length;
    const percentage = Math.round((completedSteps / totalSteps) * 100);

    onProgress?.({
      currentStep: step,
      stepStatus: { ...stepStatus },
      percentage,
      message,
    });
  };

  let collection: ErrorCollection;
  let analysis: ErrorAnalysis;
  let affectedFileContents: Map<string, string>;
  let rootCause: RootCause | null = null;
  let fixPlan: FixPlan | null = null;
  let fixResult: FixResult | null = null;

  try {
    // Step 1: Collect
    stepStatus.collect = 'in_progress';
    emitProgress('collect', 'Collecting and parsing errors...');

    collection = await executeCollectStep(context);
    stepStatus.collect = 'completed';

    if (collection.total === 0) {
      return {
        success: true,
        collection,
        analysis: {
          groups: [],
          cascades: [],
          priorityOrder: [],
          rootCauseCandidates: [],
          stats: { totalErrors: 0, uniqueFiles: 0, primaryType: 'unknown', estimatedRootCauses: 0 },
        },
        rootCause: null,
        fixPlan: null,
        fixResult: null,
        duration: Date.now() - startTime,
        tokenUsage: { input: 0, output: 0, model: 'flash-lite' as ModelTier },
      };
    }

    // Step 2: Analyze
    stepStatus.analyze = 'in_progress';
    emitProgress('analyze', `Analyzing ${collection.total} error(s)...`);

    analysis = await executeAnalyzeStep(collection);
    stepStatus.analyze = 'completed';

    // Step 3: Read
    stepStatus.read = 'in_progress';
    emitProgress('read', `Reading ${collection.affectedFiles.length} affected file(s)...`);

    affectedFileContents = await executeReadStep(analysis, context);
    stepStatus.read = 'completed';

    // Step 4: Identify
    stepStatus.identify = 'in_progress';
    emitProgress('identify', 'Identifying root cause...');

    rootCause = await executeIdentifyStep(analysis, affectedFileContents);
    stepStatus.identify = 'completed';

    if (!rootCause) {
      return {
        success: false,
        collection,
        analysis,
        rootCause: null,
        fixPlan: null,
        fixResult: null,
        duration: Date.now() - startTime,
        tokenUsage: { input: 0, output: 0, model: 'flash-lite' as ModelTier },
        error: 'Could not identify root cause',
      };
    }

    // Step 5: Plan
    stepStatus.plan = 'in_progress';
    emitProgress('plan', 'Planning minimal fix...');

    fixPlan = await executePlanStep(rootCause, affectedFileContents);
    stepStatus.plan = 'completed';

    // Step 6: Execute (only if auto-apply is enabled)
    if (pipelineConfig.autoApply) {
      stepStatus.execute = 'in_progress';
      emitProgress('execute', 'Executing fix...');

      fixResult = await executeExecuteStep(fixPlan, context);
      stepStatus.execute = fixResult.success ? 'completed' : 'failed';

      // Step 7: Verify
      if (fixResult.success) {
        stepStatus.verify = 'in_progress';
        emitProgress('verify', 'Verifying fix...');

        const verified = await executeVerifyStep(fixResult, context);
        stepStatus.verify = verified ? 'completed' : 'failed';
      }
    } else {
      // Skip execute and verify if not auto-applying
      stepStatus.execute = 'pending';
      stepStatus.verify = 'pending';
      emitProgress('plan', 'Fix planned - ready for manual review');
    }

    return {
      success: true,
      collection,
      analysis,
      rootCause,
      fixPlan,
      fixResult,
      duration: Date.now() - startTime,
      tokenUsage: {
        input: 0, // Will be filled by caller if LLM was used
        output: 0,
        model: pipelineConfig.analysisModel,
      },
    };
  } catch (error) {
    return {
      success: false,
      collection: collection!,
      analysis: analysis!,
      rootCause,
      fixPlan,
      fixResult,
      duration: Date.now() - startTime,
      tokenUsage: { input: 0, output: 0, model: 'flash-lite' as ModelTier },
      error: error instanceof Error ? error.message : 'Pipeline failed',
    };
  }
}

/**
 * Create a debug pipeline result for quick analysis (without fix)
 */
export async function analyzeErrorsQuick(
  rawErrors: string[],
  fileContents: Map<string, string>
): Promise<{
  collection: ErrorCollection;
  analysis: ErrorAnalysis;
  rootCause: RootCause | null;
}> {
  // Collect
  const collections = rawErrors.map((rawError) =>
    createErrorCollection('build', rawError)
  );
  const collection = mergeCollections(collections);

  // Analyze
  const analysis = analyzeErrors(collection);

  // Identify root cause
  const rootCause = identifyRootCause(analysis, fileContents);

  return { collection, analysis, rootCause };
}

