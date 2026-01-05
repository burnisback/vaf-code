/**
 * Shared Types for VAF Code
 *
 * These types are used across Cloud Functions and should match
 * the frontend types for consistency.
 */

import { Timestamp } from 'firebase-admin/firestore';

// ============================================
// User Types
// ============================================

export type UserPlan = 'free' | 'pro' | 'team';

export interface User {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  plan: UserPlan;
  planExpiresAt?: Timestamp;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  editorFontSize: number;
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
  editor: {
    autoSave: boolean;
    wordWrap: boolean;
    minimap: boolean;
  };
  updatedAt: Timestamp;
}

// ============================================
// Project Types
// ============================================

export type ProjectStatus = 'active' | 'draft' | 'archived';

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  framework: string;
  templateId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

export interface ProjectFile {
  id: string;
  path: string;
  content?: string;
  storageRef?: string;
  type: 'file' | 'directory';
  updatedAt: Timestamp;
}

// ============================================
// Template Types
// ============================================

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  popularity: number;
  filesStorageRef?: string;
  active: boolean;
}

// ============================================
// Usage Types
// ============================================

export interface DailyUsage {
  date: string;
  projects: number;
  deployments: number;
  buildMinutes: number;
  aiRequests: number;
  aiTokens: number;
  bandwidthMB: number;
}

export interface UsageSummary {
  period: 'monthly';
  periodStart: Timestamp;
  periodEnd: Timestamp;
  totalProjects: number;
  deployments: number;
  buildMinutes: number;
  bandwidth: number;
  aiTokens: number;
}

export interface PlanLimits {
  projects: number;
  deploymentsPerMonth: number;
  buildMinutes: number;
  bandwidthGB: number;
  aiRequestsPerDay: number;
  aiTokensPerMonth: number;
}

// ============================================
// Chat Types
// ============================================

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatSession {
  id: string;
  projectId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Timestamp;
  tokensUsed?: number;
  metadata?: {
    codeChanges?: Array<{
      file: string;
      action: 'create' | 'update' | 'delete';
    }>;
    error?: string;
  };
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateProjectRequest {
  name: string;
  description?: string;
  templateId?: string;
  framework?: string;
}

export interface CreateProjectResponse {
  projectId: string;
  project: Project;
}

export interface ListProjectsRequest {
  status?: ProjectStatus;
  limit?: number;
  startAfter?: string;
}

export interface ListProjectsResponse {
  projects: Project[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface UpdateProjectRequest {
  projectId: string;
  updates: {
    name?: string;
    description?: string;
    status?: ProjectStatus;
  };
}

export interface AIChatRequest {
  projectId?: string;
  sessionId?: string;
  message: string;
}

export interface AIChatResponse {
  response: string;
  sessionId: string;
  tokensUsed: number;
  codeChanges?: Array<{
    file: string;
    action: 'create' | 'update' | 'delete';
    content?: string;
  }>;
}

export interface AIGenerateProjectRequest {
  prompt: string;
  framework?: string;
}

export interface AIGenerateProjectResponse {
  projectId: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

// ============================================
// Plan Limits Configuration
// ============================================

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  free: {
    projects: 5,
    deploymentsPerMonth: 100,
    buildMinutes: 1000,
    bandwidthGB: 10,
    aiRequestsPerDay: 50,
    aiTokensPerMonth: 100000,
  },
  pro: {
    projects: Infinity,
    deploymentsPerMonth: Infinity,
    buildMinutes: 10000,
    bandwidthGB: 100,
    aiRequestsPerDay: 500,
    aiTokensPerMonth: 1000000,
  },
  team: {
    projects: Infinity,
    deploymentsPerMonth: Infinity,
    buildMinutes: Infinity,
    bandwidthGB: Infinity,
    aiRequestsPerDay: Infinity,
    aiTokensPerMonth: Infinity,
  },
};
