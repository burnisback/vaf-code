/**
 * Auth Triggers
 *
 * Firebase Auth event handlers for user lifecycle management.
 * Uses v1 auth triggers which run AFTER the auth event completes.
 */

import * as functions from 'firebase-functions';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb, Collections, Subcollections } from '../utils/firebase';
import { User, UserPreferences } from '../types';

/**
 * Triggered when a new user is created in Firebase Auth.
 * Creates the user document and initializes preferences and usage tracking.
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const db = getDb();
  const now = Timestamp.now();

  console.log(`Creating user document for: ${user.uid}`);

  // Create user document
  const userData: User = {
    id: user.uid,
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL || undefined,
    createdAt: now,
    updatedAt: now,
    plan: 'free',
  };

  // Default preferences
  const preferences: UserPreferences = {
    theme: 'dark',
    editorFontSize: 14,
    notifications: {
      email: true,
      push: false,
      marketing: false,
    },
    editor: {
      autoSave: true,
      wordWrap: true,
      minimap: false,
    },
    updatedAt: now,
  };

  // Calculate period start/end for usage tracking
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Usage summary initialization
  const usageSummary = {
    period: 'monthly',
    periodStart: Timestamp.fromDate(periodStart),
    periodEnd: Timestamp.fromDate(periodEnd),
    totalProjects: 0,
    deployments: 0,
    buildMinutes: 0,
    bandwidth: 0,
    aiTokens: 0,
  };

  // Batch write all documents
  const batch = db.batch();

  // User document
  const userRef = db.collection(Collections.USERS).doc(user.uid);
  batch.set(userRef, userData);

  // Preferences subcollection
  const prefsRef = userRef.collection(Subcollections.PREFERENCES).doc('settings');
  batch.set(prefsRef, preferences);

  // Usage summary
  const usageRef = db.collection(Collections.USAGE).doc(user.uid);
  const summaryRef = usageRef.collection(Subcollections.SUMMARY).doc('current');
  batch.set(summaryRef, usageSummary);

  try {
    await batch.commit();
    console.log(`Successfully created user documents for: ${user.uid}`);
  } catch (error) {
    console.error(`Failed to create user documents for: ${user.uid}`, error);
    throw error;
  }
});

/**
 * Triggered when a user is deleted from Firebase Auth.
 * Performs cleanup of user data (soft delete approach).
 */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const db = getDb();
  const now = Timestamp.now();

  console.log(`Processing deletion for user: ${user.uid}`);

  try {
    // Soft delete: mark user as deleted rather than removing data
    // This preserves audit trail and allows recovery if needed
    const userRef = db.collection(Collections.USERS).doc(user.uid);

    await userRef.update({
      deletedAt: now,
      updatedAt: now,
    });

    // Optionally: Archive or delete projects
    // For now, we leave projects intact but they become inaccessible
    // A cleanup job can handle permanent deletion later

    console.log(`Successfully marked user as deleted: ${user.uid}`);
  } catch (error) {
    console.error(`Failed to process user deletion: ${user.uid}`, error);
    // Don't throw - user is already deleted from Auth
  }
});
