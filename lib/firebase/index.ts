/**
 * Firebase Library Exports
 *
 * Config exports are safe for SSR.
 * For client-side Firebase SDK functions, import directly from '@/lib/firebase/client'
 */

// Config exports (SSR-safe)
export {
  USE_EMULATORS,
  USE_MOCK_AUTH,
  ENABLE_AI,
  firebaseConfig,
  emulatorConfig,
} from './config';

// Types (SSR-safe)
export * from './types';

// NOTE: For Firebase SDK functions (getFirebaseAuthAsync, getFirebaseDbAsync, etc.),
// import directly from '@/lib/firebase/client' in 'use client' components.
