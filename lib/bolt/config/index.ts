/**
 * Bolt Configuration Module
 *
 * Configuration types, context, and hooks for Bolt Playground.
 */

// Types
export {
  type BoltConfig,
  type ComplexModeConfig,
  type ClassificationConfig,
  type ExecutionConfig,
  type UIConfig,
  type DeepPartial,
  DEFAULT_BOLT_CONFIG,
  DEFAULT_COMPLEX_MODE_CONFIG,
  DEFAULT_CLASSIFICATION_CONFIG,
  DEFAULT_EXECUTION_CONFIG,
  DEFAULT_UI_CONFIG,
  mergeConfig,
} from './types';

// Context and Hooks
export {
  BoltConfigProvider,
  useBoltConfig,
  useBoltConfigSafe,
  useComplexModeConfig,
  useClassificationConfig,
  useExecutionConfig,
  useUIConfig,
} from './context';
