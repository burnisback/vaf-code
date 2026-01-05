'use client';

/**
 * Firebase Auth Provider
 *
 * Real authentication provider using Firebase Auth.
 * Uses dynamic imports to avoid SSR issues with Firebase SDK.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getFirebaseAuthAsync, getFirebaseDbAsync } from '@/lib/firebase/client';
import type { User, UserPreferences } from '@/lib/firebase/types';

// Define simplified Firebase User type for external use
interface FirebaseUserLike {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUserLike | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updateUserProfile: (updates: { name?: string; photoURL?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface FirebaseAuthProviderProps {
  children: ReactNode;
}

export function FirebaseAuthProvider({ children }: FirebaseAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUserLike | null>(null);
  // Store the raw Firebase user for operations like updateProfile
  const [rawFirebaseUser, setRawFirebaseUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Firebase and listen to auth state changes
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function initAuth() {
      try {
        // Dynamically import Firebase modules
        const [
          { onAuthStateChanged },
          { doc, getDoc, Timestamp },
        ] = await Promise.all([
          import('firebase/auth'),
          import('firebase/firestore'),
        ]);

        const auth = await getFirebaseAuthAsync();
        const db = await getFirebaseDbAsync();

        setIsInitialized(true);

        unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
          setRawFirebaseUser(fbUser);
          setFirebaseUser(fbUser ? {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
          } : null);

          if (fbUser) {
            // Fetch user profile from Firestore
            try {
              const userDoc = await getDoc(doc(db, 'users', fbUser.uid));

              if (userDoc.exists()) {
                setUser(userDoc.data() as User);
              } else {
                // User document doesn't exist yet (might be created by auth trigger)
                // Create a basic user object from Firebase Auth data
                setUser({
                  id: fbUser.uid,
                  email: fbUser.email || '',
                  name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                  photoURL: fbUser.photoURL || undefined,
                  createdAt: Timestamp.now(),
                  updatedAt: Timestamp.now(),
                  plan: 'free',
                });
              }
            } catch (error) {
              console.error('Error fetching user profile:', error);
              // Set basic user info from Firebase Auth
              setUser({
                id: fbUser.uid,
                email: fbUser.email || '',
                name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                photoURL: fbUser.photoURL || undefined,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                plan: 'free',
              });
            }
          } else {
            setUser(null);
          }

          setIsLoading(false);
        });
      } catch (error) {
        console.error('Error initializing Firebase Auth:', error);
        setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const auth = await getFirebaseAuthAsync();
      await signInWithEmailAndPassword(auth, email, password);
      // User state will be updated by onAuthStateChanged
    } catch (error: any) {
      setIsLoading(false);
      // Re-throw with user-friendly message
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password');
      }
      if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      }
      throw new Error(error.message || 'Failed to sign in');
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { doc, setDoc, Timestamp } = await import('firebase/firestore');

      const auth = await getFirebaseAuthAsync();
      const db = await getFirebaseDbAsync();

      // Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      // Update display name
      await updateProfile(credential.user, { displayName: name });

      // Create user document in Firestore
      const now = Timestamp.now();
      const userData: User = {
        id: credential.user.uid,
        email,
        name,
        createdAt: now,
        updatedAt: now,
        plan: 'free',
      };

      await setDoc(doc(db, 'users', credential.user.uid), userData);

      // Create default preferences
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

      await setDoc(
        doc(db, 'users', credential.user.uid, 'preferences', 'settings'),
        preferences
      );

      setUser(userData);
    } catch (error: any) {
      setIsLoading(false);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists');
      }
      if (error.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters');
      }
      throw new Error(error.message || 'Failed to create account');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const { signOut } = await import('firebase/auth');
      const auth = await getFirebaseAuthAsync();
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to sign out');
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const auth = await getFirebaseAuthAsync();
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Don't reveal if user exists or not for security
        return;
      }
      throw new Error(error.message || 'Failed to send reset email');
    }
  }, []);

  const updateUserProfile = useCallback(async (updates: { name?: string; photoURL?: string }) => {
    if (!rawFirebaseUser) {
      throw new Error('Not authenticated');
    }

    try {
      const { updateProfile } = await import('firebase/auth');
      const { doc, setDoc, Timestamp } = await import('firebase/firestore');

      const db = await getFirebaseDbAsync();

      // Update Firebase Auth profile
      await updateProfile(rawFirebaseUser, {
        displayName: updates.name,
        photoURL: updates.photoURL,
      });

      // Update Firestore user document
      const userRef = doc(db, 'users', rawFirebaseUser.uid);
      const updateData: Partial<User> = {
        updatedAt: Timestamp.now(),
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.photoURL) updateData.photoURL = updates.photoURL;

      await setDoc(userRef, updateData, { merge: true });

      // Update local state
      setUser((prev) => prev ? { ...prev, ...updateData } : null);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update profile');
    }
  }, [rawFirebaseUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        forgotPassword,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useFirebaseAuth must be used within a FirebaseAuthProvider');
  }
  return context;
}
