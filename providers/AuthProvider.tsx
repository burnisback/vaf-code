'use client';

/**
 * Unified Auth Provider
 *
 * Wraps either MockAuthProvider or FirebaseAuthProvider based on feature flags.
 * This allows seamless switching between mock and real authentication.
 */

import { createContext, useContext, ReactNode } from 'react';
import { USE_MOCK_AUTH } from '@/lib/firebase';
import { MockAuthProvider, useAuth as useMockAuth } from './MockAuthProvider';
import { FirebaseAuthProvider, useFirebaseAuth } from './FirebaseAuthProvider';

// Re-export the common User interface
export interface User {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void | Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updateUserProfile?: (updates: { name?: string; photoURL?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  forceMock?: boolean; // Allow forcing mock for testing
}

/**
 * Main Auth Provider that switches between mock and Firebase
 */
export function AuthProvider({ children, forceMock }: AuthProviderProps) {
  const useMock = forceMock ?? USE_MOCK_AUTH;

  if (useMock) {
    return <MockAuthProvider>{children}</MockAuthProvider>;
  }

  return <FirebaseAuthProvider>{children}</FirebaseAuthProvider>;
}

/**
 * Unified auth hook that works with both providers
 */
export function useAuth(): AuthContextType {
  // Try to determine which provider is being used
  // This is a simplified approach - in production you might use a context
  const useMock = USE_MOCK_AUTH;

  if (useMock) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const mockAuth = useMockAuth();
    return {
      ...mockAuth,
      isAuthenticated: !!mockAuth.user,
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const firebaseAuth = useFirebaseAuth();

  return {
    user: firebaseAuth.user ? {
      id: firebaseAuth.user.id,
      email: firebaseAuth.user.email,
      name: firebaseAuth.user.name,
      photoURL: firebaseAuth.user.photoURL,
    } : null,
    isLoading: firebaseAuth.isLoading,
    isAuthenticated: firebaseAuth.isAuthenticated,
    login: firebaseAuth.login,
    signup: firebaseAuth.signup,
    logout: firebaseAuth.logout,
    forgotPassword: firebaseAuth.forgotPassword,
    updateUserProfile: firebaseAuth.updateUserProfile,
  };
}
