/**
 * Usage API
 *
 * Usage tracking and quota management.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getDb, Collections, Subcollections } from '../utils/firebase';
import { UsageSummary, DailyUsage, PLAN_LIMITS, UserPlan } from '../types';
import { handleError } from '../utils/errors';

interface UsageSummaryResponse {
  summary: UsageSummary;
  limits: typeof PLAN_LIMITS.free;
  plan: UserPlan;
}

/**
 * Get usage summary for the current billing period
 */
export const getUsageSummary = onCall<void, Promise<UsageSummaryResponse>>(
  { cors: true },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userId = request.auth.uid;
      const db = getDb();

      // Get user plan
      const userDoc = await db.collection(Collections.USERS).doc(userId).get();
      const plan = (userDoc.data()?.plan || 'free') as UserPlan;

      // Get usage summary
      const summaryDoc = await db
        .collection(Collections.USAGE)
        .doc(userId)
        .collection(Subcollections.SUMMARY)
        .doc('current')
        .get();

      let summary: UsageSummary;

      if (!summaryDoc.exists) {
        // Initialize if missing
        const periodStart = new Date();
        periodStart.setDate(1);
        periodStart.setHours(0, 0, 0, 0);

        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        summary = {
          period: 'monthly',
          periodStart: Timestamp.fromDate(periodStart),
          periodEnd: Timestamp.fromDate(periodEnd),
          totalProjects: 0,
          deployments: 0,
          buildMinutes: 0,
          bandwidth: 0,
          aiTokens: 0,
        };
      } else {
        summary = summaryDoc.data() as UsageSummary;
      }

      return {
        summary,
        limits: PLAN_LIMITS[plan],
        plan,
      };
    } catch (error) {
      throw handleError(error);
    }
  }
);

interface RecordUsageRequest {
  type: 'deployment' | 'buildMinutes' | 'bandwidth' | 'aiTokens' | 'aiRequest';
  amount: number;
}

/**
 * Record usage (internal use - called by other functions)
 * In production, this would be restricted to service accounts
 */
export const recordUsage = onCall<RecordUsageRequest, Promise<{ success: boolean }>>(
  { cors: true },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userId = request.auth.uid;
      const { type, amount } = request.data;

      if (!type || amount === undefined) {
        throw new HttpsError('invalid-argument', 'Type and amount are required');
      }

      const db = getDb();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Update daily usage
      const dailyRef = db
        .collection(Collections.USAGE)
        .doc(userId)
        .collection(Subcollections.DAILY)
        .doc(today);

      const dailyDoc = await dailyRef.get();

      if (!dailyDoc.exists) {
        // Initialize daily record
        const initialDaily: DailyUsage = {
          date: today,
          projects: 0,
          deployments: 0,
          buildMinutes: 0,
          aiRequests: 0,
          aiTokens: 0,
          bandwidthMB: 0,
        };
        await dailyRef.set(initialDaily);
      }

      // Update based on type
      const fieldMap: Record<string, string> = {
        deployment: 'deployments',
        buildMinutes: 'buildMinutes',
        bandwidth: 'bandwidthMB',
        aiTokens: 'aiTokens',
        aiRequest: 'aiRequests',
      };

      const field = fieldMap[type];
      if (!field) {
        throw new HttpsError('invalid-argument', 'Invalid usage type');
      }

      // Update daily
      await dailyRef.update({
        [field]: FieldValue.increment(amount),
      });

      // Update summary
      const summaryRef = db
        .collection(Collections.USAGE)
        .doc(userId)
        .collection(Subcollections.SUMMARY)
        .doc('current');

      const summaryField = type === 'bandwidth' ? 'bandwidth' : field;
      await summaryRef.update({
        [summaryField]: FieldValue.increment(amount),
      });

      return { success: true };
    } catch (error) {
      throw handleError(error);
    }
  }
);
