/**
 * Providers Index
 *
 * Exports all providers with support for both mock and Firebase implementations.
 */

// Auth providers
export { MockAuthProvider } from './MockAuthProvider';
export { FirebaseAuthProvider, useFirebaseAuth } from './FirebaseAuthProvider';
export { AuthProvider, useAuth } from './AuthProvider';
export type { User, AuthContextType } from './AuthProvider';

// Re-export for backwards compatibility
// Components using useAuth will automatically get the right implementation
