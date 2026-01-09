/**
 * Execution Module Exports
 *
 * Phase 0-4 Implementation:
 * - Phase 0: StaticAnalyzer (tsc --noEmit for all files)
 * - Phase 1: PreVerifier (pre-change verification)
 * - Phase 2: ReferenceChecker, dangerous command blocking
 * - Phase 3: ErrorTracker, PerFileVerifier, RollbackController, BuildRunner
 * - Phase 3.5: RuntimeErrorCapture (browser preview error capture)
 * - Phase 4: CheckpointManager (named restore points)
 */

export {
  ActionQueue,
  getActionQueue,
  createSimpleDiff,
  type QueuedAction,
  type FileBackup,
  type ExecutionHistoryEntry,
  type ActionQueueState,
  type ActionQueueCallbacks,
  type ActionQueueConfig,
} from './actionQueue';

export {
  PlanExecutor,
  createPlanExecutor,
} from './planExecutor';

export {
  BuildVerifier,
  createVerifier,
  getErrorSummary,
  formatErrorsForAI,
  getTotalErrorCount,
  createEmptyResult,
  type VerificationResult,
  type VerificationError,
  type VerifierConfig,
} from './verifier';

export {
  StaticAnalyzer,
  createStaticAnalyzer,
  runStaticAnalysis,
  runEnhancedStaticAnalysis,
  type StaticAnalysisResult,
  type StaticAnalysisError,
  type StaticAnalyzerConfig,
  type EnhancedAnalysisResult,
} from './staticAnalyzer';

export {
  PreVerifier,
  createPreVerifier,
  runPreVerification,
  isErrorFixIntent,
  isVagueRequest,
  generateClarificationRequest,
  generateCleanProjectResponse,
  generateErrorReportResponse,
  type PreVerificationResult,
  type PreVerifierConfig,
  type ClarificationRequest,
} from './preVerifier';

export {
  ReferenceChecker,
  createReferenceChecker,
  isFileReferenced,
  formatReferenceWarning,
  type ReferenceCheckResult,
  type ImportReference,
  type ConfigReference,
} from './referenceChecker';

export {
  isDangerousCommand,
  extractRmPaths,
} from './actionQueue';

// =============================================================================
// PHASE 3 EXPORTS: Per-File Verification with Rollback
// =============================================================================

export {
  ErrorTracker,
  createErrorTracker,
  didErrorsIncrease,
  type ErrorSnapshot,
  type ErrorComparison,
  type ErrorTrackerConfig,
} from './errorTracker';

export {
  PerFileVerifier,
  createPerFileVerifier,
  quickVerifyFile,
  type PerFileVerifyResult,
  type PerFileVerifierConfig,
} from './perFileVerifier';

export {
  RollbackController,
  createRollbackController,
  type FileChange,
  type RollbackResult,
  type RollbackDecision,
  type RollbackControllerConfig,
} from './rollbackController';

export {
  BuildRunner,
  createBuildRunner,
  runBuild,
  type BuildResult,
  type BuildError,
  type BuildRunnerConfig,
} from './buildRunner';

// =============================================================================
// RUNTIME ERROR CAPTURE (Browser Preview)
// =============================================================================

export {
  RuntimeErrorCapture,
  createRuntimeErrorCapture,
  toRuntimeErrorInfo,
  type RuntimeError,
  type RuntimeErrorCaptureConfig,
} from './runtimeErrorCapture';

// =============================================================================
// CHECKPOINT MANAGER (Named Restore Points)
// =============================================================================

export {
  CheckpointManager,
  createCheckpointManager,
  type Checkpoint,
  type FileSnapshot,
  type RestoreResult,
  type CheckpointManagerConfig,
} from './checkpointManager';

// =============================================================================
// TARGETED TEST RUNNER (Smart Test Execution)
// =============================================================================

export {
  TargetedTestRunner,
  createTargetedTestRunner,
  createTargetedTestRunnerWithWebContainer,
  runTests,
  runSpecificTest,
  type FailedTest,
  type TestRunResult,
  type TargetedTestResult,
  type TargetedTestRunnerConfig,
} from './targetedTestRunner';

// =============================================================================
// PROJECT TYPE DETECTOR & ESLINT RUNNER (JS-only support)
// =============================================================================

export {
  ProjectTypeDetector,
  createProjectTypeDetector,
  ESLintRunner,
  createESLintRunner,
  type ProjectType,
  type ProjectTypeInfo,
  type ProjectDetectorConfig,
  type ESLintError,
  type ESLintResult,
  type ESLintRunnerConfig,
} from './projectTypeDetector';

// =============================================================================
// STYLELINT RUNNER (CSS/SCSS Error Checking)
// =============================================================================

export {
  StylelintRunner,
  createStylelintRunner,
  createStylelintRunnerWithWebContainer,
  runStylelint,
  shouldUseStylelint,
  isStylelintAvailable,
  type StylelintError,
  type StylelintResult,
  type StylelintRunnerConfig,
  type StylelintFileCheckResult,
} from './stylelintRunner';

// =============================================================================
// MONOREPO DETECTOR
// =============================================================================

export {
  MonorepoDetector,
  createMonorepoDetector,
  isMonorepo,
  type MonorepoType,
  type MonorepoPackage,
  type MonorepoInfo,
  type MonorepoDetectorConfig,
} from './monorepoDetector';

// =============================================================================
// TS PROJECT REFERENCES HANDLER
// =============================================================================

export {
  TsProjectReferencesHandler,
  createTsProjectReferencesHandler,
  usesProjectReferences,
  getTscCommand,
  type TsProjectReference,
  type TsProjectInfo,
  type ProjectReferencesInfo,
  type TsProjectReferencesConfig,
} from './tsProjectReferencesHandler';

// =============================================================================
// ENVIRONMENT VALIDATOR
// =============================================================================

export {
  EnvValidator,
  createEnvValidator,
  validateEnv,
  hasEnvUsage,
  type EnvUsage,
  type EnvDefinition,
  type EnvValidationResult,
  type EnvValidatorConfig,
} from './envValidator';

// =============================================================================
// CIRCULAR DEPENDENCY DETECTOR
// =============================================================================

export {
  CircularDependencyDetector,
  createCircularDependencyDetector,
  hasCircularDependencies,
  getCriticalCircularDependencies,
  type ImportInfo,
  type FileNode,
  type CircularChain,
  type CircularDependencyResult,
  type CircularDependencyDetectorConfig,
} from './circularDependencyDetector';

// =============================================================================
// RUNTIME ERROR INJECTOR
// =============================================================================

export {
  RuntimeErrorInjector,
  createRuntimeErrorInjector,
  injectRuntimeErrorCapture,
  isErrorCaptureInjected,
  type InjectionResult,
  type InjectionConfig,
} from './runtimeErrorInjector';

// =============================================================================
// UNIFIED VERIFIER
// =============================================================================

export {
  UnifiedVerifier,
  createUnifiedVerifier,
  quickVerify,
  fullVerify,
  completeVerify,
  type VerificationPhase,
  type UnifiedVerificationResult,
  type UnifiedVerifierConfig,
} from './unifiedVerifier';

// =============================================================================
// EVIDENCE REPORTER (Phase 4: Evidence-Based Completion)
// =============================================================================

export {
  EvidenceReporter,
  createEvidenceReporter,
  validateFixClaim,
  formatCompletionMessage,
  type ErrorCounts,
  type VerificationEvidence,
  type EvidenceReport,
  type CompletionClaim,
  type EvidenceReporterConfig,
} from './evidenceReporter';

// =============================================================================
// ESLINT RUNNER (JS-Only Project Support)
// =============================================================================

export {
  ESLintRunner as ESLintRunnerDirect,
  createESLintRunner as createESLintRunnerDirect,
  shouldUseESLint,
  runESLint,
  type ESLintError as ESLintErrorDirect,
  type ESLintFileResult,
  type ESLintResult as ESLintResultDirect,
  type ESLintRunnerConfig as ESLintRunnerConfigDirect,
} from './eslintRunner';

// =============================================================================
// BUILD TOOL DETECTOR
// =============================================================================

export {
  BuildToolDetector,
  createBuildToolDetector,
  detectBuildTool,
  getBuildCommand,
  getTypeCheckCommand,
  BuildTool,
  type BuildToolConfig,
  type BuildToolError,
  type BuildToolDetectorConfig,
} from './buildToolDetector';

// =============================================================================
// PACKAGE MANAGER DETECTOR
// =============================================================================

export {
  PackageManagerDetector,
  createPackageManagerDetector,
  detectPackageManager,
  getPackageManagerCommands,
  getRunCommand,
  PackageManager,
  type PackageManagerInfo,
  type PackageManagerCommands,
  type PackageManagerDetectorConfig,
} from './packageManagerDetector';

// =============================================================================
// WORKER ERROR CAPTURE
// =============================================================================

export {
  WorkerErrorCapture,
  createWorkerErrorCapture,
  injectWorkerErrorCapture,
  isWorkerCaptureInjected,
  getWorkerCaptureScript,
  type WorkerError,
  type WorkerErrorCaptureConfig,
  type WorkerInjectionResult,
} from './workerErrorCapture';
