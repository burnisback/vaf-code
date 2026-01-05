/**
 * Preferences API
 *
 * User preferences management.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb, Collections, Subcollections } from '../utils/firebase';
import { UserPreferences } from '../types';
import { handleError, ValidationError } from '../utils/errors';

/**
 * Get user preferences
 */
export const getPreferences = onCall<void, Promise<UserPreferences>>(
  { cors: true },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userId = request.auth.uid;
      const db = getDb();

      const prefsDoc = await db
        .collection(Collections.USERS)
        .doc(userId)
        .collection(Subcollections.PREFERENCES)
        .doc('settings')
        .get();

      if (!prefsDoc.exists) {
        // Return defaults if not found (shouldn't happen if auth trigger worked)
        return {
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
          updatedAt: Timestamp.now(),
        } as UserPreferences;
      }

      return prefsDoc.data() as UserPreferences;
    } catch (error) {
      throw handleError(error);
    }
  }
);

/**
 * Update user preferences
 */
export const updatePreferences = onCall<Partial<UserPreferences>, Promise<{ success: boolean }>>(
  { cors: true },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userId = request.auth.uid;
      const updates = request.data;

      // Validate updates
      if (updates.theme && !['light', 'dark', 'system'].includes(updates.theme)) {
        throw new ValidationError('Invalid theme value');
      }

      if (updates.editorFontSize && ![12, 14, 16, 18].includes(updates.editorFontSize)) {
        throw new ValidationError('Invalid editor font size');
      }

      const db = getDb();
      const prefsRef = db
        .collection(Collections.USERS)
        .doc(userId)
        .collection(Subcollections.PREFERENCES)
        .doc('settings');

      // Build update object carefully to handle nested objects
      const updateData: Record<string, unknown> = {
        updatedAt: Timestamp.now(),
      };

      if (updates.theme !== undefined) {
        updateData.theme = updates.theme;
      }

      if (updates.editorFontSize !== undefined) {
        updateData.editorFontSize = updates.editorFontSize;
      }

      if (updates.notifications !== undefined) {
        if (updates.notifications.email !== undefined) {
          updateData['notifications.email'] = updates.notifications.email;
        }
        if (updates.notifications.push !== undefined) {
          updateData['notifications.push'] = updates.notifications.push;
        }
        if (updates.notifications.marketing !== undefined) {
          updateData['notifications.marketing'] = updates.notifications.marketing;
        }
      }

      if (updates.editor !== undefined) {
        if (updates.editor.autoSave !== undefined) {
          updateData['editor.autoSave'] = updates.editor.autoSave;
        }
        if (updates.editor.wordWrap !== undefined) {
          updateData['editor.wordWrap'] = updates.editor.wordWrap;
        }
        if (updates.editor.minimap !== undefined) {
          updateData['editor.minimap'] = updates.editor.minimap;
        }
      }

      await prefsRef.update(updateData);

      console.log(`Updated preferences for user ${userId}`);

      return { success: true };
    } catch (error) {
      throw handleError(error);
    }
  }
);
