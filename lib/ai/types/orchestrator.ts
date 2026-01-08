/**
 * Orchestrator Type Definitions
 *
 * Defines the communication protocol between Orchestrator and Agents:
 * - OrchestratorRequest: What orchestrator sends to agents
 * - AgentResponse: What agents return to orchestrator
 * - SelfCheck: Required self-validation in every response
 */

import { z } from 'zod';
import { AgentType, AgentTypeSchema, ResponseStatus, ResponseStatusSchema, EngineerMode, EngineerModeSchema, DesignMode, DesignModeSchema } from './agents';

// ============================================================================
// Task Types
// ============================================================================

export const TaskType = {
  // Requirements
  CAPTURE_REQUIREMENTS: 'capture_requirements',
  CLARIFY_SCOPE: 'clarify_scope',
  WRITE_PRD: 'write_prd',
  DEFINE_ACCEPTANCE: 'define_acceptance',

  // Architecture
  CREATE_TECH_SPEC: 'create_tech_spec',
  DESIGN_DATA_MODEL: 'design_data_model',
  PLAN_API_STRUCTURE: 'plan_api_structure',
  SELECT_PATTERNS: 'select_patterns',

  // Design (UI + UX)
  CREATE_UI_DESIGN: 'create_ui_design',
  DEFINE_UX_FLOW: 'define_ux_flow',
  SPECIFY_COMPONENTS: 'specify_components',
  PLAN_INTERACTIONS: 'plan_interactions',

  // Implementation
  IMPLEMENT_FEATURE: 'implement_feature',
  WRITE_COMPONENT: 'write_component',
  CREATE_API_ENDPOINT: 'create_api_endpoint',
  ADD_INTEGRATION: 'add_integration',

  // Quality
  RUN_TESTS: 'run_tests',
  SECURITY_REVIEW: 'security_review',
  VERIFY_REQUIREMENTS: 'verify_requirements',
  GENERATE_REPORT: 'generate_report',

  // Support
  RESEARCH_CODEBASE: 'research_codebase',
  EXPLAIN_CODE: 'explain_code',
  ANSWER_QUESTION: 'answer_question',
} as const;

export type TaskType = typeof TaskType[keyof typeof TaskType];

export const TaskTypeSchema = z.enum([
  'capture_requirements',
  'clarify_scope',
  'write_prd',
  'define_acceptance',
  'create_tech_spec',
  'design_data_model',
  'plan_api_structure',
  'select_patterns',
  'create_ui_design',
  'define_ux_flow',
  'specify_components',
  'plan_interactions',
  'implement_feature',
  'write_component',
  'create_api_endpoint',
  'add_integration',
  'run_tests',
  'security_review',
  'verify_requirements',
  'generate_report',
  'research_codebase',
  'explain_code',
  'answer_question',
]);

// ============================================================================
// Pipeline Mode
// ============================================================================

export const PipelineMode = {
  DIRECT: 'direct',       // Simple, low-risk changes
  STANDARD: 'standard',   // Most requests
  FULL: 'full',           // Complex, multi-file changes
} as const;

export type PipelineMode = typeof PipelineMode[keyof typeof PipelineMode];

export const PipelineModeSchema = z.enum(['direct', 'standard', 'full']);

// ============================================================================
// Output Types
// ============================================================================

export const OutputType = {
  FILE_OPERATIONS: 'file_operations',
  DOCUMENT: 'document',
  DECISION: 'decision',
  ANALYSIS: 'analysis',
  DESIGN_SPEC: 'design_spec',
} as const;

export type OutputType = typeof OutputType[keyof typeof OutputType];

export const OutputTypeSchema = z.enum([
  'file_operations',
  'document',
  'decision',
  'analysis',
  'design_spec',
]);

// ============================================================================
// File Operations
// ============================================================================

export const FileOperationType = {
  WRITE: 'write',
  EDIT: 'edit',
  DELETE: 'delete',
} as const;

export type FileOperationType = typeof FileOperationType[keyof typeof FileOperationType];

export const FileOperationTypeSchema = z.enum(['write', 'edit', 'delete']);

// Write operation - create new file
export const WriteOperationSchema = z.object({
  type: z.literal('write'),
  path: z.string(),
  content: z.string(),
  description: z.string().optional(),
});

export type WriteOperation = z.infer<typeof WriteOperationSchema>;

// Edit operation - surgical change
export const EditSchema = z.object({
  oldContent: z.string(),
  newContent: z.string(),
});

export type Edit = z.infer<typeof EditSchema>;

export const EditOperationSchema = z.object({
  type: z.literal('edit'),
  path: z.string(),
  edits: z.array(EditSchema),
  description: z.string().optional(),
});

export type EditOperation = z.infer<typeof EditOperationSchema>;

// Delete operation
export const DeleteOperationSchema = z.object({
  type: z.literal('delete'),
  path: z.string(),
  description: z.string().optional(),
});

export type DeleteOperation = z.infer<typeof DeleteOperationSchema>;

// Union of all file operations
export const FileOperationSchema = z.discriminatedUnion('type', [
  WriteOperationSchema,
  EditOperationSchema,
  DeleteOperationSchema,
]);

export type FileOperation = z.infer<typeof FileOperationSchema>;

// ============================================================================
// Self-Check (REQUIRED in every agent response)
// ============================================================================

export const CriteriaResultSchema = z.object({
  criterion: z.string(),
  met: z.boolean(),
  evidence: z.string(),
});

export type CriteriaResult = z.infer<typeof CriteriaResultSchema>;

export const SelfCheckSchema = z.object({
  passed: z.boolean(),
  criteriaResults: z.array(CriteriaResultSchema),
  confidence: z.number().min(0).max(1),
  concerns: z.array(z.string()).optional(),
  suggestedImprovements: z.array(z.string()).optional(),
});

export type SelfCheck = z.infer<typeof SelfCheckSchema>;

// ============================================================================
// Design Spec Output (from Design agent)
// ============================================================================

export const ComponentSpecSchema = z.object({
  type: z.string(),
  variant: z.string().optional(),
  size: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;

export const PlacementSpecSchema = z.object({
  parentComponent: z.string(),
  position: z.string(),
  spacing: z.string().optional(),
  justification: z.string(),
});

export type PlacementSpec = z.infer<typeof PlacementSpecSchema>;

export const StylingSpecSchema = z.object({
  classes: z.array(z.string()),
  customCSS: z.string().nullable().optional(),
  reasoning: z.string(),
});

export type StylingSpec = z.infer<typeof StylingSpecSchema>;

export const ResponsiveSpecSchema = z.object({
  mobile: z.string().optional(),
  tablet: z.string().optional(),
  desktop: z.string().optional(),
});

export type ResponsiveSpec = z.infer<typeof ResponsiveSpecSchema>;

export const AccessibilitySpecSchema = z.object({
  ariaLabel: z.string().nullable().optional(),
  focusOrder: z.string().optional(),
  contrastRatio: z.string().optional(),
  note: z.string().optional(),
});

export type AccessibilitySpec = z.infer<typeof AccessibilitySpecSchema>;

export const DesignSpecOutputSchema = z.object({
  component: ComponentSpecSchema,
  placement: PlacementSpecSchema,
  styling: StylingSpecSchema,
  responsive: ResponsiveSpecSchema.optional(),
  accessibility: AccessibilitySpecSchema.optional(),
});

export type DesignSpecOutput = z.infer<typeof DesignSpecOutputSchema>;

// ============================================================================
// File Operations Output (from Engineer agent)
// ============================================================================

export const FileOperationsOutputSchema = z.object({
  type: z.literal('file_operations'),
  operations: z.array(FileOperationSchema),
});

export type FileOperationsOutput = z.infer<typeof FileOperationsOutputSchema>;

// ============================================================================
// Document Output (from PM, Architect agents)
// ============================================================================

export const DocumentOutputSchema = z.object({
  type: z.literal('document'),
  title: z.string(),
  content: z.string(),
  format: z.enum(['markdown', 'json', 'text']).optional(),
});

export type DocumentOutput = z.infer<typeof DocumentOutputSchema>;

// ============================================================================
// Decision Output (from any agent)
// ============================================================================

export const DecisionOutputSchema = z.object({
  type: z.literal('decision'),
  decision: z.enum(['approved', 'rejected', 'needs_changes', 'escalate']),
  reasoning: z.string(),
  requiredChanges: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
});

export type DecisionOutput = z.infer<typeof DecisionOutputSchema>;

// ============================================================================
// Analysis Output (from any agent)
// ============================================================================

export const AnalysisOutputSchema = z.object({
  type: z.literal('analysis'),
  summary: z.string(),
  findings: z.array(z.object({
    category: z.string(),
    description: z.string(),
    severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  })),
  recommendations: z.array(z.string()).optional(),
});

export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

// ============================================================================
// Union of all output types
// ============================================================================

export const AgentOutputSchema = z.discriminatedUnion('type', [
  FileOperationsOutputSchema,
  DocumentOutputSchema,
  DecisionOutputSchema,
  AnalysisOutputSchema,
  DesignSpecOutputSchema.extend({ type: z.literal('design_spec') }),
]);

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

// ============================================================================
// Orchestrator Request (Orchestrator → Agent)
// ============================================================================

export const TaskDefinitionSchema = z.object({
  instruction: z.string(),
  acceptanceCriteria: z.array(z.string()),
  constraints: z.array(z.string()).optional(),
});

export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;

export const FileContextSchema = z.object({
  path: z.string(),
  content: z.string(),
  relevance: z.string().optional(),
});

export type FileContext = z.infer<typeof FileContextSchema>;

export const ContextSchema = z.object({
  projectType: z.string().optional(),
  fileTree: z.string().optional(),
  files: z.array(FileContextSchema).optional(),
  artifacts: z.record(z.string(), z.string()).optional(),
  priorDecisions: z.array(z.string()).optional(),
  designSystem: z.record(z.string(), z.unknown()).optional(),
  designSpec: DesignSpecOutputSchema.optional(),
});

export type Context = z.infer<typeof ContextSchema>;

export const ExpectedOutputSchema = z.object({
  type: OutputTypeSchema,
  schema: z.unknown().optional(),
  maxLength: z.number().optional(),
});

export type ExpectedOutput = z.infer<typeof ExpectedOutputSchema>;

export const OrchestratorRequestSchema = z.object({
  // Tracking
  requestId: z.string(),
  conversationId: z.string().optional(),

  // Agent targeting
  targetAgent: AgentTypeSchema,
  mode: z.union([EngineerModeSchema, DesignModeSchema]).optional(),

  // Task definition
  task: TaskDefinitionSchema,

  // Context (orchestrator curates this)
  context: ContextSchema,

  // Expected response format
  expectedOutput: ExpectedOutputSchema,

  // Metadata
  metadata: z.object({
    timestamp: z.string().optional(),
    iteration: z.number().optional(),
    maxIterations: z.number().optional(),
  }).optional(),
});

export type OrchestratorRequest = z.infer<typeof OrchestratorRequestSchema>;

// ============================================================================
// Agent Response (Agent → Orchestrator)
// ============================================================================

export const ResponseMetadataSchema = z.object({
  tokensUsed: z.number().optional(),
  executionTime: z.number().optional(),
  filesModified: z.array(z.string()).optional(),
  dependenciesAdded: z.array(z.string()).optional(),
});

export type ResponseMetadata = z.infer<typeof ResponseMetadataSchema>;

export const AgentResponseSchema = z.object({
  // Tracking
  requestId: z.string(),
  agentId: AgentTypeSchema,

  // Status
  status: ResponseStatusSchema,

  // Output (varies by type)
  output: AgentOutputSchema.optional(),

  // Self-validation (REQUIRED)
  selfCheck: SelfCheckSchema,

  // For orchestrator decision-making
  metadata: ResponseMetadataSchema.optional(),

  // Suggested next action
  suggestedNextSteps: z.array(z.string()).optional(),

  // Error information if status is error
  error: z.object({
    code: z.string(),
    message: z.string(),
    recoverable: z.boolean(),
  }).optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ============================================================================
// Orchestrator State
// ============================================================================

export const OrchestratorState = {
  IDLE: 'idle',
  CLASSIFYING: 'classifying',
  PLANNING: 'planning',
  EXECUTING_AGENT: 'executing_agent',
  EVALUATING: 'evaluating',
  FINALIZING: 'finalizing',
  ERROR: 'error',
} as const;

export type OrchestratorState = typeof OrchestratorState[keyof typeof OrchestratorState];

export const OrchestratorStateSchema = z.enum([
  'idle',
  'classifying',
  'planning',
  'executing_agent',
  'evaluating',
  'finalizing',
  'error',
]);

// ============================================================================
// Execution Plan
// ============================================================================

export const ExecutionStepSchema = z.object({
  stepId: z.string(),
  agent: AgentTypeSchema,
  taskType: TaskTypeSchema,
  description: z.string(),
  dependsOn: z.array(z.string()).optional(),
  canRunParallel: z.boolean().optional(),
  fallbackAgent: AgentTypeSchema.optional(),
  maxIterations: z.number().optional(),
});

export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;

export const ExecutionPlanSchema = z.object({
  planId: z.string(),
  mode: PipelineModeSchema,
  steps: z.array(ExecutionStepSchema),
  maxTotalIterations: z.number().optional(),
  rollbackOnFailure: z.boolean().optional(),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
