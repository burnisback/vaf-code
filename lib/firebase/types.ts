/**
 * Firebase Types (Client-side)
 *
 * These types mirror the backend types but use client-side Timestamp.
 */

import { Timestamp } from 'firebase/firestore';

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

// Plan limits configuration
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

// ============================================
// UI-friendly types (with formatted dates)
// ============================================

export interface ProjectUI {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  framework: string;
  updatedAt: string; // Formatted for display
  createdAt: string;
}

export interface UsageDataUI {
  metric: string;
  used: number;
  limit: number;
  unit: string;
}
