/**
 * Agent Type Definitions
 *
 * Defines the 5 core agents in the VAF system (reduced from 16 for reliability):
 * - ORCHESTRATOR: Central brain that controls all agent interactions
 * - PM: Product Manager for requirements and PRD
 * - ARCHITECT: Solution Architect for technical design
 * - DESIGN: Combined UI + UX Designer (always invoked for ANY visual change)
 * - ENGINEER: Combined Frontend + Backend for implementation
 * - QA: Quality Assurance for testing and verification
 */

import { z } from 'zod';

// ============================================================================
// Agent Type Enum
// ============================================================================

export const AgentType = {
  ORCHESTRATOR: 'orchestrator',
  PM: 'pm',
  ARCHITECT: 'architect',
  DESIGN: 'design',      // Combined UI + UX
  ENGINEER: 'engineer',  // Combined Frontend + Backend
  QA: 'qa',
} as const;

export type AgentType = typeof AgentType[keyof typeof AgentType];

export const AgentTypeSchema = z.enum([
  'orchestrator',
  'pm',
  'architect',
  'design',
  'engineer',
  'qa',
]);

// ============================================================================
// Agent Mode (for agents that have sub-modes)
// ============================================================================

export const EngineerMode = {
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  FULLSTACK: 'fullstack',
} as const;

export type EngineerMode = typeof EngineerMode[keyof typeof EngineerMode];

export const EngineerModeSchema = z.enum(['frontend', 'backend', 'fullstack']);

export const DesignMode = {
  UI: 'ui',           // Visual component design
  UX: 'ux',           // User flow and interaction design
  COMBINED: 'combined', // Both (default)
} as const;

export type DesignMode = typeof DesignMode[keyof typeof DesignMode];

export const DesignModeSchema = z.enum(['ui', 'ux', 'combined']);

// ============================================================================
// Agent Authority Levels
// ============================================================================

export const AuthorityLevel = {
  EXECUTIVE: 'executive',   // Can override any agent (orchestrator only)
  LEAD: 'lead',             // Can approve within domain
  IC: 'ic',                 // Individual contributor
} as const;

export type AuthorityLevel = typeof AuthorityLevel[keyof typeof AuthorityLevel];

export const AuthorityLevelSchema = z.enum(['executive', 'lead', 'ic']);

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  id: AgentType;
  name: string;
  description: string;
  authorityLevel: AuthorityLevel;
  model: 'opus' | 'sonnet' | 'haiku';
  canApprove: AgentType[] | ['*']; // Which agents this can approve
  canReview: AgentType[] | ['*'];  // Which agents this can review
  mode?: EngineerMode | DesignMode;
}

export const AgentConfigSchema = z.object({
  id: AgentTypeSchema,
  name: z.string(),
  description: z.string(),
  authorityLevel: AuthorityLevelSchema,
  model: z.enum(['opus', 'sonnet', 'haiku']),
  canApprove: z.union([z.array(AgentTypeSchema), z.tuple([z.literal('*')])]),
  canReview: z.union([z.array(AgentTypeSchema), z.tuple([z.literal('*')])]),
  mode: z.union([EngineerModeSchema, DesignModeSchema]).optional(),
});

// ============================================================================
// Default Agent Configurations
// ============================================================================

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  orchestrator: {
    id: 'orchestrator',
    name: 'VAF Orchestrator',
    description: 'Central brain that controls all agent interactions',
    authorityLevel: 'executive',
    model: 'opus',
    canApprove: ['*'],
    canReview: ['*'],
  },
  pm: {
    id: 'pm',
    name: 'Product Manager',
    description: 'Transforms requirements into structured specs and PRDs',
    authorityLevel: 'lead',
    model: 'sonnet',
    canApprove: ['pm'],
    canReview: ['architect', 'design'],
  },
  architect: {
    id: 'architect',
    name: 'Solution Architect',
    description: 'Technical design, code structure, and architectural decisions',
    authorityLevel: 'lead',
    model: 'sonnet',
    canApprove: ['architect', 'engineer'],
    canReview: ['pm', 'design', 'engineer'],
  },
  design: {
    id: 'design',
    name: 'UI/UX Designer',
    description: 'Visual design AND user experience - invoked for ANY UI change',
    authorityLevel: 'lead',
    model: 'sonnet',
    canApprove: ['design'],
    canReview: ['engineer'],
    mode: 'combined',
  },
  engineer: {
    id: 'engineer',
    name: 'Full-Stack Engineer',
    description: 'Implementation - React components, APIs, database operations',
    authorityLevel: 'ic',
    model: 'sonnet',
    canApprove: [],
    canReview: ['engineer'],
    mode: 'fullstack',
  },
  qa: {
    id: 'qa',
    name: 'Quality Assurance',
    description: 'Testing, verification, and quality gates',
    authorityLevel: 'lead',
    model: 'haiku',
    canApprove: ['qa'],
    canReview: ['engineer', 'design'],
  },
};

// ============================================================================
// Agent Status
// ============================================================================

export const AgentStatus = {
  IDLE: 'idle',
  EXECUTING: 'executing',
  WAITING_FOR_INPUT: 'waiting_for_input',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type AgentStatus = typeof AgentStatus[keyof typeof AgentStatus];

export const AgentStatusSchema = z.enum([
  'idle',
  'executing',
  'waiting_for_input',
  'completed',
  'failed',
]);

// ============================================================================
// Response Status (from agent back to orchestrator)
// ============================================================================

export const ResponseStatus = {
  SUCCESS: 'success',
  PARTIAL: 'partial',
  NEEDS_INFO: 'needs_info',
  BLOCKED: 'blocked',
  ERROR: 'error',
} as const;

export type ResponseStatus = typeof ResponseStatus[keyof typeof ResponseStatus];

export const ResponseStatusSchema = z.enum([
  'success',
  'partial',
  'needs_info',
  'blocked',
  'error',
]);
