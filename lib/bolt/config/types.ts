/**
 * Bolt Configuration Types
 *
 * Configuration options for the Bolt Playground complex mode.
 */

// =============================================================================
// MAIN CONFIG
// =============================================================================

export interface BoltConfig {
  /** Complex mode settings */
  complexMode: ComplexModeConfig;

  /** Classification settings */
  classification: ClassificationConfig;

  /** Execution settings */
  execution: ExecutionConfig;

  /** UI settings */
  ui: UIConfig;
}

// =============================================================================
// COMPLEX MODE CONFIG
// =============================================================================

export interface ComplexModeConfig {
  /** Enable/disable complex mode entirely */
  enabled: boolean;

  /** Auto-detect complex requests or require manual trigger */
  autoDetect: boolean;

  /** Show plan for approval before execution */
  requireApproval: boolean;

  /** Maximum refinement iterations */
  maxIterations: number;

  /** Auto-fix errors or show verification first */
  autoFix: boolean;

  /** Auto-fix browser runtime errors after plan execution */
  autoFixRuntimeErrors: boolean;

  /** Delay in ms before checking for browser runtime errors (allows preview to load) */
  runtimeErrorCheckDelay: number;
}

export const DEFAULT_COMPLEX_MODE_CONFIG: ComplexModeConfig = {
  enabled: true,
  autoDetect: true,
  requireApproval: true,
  maxIterations: 3,
  autoFix: false,
  autoFixRuntimeErrors: true,
  runtimeErrorCheckDelay: 3000,
};

// =============================================================================
// CLASSIFICATION CONFIG
// =============================================================================

export interface ClassificationConfig {
  /** Threshold for simple mode (max estimated files) */
  simpleThreshold: number;

  /** Threshold for moderate mode (max estimated files) */
  moderateThreshold: number;

  /** Minimum confidence to auto-select mode */
  minConfidence: number;

  /** Allow user to override classification */
  allowOverride: boolean;
}

export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfig = {
  simpleThreshold: 2,
  moderateThreshold: 5,
  minConfidence: 0.6,
  allowOverride: true,
};

// =============================================================================
// EXECUTION CONFIG
// =============================================================================

export interface ExecutionConfig {
  /** Timeout per task in milliseconds */
  taskTimeout: number;

  /** Whether to stop on first error */
  stopOnError: boolean;

  /** Whether to verify after each task */
  verifyAfterEach: boolean;

  /** Wait time before verification (ms) */
  verificationDelay: number;
}

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  taskTimeout: 60000,
  stopOnError: false,
  verifyAfterEach: false,
  verificationDelay: 2000,
};

// =============================================================================
// UI CONFIG
// =============================================================================

export interface UIConfig {
  /** Show classification badge on messages */
  showClassificationBadge: boolean;

  /** Show detailed plan view */
  showDetailedPlan: boolean;

  /** Show task progress during execution */
  showTaskProgress: boolean;

  /** Expand errors by default in verification */
  expandErrors: boolean;

  /** Show iteration badge during refinement */
  showIterationBadge: boolean;
}

export const DEFAULT_UI_CONFIG: UIConfig = {
  showClassificationBadge: true,
  showDetailedPlan: true,
  showTaskProgress: true,
  expandErrors: true,
  showIterationBadge: true,
};

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

export const DEFAULT_BOLT_CONFIG: BoltConfig = {
  complexMode: DEFAULT_COMPLEX_MODE_CONFIG,
  classification: DEFAULT_CLASSIFICATION_CONFIG,
  execution: DEFAULT_EXECUTION_CONFIG,
  ui: DEFAULT_UI_CONFIG,
};

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Merge two configs deeply, with target overriding source
 */
export function mergeConfig(source: BoltConfig, target: DeepPartial<BoltConfig>): BoltConfig {
  return {
    complexMode: { ...source.complexMode, ...target.complexMode },
    classification: { ...source.classification, ...target.classification },
    execution: { ...source.execution, ...target.execution },
    ui: { ...source.ui, ...target.ui },
  };
}
