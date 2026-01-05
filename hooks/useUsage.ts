'use client';

/**
 * Usage Hook
 *
 * Hook for fetching user usage data and plan limits.
 */

import { useState, useEffect } from 'react';
import { useFirebaseAuth } from '@/providers';
import type { UsageSummary, UsageDataUI, UserPlan } from '@/lib/firebase/types';

interface UseUsageReturn {
  usage: UsageDataUI[];
  plan: UserPlan;
  isLoading: boolean;
  error: string | null;
}

// Import plan limits
const planLimits: Record<UserPlan, {
  projects: number;
  deploymentsPerMonth: number;
  buildMinutes: number;
  bandwidthGB: number;
  aiRequestsPerDay: number;
  aiTokensPerMonth: number;
}> = {
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

export function useUsage(): UseUsageReturn {
  const { user, isLoading: authLoading } = useFirebaseAuth();

  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [plan, setPlan] = useState<UserPlan>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user plan and usage
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setPlan('free');
      setSummary(null);
      setIsLoading(false);
      return;
    }

    let unsubscribePlan: (() => void) | null = null;
    let unsubscribeSummary: (() => void) | null = null;

    async function setupListeners() {
      if (!user) return;

      try {
        const { getFirebaseDbAsync } = await import('@/lib/firebase/client');
        const { doc, onSnapshot } = await import('firebase/firestore');

        const db = await getFirebaseDbAsync();

        // Listen to user plan
        const userRef = doc(db, 'users', user.id);
        unsubscribePlan = onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setPlan((snapshot.data().plan as UserPlan) || 'free');
            }
          },
          (err) => {
            console.error('Error fetching user plan:', err);
          }
        );

        // Listen to usage summary
        const summaryRef = doc(db, 'usage', user.id, 'summary', 'current');
        unsubscribeSummary = onSnapshot(
          summaryRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setSummary(snapshot.data() as UsageSummary);
            } else {
              setSummary(null);
            }
            setIsLoading(false);
            setError(null);
          },
          (err) => {
            console.error('Error fetching usage:', err);
            setError('Failed to load usage data');
            setIsLoading(false);
          }
        );
      } catch (err) {
        console.error('Error setting up usage listeners:', err);
        setError('Failed to initialize usage tracking');
        setIsLoading(false);
      }
    }

    setupListeners();

    return () => {
      if (unsubscribePlan) unsubscribePlan();
      if (unsubscribeSummary) unsubscribeSummary();
    };
  }, [user, authLoading]);

  // Convert summary to UI format
  const usage: UsageDataUI[] = (() => {
    const limits = planLimits[plan];

    if (!summary) {
      // Return default/empty usage
      return [
        { metric: 'Projects', used: 0, limit: limits.projects, unit: 'projects' },
        { metric: 'Deployments', used: 0, limit: limits.deploymentsPerMonth, unit: 'this month' },
        { metric: 'Build Minutes', used: 0, limit: limits.buildMinutes, unit: 'minutes' },
        { metric: 'Bandwidth', used: 0, limit: limits.bandwidthGB, unit: 'GB' },
      ];
    }

    return [
      {
        metric: 'Projects',
        used: summary.totalProjects,
        limit: limits.projects,
        unit: 'projects',
      },
      {
        metric: 'Deployments',
        used: summary.deployments,
        limit: limits.deploymentsPerMonth,
        unit: 'this month',
      },
      {
        metric: 'Build Minutes',
        used: summary.buildMinutes,
        limit: limits.buildMinutes,
        unit: 'minutes',
      },
      {
        metric: 'Bandwidth',
        used: summary.bandwidth,
        limit: limits.bandwidthGB,
        unit: 'GB',
      },
    ];
  })();

  return {
    usage,
    plan,
    isLoading: isLoading || authLoading,
    error,
  };
}
