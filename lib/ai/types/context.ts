/**
 * Context Type Definitions
 *
 * Defines the context that Orchestrator provides to each agent:
 * - Project context (type, file tree, dependencies)
 * - Design system context (tokens, components, styles)
 * - Conversation context (prior outputs, decisions)
 */

import { z } from 'zod';

// ============================================================================
// Project Types
// ============================================================================

export const ProjectType = {
  VITE: 'vite',
  NEXTJS: 'nextjs',
  EXPRESS: 'express',
  REACT: 'react',
  UNKNOWN: 'unknown',
} as const;

export type ProjectType = typeof ProjectType[keyof typeof ProjectType];

export const ProjectTypeSchema = z.enum(['vite', 'nextjs', 'express', 'react', 'unknown']);

// ============================================================================
// Project State
// ============================================================================

export const ProjectStateSchema = z.object({
  type: ProjectTypeSchema,
  name: z.string().optional(),
  rootPath: z.string(),
  fileTree: z.string().optional(),
  packageJson: z.record(z.string(), z.unknown()).optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
});

export type ProjectState = z.infer<typeof ProjectStateSchema>;

// ============================================================================
// Design System Context
// ============================================================================

export const ColorTokensSchema = z.object({
  primary: z.string().optional(),
  secondary: z.string().optional(),
  accent: z.string().optional(),
  background: z.string().optional(),
  foreground: z.string().optional(),
  muted: z.string().optional(),
  destructive: z.string().optional(),
}).catchall(z.string()); // Allow additional color tokens

export type ColorTokens = z.infer<typeof ColorTokensSchema>;

export const SpacingTokensSchema = z.object({
  xs: z.string().optional(),
  sm: z.string().optional(),
  md: z.string().optional(),
  lg: z.string().optional(),
  xl: z.string().optional(),
}).catchall(z.string());

export type SpacingTokens = z.infer<typeof SpacingTokensSchema>;

export const TypographyTokensSchema = z.object({
  fontFamily: z.object({
    sans: z.string().optional(),
    mono: z.string().optional(),
    serif: z.string().optional(),
  }).optional(),
  fontSize: z.record(z.string(), z.string()).optional(),
  fontWeight: z.record(z.string(), z.string()).optional(),
  lineHeight: z.record(z.string(), z.string()).optional(),
});

export type TypographyTokens = z.infer<typeof TypographyTokensSchema>;

export const DesignSystemContextSchema = z.object({
  colors: ColorTokensSchema.optional(),
  spacing: SpacingTokensSchema.optional(),
  typography: TypographyTokensSchema.optional(),
  borderRadius: z.record(z.string(), z.string()).optional(),
  shadows: z.record(z.string(), z.string()).optional(),
  breakpoints: z.object({
    sm: z.string().optional(),
    md: z.string().optional(),
    lg: z.string().optional(),
    xl: z.string().optional(),
  }).optional(),
  buttonVariants: z.array(z.string()).optional(),
  componentInventory: z.array(z.string()).optional(),
});

export type DesignSystemContext = z.infer<typeof DesignSystemContextSchema>;

// ============================================================================
// Page Layout Context (for Design agent)
// ============================================================================

export const PageLayoutContextSchema = z.object({
  path: z.string(),
  content: z.string(),
  structure: z.string().optional(), // Description of layout structure
  existingComponents: z.array(z.string()).optional(),
  existingCTAs: z.array(z.string()).optional(),
  layoutType: z.enum(['flex', 'grid', 'block', 'unknown']).optional(),
});

export type PageLayoutContext = z.infer<typeof PageLayoutContextSchema>;

// ============================================================================
// Visual Hierarchy Context (for Design agent)
// ============================================================================

export const VisualHierarchyContextSchema = z.object({
  existingCTAs: z.array(z.object({
    text: z.string(),
    location: z.string(),
    priority: z.enum(['primary', 'secondary', 'tertiary']).optional(),
  })).optional(),
  informationPriority: z.array(z.string()).optional(),
  userAttentionFlow: z.string().optional(),
});

export type VisualHierarchyContext = z.infer<typeof VisualHierarchyContextSchema>;

// ============================================================================
// Full Design Context (combined for Design agent)
// ============================================================================

export const DesignContextSchema = z.object({
  designSystem: DesignSystemContextSchema.optional(),
  pageLayout: PageLayoutContextSchema.optional(),
  visualHierarchy: VisualHierarchyContextSchema.optional(),
  brandGuidelines: z.string().optional(),
});

export type DesignContext = z.infer<typeof DesignContextSchema>;

// ============================================================================
// Conversation Context
// ============================================================================

export const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().optional(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationContextSchema = z.object({
  messages: z.array(ConversationMessageSchema).optional(),
  priorOutputs: z.array(z.object({
    agent: z.string(),
    output: z.unknown(),
    timestamp: z.string().optional(),
  })).optional(),
  priorDecisions: z.array(z.string()).optional(),
  artifacts: z.record(z.string(), z.string()).optional(),
});

export type ConversationContext = z.infer<typeof ConversationContextSchema>;

// ============================================================================
// Intent Classification Result
// ============================================================================

export const IntentSchema = z.enum([
  'NEW_FEATURE',
  'BUG_FIX',
  'MODIFICATION',
  'QUESTION',
  'EXPLANATION',
  'REFACTOR',
  'STYLE_CHANGE',
  'CONFIGURATION',
  'UNKNOWN',
]);

export type Intent = z.infer<typeof IntentSchema>;

export const ComplexitySchema = z.enum(['simple', 'medium', 'complex']);

export type Complexity = z.infer<typeof ComplexitySchema>;

export const ClassificationResultSchema = z.object({
  intent: IntentSchema,
  complexity: ComplexitySchema,
  pipelineMode: z.enum(['direct', 'standard', 'full']),
  primaryAgent: z.enum(['orchestrator', 'pm', 'architect', 'design', 'engineer', 'qa']),
  requiresDesign: z.boolean(),
  requiresArchitect: z.boolean().optional(),
  requiresPM: z.boolean().optional(),
  estimatedSteps: z.number().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// ============================================================================
// Full Task Context (what Orchestrator assembles)
// ============================================================================

export const FullTaskContextSchema = z.object({
  // User request
  userRequest: z.string(),

  // Classification
  classification: ClassificationResultSchema.optional(),

  // Project state
  project: ProjectStateSchema.optional(),

  // Design context (for Design agent)
  design: DesignContextSchema.optional(),

  // Conversation context
  conversation: ConversationContextSchema.optional(),

  // Relevant files (orchestrator selects these)
  relevantFiles: z.array(z.object({
    path: z.string(),
    content: z.string(),
    relevance: z.string(),
  })).optional(),

  // Constraints
  constraints: z.array(z.string()).optional(),
});

export type FullTaskContext = z.infer<typeof FullTaskContextSchema>;

// ============================================================================
// Context Pruning Rules
// ============================================================================

export interface ContextPruningRules {
  maxFileSize: number;         // Max characters per file
  maxTotalFiles: number;       // Max files to include
  excludePatterns: string[];   // Glob patterns to exclude
  summarizeLargeFiles: boolean;
  includeImports: boolean;     // Include files that import/are imported by modified files
  includeTypes: boolean;       // Include type definition files
}

export const DEFAULT_PRUNING_RULES: ContextPruningRules = {
  maxFileSize: 10000,          // ~500 lines
  maxTotalFiles: 10,
  excludePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.git/**',
    '*.lock',
    '*.log',
  ],
  summarizeLargeFiles: true,
  includeImports: true,
  includeTypes: true,
};
