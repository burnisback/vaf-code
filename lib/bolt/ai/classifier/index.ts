/**
 * Request Classifier
 *
 * Classifies user requests to determine the appropriate handling mode.
 * This enables intelligent routing between question mode, simple mode,
 * complex mode, and mega-complex mode.
 *
 * Two classification strategies available:
 * 1. classifyRequest() - Fast, keyword-based (sync)
 * 2. classifyRequestSmart() - LLM-based with keyword fallback (async, recommended)
 */

import {
  ClassificationResult,
  ClassifierConfig,
  DEFAULT_CLASSIFIER_CONFIG,
  RequestMode,
  RequestDomain,
  MegaComplexIndicators,
  QUESTION_PATTERNS,
  FILE_INDICATOR_KEYWORDS,
  DOMAIN_KEYWORDS,
  COMPLEXITY_KEYWORDS,
  RESEARCH_KEYWORDS,
  PRODUCT_KEYWORDS,
  SCALE_KEYWORDS,
  IMPLEMENTATION_KEYWORDS,
} from './types';

import { classifyWithLLM, type LLMClassifierOptions } from './llmClassifier';

// Re-export all types
export * from './types';
export { classifyWithLLM, type LLMClassifierOptions } from './llmClassifier';

// =============================================================================
// MAIN CLASSIFIER FUNCTION
// =============================================================================

/**
 * Classify a user request to determine handling mode
 */
export function classifyRequest(
  prompt: string,
  config: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG
): ClassificationResult {
  const lowerPrompt = prompt.toLowerCase();

  // 1. Check for question patterns first
  if (isQuestion(prompt)) {
    return {
      mode: 'question',
      estimatedFiles: 0,
      domains: [],
      confidence: 0.9,
      reasoning: 'Request appears to be a question, not a code generation task',
      detectedKeywords: [],
    };
  }

  // 2. Check for mega-complex indicators
  const megaComplexIndicators = detectMegaComplexIndicators(lowerPrompt);
  if (isMegaComplex(megaComplexIndicators)) {
    return {
      mode: 'mega-complex',
      estimatedFiles: 20, // Large projects typically have many files
      domains: extractDomains(lowerPrompt),
      confidence: 0.85,
      reasoning: `Mega-complex scenario detected: requires research (${megaComplexIndicators.researchKeywords.join(', ')}), product definition, and multi-phase implementation`,
      detectedKeywords: [
        ...megaComplexIndicators.researchKeywords,
        ...megaComplexIndicators.productKeywords,
        ...megaComplexIndicators.scaleIndicators,
      ],
      megaComplexIndicators,
    };
  }

  // 3. Extract indicators for standard classification
  const fileIndicators = extractFileIndicators(lowerPrompt);
  const domains = extractDomains(lowerPrompt);
  const complexityScore = calculateComplexityScore(lowerPrompt);

  // 4. Estimate file count
  const estimatedFiles = estimateFileCount(fileIndicators, complexityScore, domains);

  // 5. Determine mode
  const { mode, confidence, reasoning } = determineMode(
    estimatedFiles,
    domains,
    complexityScore,
    config
  );

  return {
    mode,
    estimatedFiles,
    domains,
    confidence,
    reasoning,
    detectedKeywords: fileIndicators,
  };
}

// =============================================================================
// MEGA-COMPLEX DETECTION
// =============================================================================

/**
 * Detect indicators for mega-complex scenarios
 */
export function detectMegaComplexIndicators(prompt: string): MegaComplexIndicators {
  const promptLower = prompt.toLowerCase();

  const researchKeywords = RESEARCH_KEYWORDS.filter(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(promptLower)
  );

  const productKeywords = PRODUCT_KEYWORDS.filter(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(promptLower)
  );

  const scaleIndicators = SCALE_KEYWORDS.filter(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(promptLower)
  );

  const implementationKeywords = IMPLEMENTATION_KEYWORDS.filter(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(promptLower)
  );

  return {
    needsResearch: researchKeywords.length >= 1,
    needsProductDefinition: productKeywords.length >= 1 && implementationKeywords.length >= 1,
    needsArchitecture: scaleIndicators.length >= 1 || productKeywords.length >= 2,
    hasMultiplePhases: scaleIndicators.length >= 2 || (productKeywords.length >= 1 && implementationKeywords.length >= 1),
    researchKeywords,
    productKeywords,
    scaleIndicators,
  };
}

/**
 * Check if prompt qualifies as mega-complex
 */
export function isMegaComplex(indicators: MegaComplexIndicators): boolean {
  // Mega-complex requires research AND product definition AND architecture
  const researchWithProduct = indicators.needsResearch && indicators.needsProductDefinition;
  const fullScope = indicators.needsArchitecture && indicators.hasMultiplePhases;

  return researchWithProduct && fullScope;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if the prompt is a question
 */
function isQuestion(prompt: string): boolean {
  // Check question patterns
  if (QUESTION_PATTERNS.some(pattern => pattern.test(prompt))) {
    // Make sure it's not also a request to build something
    const hasImplementation = IMPLEMENTATION_KEYWORDS.some(kw =>
      new RegExp(`\\b${kw}\\b`, 'i').test(prompt)
    );

    // "How do I add X" is a question, but "How about we build X" is not
    if (hasImplementation) {
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Extract file-related keywords from the prompt
 */
function extractFileIndicators(prompt: string): string[] {
  const found: string[] = [];

  for (const keyword of FILE_INDICATOR_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}s?\\b`, 'gi');
    if (regex.test(prompt)) {
      found.push(keyword);
    }
  }

  return [...new Set(found)]; // Remove duplicates
}

/**
 * Extract domains from the prompt
 */
function extractDomains(prompt: string): RequestDomain[] {
  const domains: RequestDomain[] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const hasKeyword = keywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      return regex.test(prompt);
    });

    if (hasKeyword) {
      domains.push(domain as RequestDomain);
    }
  }

  return domains;
}

/**
 * Calculate complexity score based on keywords
 */
function calculateComplexityScore(prompt: string): number {
  let score = 0;

  for (const { keyword, weight } of COMPLEXITY_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = prompt.match(regex);
    if (matches) {
      score += weight * matches.length;
    }
  }

  // Also factor in prompt length (longer prompts tend to be more complex)
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount > 50) score += 2;
  else if (wordCount > 30) score += 1;

  return score;
}

/**
 * Estimate the number of files based on indicators
 */
function estimateFileCount(
  fileIndicators: string[],
  complexityScore: number,
  domains: RequestDomain[]
): number {
  // Base estimate from file indicators
  let estimate = fileIndicators.length;

  // Add for multiple domains (each domain often means multiple files)
  estimate += Math.max(0, domains.length - 1);

  // Factor in complexity score
  estimate += Math.floor(complexityScore / 3);

  // Minimum of 1 file if any indicators found
  if (estimate === 0 && (fileIndicators.length > 0 || domains.length > 0)) {
    estimate = 1;
  }

  return estimate;
}

/**
 * Determine the mode based on analysis
 */
function determineMode(
  estimatedFiles: number,
  domains: RequestDomain[],
  complexityScore: number,
  config: ClassifierConfig
): { mode: RequestMode; confidence: number; reasoning: string } {
  // High complexity score overrides file count for complex classification
  if (complexityScore >= 10 || (complexityScore >= 6 && domains.length >= 2)) {
    return {
      mode: 'complex',
      confidence: 0.7,
      reasoning: `Complex task: high complexity score (${complexityScore}), ${domains.length} domain(s), ~${estimatedFiles} file(s)`,
    };
  }

  // Complex: 6+ files or 3+ domains
  if (estimatedFiles > config.moderateThreshold || domains.length >= 3) {
    return {
      mode: 'complex',
      confidence: 0.65,
      reasoning: `Complex task: ~${estimatedFiles} file(s), ${domains.length} domain(s), complexity score ${complexityScore}`,
    };
  }

  // Moderate complexity score triggers moderate mode
  if (complexityScore >= 4 || (estimatedFiles >= 2 && domains.length >= 1)) {
    return {
      mode: 'moderate',
      confidence: 0.75,
      reasoning: `Moderate task: ~${estimatedFiles} file(s), ${domains.length} domain(s), complexity score ${complexityScore}`,
    };
  }

  // Moderate: 3-5 files, up to 2 domains
  if (estimatedFiles > config.simpleThreshold && domains.length <= 2) {
    return {
      mode: 'moderate',
      confidence: 0.75,
      reasoning: `Moderate task: ~${estimatedFiles} file(s), ${domains.length} domain(s)`,
    };
  }

  // Simple: 1-2 files, single domain, low complexity
  return {
    mode: 'simple',
    confidence: 0.85,
    reasoning: `Simple task: ~${estimatedFiles} file(s), ${domains.length || 1} domain(s)`,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get a human-readable description of the mode
 */
export function getModeDescription(mode: RequestMode): string {
  switch (mode) {
    case 'question':
      return 'Direct answer without code generation';
    case 'simple':
      return 'Quick generation (1-2 files)';
    case 'moderate':
      return 'Standard generation (3-5 files)';
    case 'complex':
      return 'Planned execution with verification (6+ files)';
    case 'mega-complex':
      return 'Full pipeline: research → planning → architecture → phased build';
    default:
      return 'Unknown mode';
  }
}

/**
 * Get a short label for the mode
 */
export function getModeLabel(mode: RequestMode): string {
  switch (mode) {
    case 'question':
      return 'Question';
    case 'simple':
      return 'Simple';
    case 'moderate':
      return 'Moderate';
    case 'complex':
      return 'Complex';
    case 'mega-complex':
      return 'Mega';
    default:
      return 'Unknown';
  }
}

/**
 * Get the color for a mode (for UI)
 */
export function getModeColor(mode: RequestMode): string {
  switch (mode) {
    case 'question':
      return 'blue';
    case 'simple':
      return 'green';
    case 'moderate':
      return 'yellow';
    case 'complex':
      return 'orange';
    case 'mega-complex':
      return 'purple';
    default:
      return 'gray';
  }
}

/**
 * Get the appropriate model for a mode
 */
export function getModelForMode(mode: RequestMode): 'flash' | 'pro' {
  switch (mode) {
    case 'question':
      return 'flash'; // Fast model for quick answers
    case 'simple':
    case 'moderate':
      return 'flash'; // Flash is sufficient for standard generation
    case 'complex':
    case 'mega-complex':
      return 'pro'; // Pro for complex planning
    default:
      return 'flash';
  }
}

/**
 * Check if a mode requires planning
 */
export function modeRequiresPlanning(mode: RequestMode): boolean {
  return mode === 'complex' || mode === 'mega-complex';
}

/**
 * Check if a mode requires research
 */
export function modeRequiresResearch(mode: RequestMode): boolean {
  return mode === 'mega-complex';
}

// =============================================================================
// SMART CLASSIFIER (LLM + Keyword Fallback)
// =============================================================================

export interface SmartClassifierOptions extends LLMClassifierOptions {
  /** Skip LLM and use keywords only (default: false) */
  keywordsOnly?: boolean;
}

/**
 * Smart classifier that uses LLM for accurate classification with keyword fallback.
 *
 * This is the recommended classifier for production use:
 * - Uses AI model to understand semantic meaning, synonyms, and implicit complexity
 * - Falls back to keyword-based classification if LLM fails or times out
 * - Handles edge cases better than pure keyword matching
 *
 * @param prompt - The user's request to classify
 * @param options - Configuration options
 * @returns Promise resolving to ClassificationResult
 *
 * @example
 * ```typescript
 * const result = await classifyRequestSmart("Add a form with validation");
 * // Returns: { mode: 'moderate', estimatedFiles: 3, ... }
 * ```
 */
export async function classifyRequestSmart(
  prompt: string,
  options: SmartClassifierOptions = {}
): Promise<ClassificationResult> {
  const { keywordsOnly = false, ...llmOptions } = options;

  // Option to skip LLM (useful for testing or when LLM is known to be unavailable)
  if (keywordsOnly) {
    return classifyRequest(prompt);
  }

  // Try LLM classification first
  const llmResult = await classifyWithLLM(prompt, {
    timeout: llmOptions.timeout ?? 3000,
    debug: llmOptions.debug ?? false,
  });

  // If LLM succeeded, use its result
  if (llmResult) {
    return llmResult;
  }

  // Fall back to keyword-based classification
  console.log('[Smart Classifier] Falling back to keyword-based classification');
  return classifyRequest(prompt);
}

/**
 * Classify multiple prompts in parallel
 * Useful for batch processing or pre-classification
 */
export async function classifyRequestsBatch(
  prompts: string[],
  options: SmartClassifierOptions = {}
): Promise<ClassificationResult[]> {
  return Promise.all(prompts.map(prompt => classifyRequestSmart(prompt, options)));
}
