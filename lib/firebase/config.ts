/**
 * Firebase Configuration
 *
 * Feature flags and configuration only.
 * Firebase SDK is loaded separately via client-only module.
 */

// Feature flags (can be evaluated at build time)
export const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
export const USE_MOCK_AUTH = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';
export const ENABLE_AI = process.env.NEXT_PUBLIC_ENABLE_AI !== 'false';

// Firebase configuration from environment variables
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Emulator configuration
export const emulatorConfig = {
  host: 'localhost',
  authPort: parseInt(process.env.NEXT_PUBLIC_EMULATOR_AUTH_PORT || '9099'),
  firestorePort: parseInt(process.env.NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT || '8080'),
  functionsPort: parseInt(process.env.NEXT_PUBLIC_EMULATOR_FUNCTIONS_PORT || '5001'),
  storagePort: parseInt(process.env.NEXT_PUBLIC_EMULATOR_STORAGE_PORT || '9199'),
};
