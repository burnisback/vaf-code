/**
 * Complexity Analyzer
 *
 * Analyzes request complexity to determine the appropriate pipeline.
 */

export type ComplexityLevel = 'simple' | 'medium' | 'complex';

export type PipelineType =
  | 'FAST_TRACK'       // < 20 lines, 1 file, docs only
  | 'UI_FAST_TRACK'    // < 50 lines, ≤ 3 files, UI only
  | 'BUG_FIX'          // < 30 lines, bug fix
  | 'STANDARD'         // < 200 lines
  | 'FULL_GOVERNANCE'; // Complex or security-sensitive

export interface ComplexityAnalysis {
  level: ComplexityLevel;
  pipeline: PipelineType;
  estimatedLines: number;
  estimatedFiles: number;
  reasoning: string;
  securitySensitive: boolean;
  requiresArchitecture: boolean;
  requiresDesign: boolean;
}

// Keywords that suggest security sensitivity
const SECURITY_KEYWORDS = [
  'auth', 'login', 'password', 'token', 'secret', 'api key',
  'credential', 'permission', 'role', 'admin', 'secure',
  'encrypt', 'decrypt', 'hash', 'session', 'cookie',
];

// Keywords that suggest architecture decisions
const ARCHITECTURE_KEYWORDS = [
  'database', 'schema', 'api', 'endpoint', 'service',
  'architecture', 'structure', 'integration', 'system',
  'migration', 'performance', 'scale', 'cache',
];

// Keywords that suggest UI/design work
const DESIGN_KEYWORDS = [
  'ui', 'ux', 'design', 'layout', 'style', 'color',
  'component', 'page', 'form', 'button', 'modal',
  'responsive', 'mobile', 'animation', 'theme',
];

// Keywords suggesting simple changes
const SIMPLE_KEYWORDS = [
  'typo', 'text', 'label', 'copy', 'rename', 'comment',
  'log', 'console', 'debug', 'format', 'indent',
];

/**
 * Analyze the complexity of a request
 */
export function analyzeComplexity(
  message: string,
  context?: {
    fileCount?: number;
    hasExistingCode?: boolean;
    isNewProject?: boolean;
  }
): ComplexityAnalysis {
  const lowerMessage = message.toLowerCase();

  // Check for security sensitivity
  const securitySensitive = SECURITY_KEYWORDS.some(kw =>
    lowerMessage.includes(kw)
  );

  // Check for architecture requirements
  const requiresArchitecture = ARCHITECTURE_KEYWORDS.some(kw =>
    lowerMessage.includes(kw)
  );

  // Check for design requirements
  const requiresDesign = DESIGN_KEYWORDS.some(kw =>
    lowerMessage.includes(kw)
  );

  // Check for simple indicators
  const isSimple = SIMPLE_KEYWORDS.some(kw =>
    lowerMessage.includes(kw)
  );

  // Estimate complexity based on indicators
  let level: ComplexityLevel;
  let pipeline: PipelineType;
  let estimatedLines: number;
  let estimatedFiles: number;
  let reasoning: string;

  if (securitySensitive || context?.isNewProject) {
    // Security-sensitive or new projects need full governance
    level = 'complex';
    pipeline = 'FULL_GOVERNANCE';
    estimatedLines = 200;
    estimatedFiles = 10;
    reasoning = securitySensitive
      ? 'Security-sensitive changes require full review'
      : 'New projects require full governance';
  } else if (isSimple && !requiresArchitecture && !requiresDesign) {
    // Simple text/comment changes
    level = 'simple';
    pipeline = 'FAST_TRACK';
    estimatedLines = 10;
    estimatedFiles = 1;
    reasoning = 'Simple change detected (text, typo, or comment)';
  } else if (requiresDesign && !requiresArchitecture) {
    // UI-only changes
    level = 'medium';
    pipeline = 'UI_FAST_TRACK';
    estimatedLines = 50;
    estimatedFiles = 3;
    reasoning = 'UI/design change without architecture impact';
  } else if (
    lowerMessage.includes('fix') ||
    lowerMessage.includes('bug') ||
    lowerMessage.includes('error')
  ) {
    // Bug fixes
    level = 'medium';
    pipeline = 'BUG_FIX';
    estimatedLines = 30;
    estimatedFiles = 2;
    reasoning = 'Bug fix detected';
  } else if (requiresArchitecture) {
    // Architecture changes
    level = 'complex';
    pipeline = 'FULL_GOVERNANCE';
    estimatedLines = 150;
    estimatedFiles = 8;
    reasoning = 'Architecture changes require full governance';
  } else {
    // Standard changes
    level = 'medium';
    pipeline = 'STANDARD';
    estimatedLines = 100;
    estimatedFiles = 5;
    reasoning = 'Standard feature or modification';
  }

  // Adjust based on context
  if (context?.fileCount && context.fileCount > 5) {
    level = 'complex';
    pipeline = 'FULL_GOVERNANCE';
    reasoning += ' (multiple files affected)';
  }

  return {
    level,
    pipeline,
    estimatedLines,
    estimatedFiles,
    reasoning,
    securitySensitive,
    requiresArchitecture,
    requiresDesign,
  };
}

/**
 * Get the stage names required for a pipeline type
 * Note: For full Stage objects, use getPipelineStages from governance/stages
 */
export function getRequiredStageNames(pipeline: PipelineType): string[] {
  switch (pipeline) {
    case 'FAST_TRACK':
      return ['INTAKE', 'IMPLEMENTATION', 'VERIFICATION'];

    case 'UI_FAST_TRACK':
      return ['INTAKE', 'DESIGN', 'IMPLEMENTATION', 'VERIFICATION', 'RELEASE'];

    case 'BUG_FIX':
      return [
        'INTAKE',
        'ARCHITECTURE',
        'IMPLEMENTATION',
        'VERIFICATION',
        'RELEASE',
      ];

    case 'STANDARD':
      return [
        'INTAKE',
        'PLANNING',
        'ARCHITECTURE',
        'DESIGN',
        'IMPLEMENTATION',
        'VERIFICATION',
        'RELEASE',
      ];

    case 'FULL_GOVERNANCE':
    default:
      return [
        'INTAKE',
        'PLANNING',
        'ARCHITECTURE',
        'DESIGN',
        'IMPLEMENTATION',
        'VERIFICATION',
        'RELEASE',
      ];
  }
}

/**
 * Estimate token usage for a pipeline
 */
export function estimateTokens(pipeline: PipelineType): number {
  const estimates: Record<PipelineType, number> = {
    FAST_TRACK: 5000,
    UI_FAST_TRACK: 15000,
    BUG_FIX: 20000,
    STANDARD: 50000,
    FULL_GOVERNANCE: 80000,
  };

  return estimates[pipeline];
}
