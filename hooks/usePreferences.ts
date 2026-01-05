'use client';

/**
 * Preferences Hook
 *
 * Hook for managing user preferences with Firestore.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFirebaseAuth } from '@/providers';
import type { UserPreferences } from '@/lib/firebase/types';

interface UsePreferencesReturn {
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  updateTheme: (theme: UserPreferences['theme']) => Promise<void>;
  updateEditorFontSize: (size: number) => Promise<void>;
  updateNotifications: (notifications: Partial<UserPreferences['notifications']>) => Promise<void>;
  updateEditor: (editor: Partial<UserPreferences['editor']>) => Promise<void>;
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, 'updatedAt'> = {
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
};

export function usePreferences(): UsePreferencesReturn {
  const { user, isLoading: authLoading } = useFirebaseAuth();

  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dbRef = useRef<any>(null);

  // Subscribe to preferences
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setPreferences(null);
      setIsLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    async function setupListener() {
      if (!user) return;

      try {
        const { getFirebaseDbAsync } = await import('@/lib/firebase/client');
        const { doc, onSnapshot, Timestamp } = await import('firebase/firestore');

        const db = await getFirebaseDbAsync();
        dbRef.current = db;
        const prefsRef = doc(db, 'users', user.id, 'preferences', 'settings');

        unsubscribe = onSnapshot(
          prefsRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setPreferences(snapshot.data() as UserPreferences);
            } else {
              // Use defaults if no preferences exist
              setPreferences({
                ...DEFAULT_PREFERENCES,
                updatedAt: Timestamp.now(),
              });
            }
            setIsLoading(false);
            setError(null);
          },
          (err) => {
            console.error('Error fetching preferences:', err);
            setError('Failed to load preferences');
            // Fall back to defaults
            setPreferences({
              ...DEFAULT_PREFERENCES,
              updatedAt: Timestamp.now(),
            } as UserPreferences);
            setIsLoading(false);
          }
        );
      } catch (err) {
        console.error('Error setting up preferences listener:', err);
        setError('Failed to initialize preferences');
        setIsLoading(false);
      }
    }

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, authLoading]);

  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>): Promise<void> => {
      if (!user) {
        throw new Error('Must be logged in to update preferences');
      }

      const { getFirebaseDbAsync } = await import('@/lib/firebase/client');
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

      const db = await getFirebaseDbAsync();
      const prefsRef = doc(db, 'users', user.id, 'preferences', 'settings');

      // Build flat update object for nested fields
      const updateData: Record<string, any> = {
        updatedAt: Timestamp.now(),
      };

      if (updates.theme !== undefined) {
        updateData.theme = updates.theme;
      }

      if (updates.editorFontSize !== undefined) {
        updateData.editorFontSize = updates.editorFontSize;
      }

      if (updates.notifications !== undefined) {
        Object.entries(updates.notifications).forEach(([key, value]) => {
          updateData[`notifications.${key}`] = value;
        });
      }

      if (updates.editor !== undefined) {
        Object.entries(updates.editor).forEach(([key, value]) => {
          updateData[`editor.${key}`] = value;
        });
      }

      try {
        await updateDoc(prefsRef, updateData);
      } catch (err: any) {
        console.error('Error updating preferences:', err);
        throw new Error(err.message || 'Failed to update preferences');
      }
    },
    [user]
  );

  const updateTheme = useCallback(
    async (theme: UserPreferences['theme']): Promise<void> => {
      await updatePreferences({ theme });
    },
    [updatePreferences]
  );

  const updateEditorFontSize = useCallback(
    async (size: number): Promise<void> => {
      await updatePreferences({ editorFontSize: size });
    },
    [updatePreferences]
  );

  const updateNotifications = useCallback(
    async (notifications: Partial<UserPreferences['notifications']>): Promise<void> => {
      await updatePreferences({ notifications: notifications as UserPreferences['notifications'] });
    },
    [updatePreferences]
  );

  const updateEditor = useCallback(
    async (editor: Partial<UserPreferences['editor']>): Promise<void> => {
      await updatePreferences({ editor: editor as UserPreferences['editor'] });
    },
    [updatePreferences]
  );

  return {
    preferences,
    isLoading: isLoading || authLoading,
    error,
    updatePreferences,
    updateTheme,
    updateEditorFontSize,
    updateNotifications,
    updateEditor,
  };
}
