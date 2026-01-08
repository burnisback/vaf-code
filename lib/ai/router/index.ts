/**
 * Prompt Router
 *
 * Routes user messages to appropriate agents based on intent and complexity.
 */

import { classifyIntent, quickIntentCheck, type Intent, type ClassificationResult } from './classifier';
import { analyzeComplexity, getRequiredStageNames, estimateTokens, type ComplexityAnalysis, type PipelineType } from './complexity';
import { buildAgentChain, getParallelGroups, countInvocations, type AgentChain } from './chainBuilder';

// Re-export types and utilities
export {
  // Classifier
  classifyIntent,
  quickIntentCheck,
  type Intent,
  type ClassificationResult,

  // Complexity
  analyzeComplexity,
  getRequiredStageNames,
  estimateTokens,
  type ComplexityAnalysis,
  type PipelineType,

  // Chain builder
  buildAgentChain,
  getParallelGroups,
  countInvocations,
  type AgentChain,
};

/**
 * Route result containing all routing information
 */
export interface RouteResult {
  intent: Intent;
  classification: ClassificationResult;
  complexity: ComplexityAnalysis;
  chain: AgentChain;
  estimatedTokens: number;
  stages: string[];
}

/**
 * Main routing function - analyzes message and returns full routing info
 */
export async function routeToAgent(
  message: string,
  context?: {
    previousMessages?: string[];
    projectContext?: string;
    fileCount?: number;
    hasExistingCode?: boolean;
    isNewProject?: boolean;
  }
): Promise<RouteResult> {
  // Step 1: Classify intent
  const classification = await classifyIntent(message, {
    previousMessages: context?.previousMessages,
    projectContext: context?.projectContext,
  });

  // Step 2: Analyze complexity
  const complexity = analyzeComplexity(message, {
    fileCount: context?.fileCount,
    hasExistingCode: context?.hasExistingCode,
    isNewProject: context?.isNewProject,
  });

  // Use the more complex assessment if AI classification differs
  const finalPipeline =
    classification.complexity === 'complex' || complexity.level === 'complex'
      ? 'FULL_GOVERNANCE'
      : complexity.pipeline;

  // Step 3: Build agent chain
  const chain = buildAgentChain(classification.intent, finalPipeline);

  // Step 4: Compile results
  return {
    intent: classification.intent,
    classification,
    complexity: {
      ...complexity,
      pipeline: finalPipeline,
    },
    chain,
    estimatedTokens: estimateTokens(finalPipeline),
    stages: getRequiredStageNames(finalPipeline),
  };
}

/**
 * Quick routing without AI classification (for performance)
 */
export function quickRoute(
  message: string,
  context?: {
    fileCount?: number;
    hasExistingCode?: boolean;
    isNewProject?: boolean;
  }
): RouteResult {
  // Use quick intent check
  const intent = quickIntentCheck(message);

  // Analyze complexity
  const complexity = analyzeComplexity(message, context);

  // Build chain
  const chain = buildAgentChain(intent, complexity.pipeline);

  return {
    intent,
    classification: {
      intent,
      confidence: 0.7, // Lower confidence for quick route
      reasoning: 'Quick classification based on keywords',
      suggestedAgents: chain.steps.map(s => `vaf-${s.agent}`),
      complexity: complexity.level,
    },
    complexity,
    chain,
    estimatedTokens: estimateTokens(complexity.pipeline),
    stages: getRequiredStageNames(complexity.pipeline),
  };
}

/**
 * Get the first agent to invoke for a message
 */
export function getFirstAgent(route: RouteResult): string {
  const firstStep = route.chain.steps[0];
  return firstStep ? `vaf-${firstStep.agent}` : 'vaf-pm';
}

/**
 * Check if a route requires full governance
 */
export function requiresFullGovernance(route: RouteResult): boolean {
  return (
    route.complexity.pipeline === 'FULL_GOVERNANCE' ||
    route.complexity.securitySensitive
  );
}
