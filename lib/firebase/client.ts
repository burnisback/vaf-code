'use client';

/**
 * Firebase Client Module
 *
 * This module contains all Firebase SDK imports and must only be used client-side.
 * It uses dynamic imports to avoid SSR issues with the Firebase SDK.
 */

import { firebaseConfig, emulatorConfig, USE_EMULATORS } from './config';

// Lazy-loaded Firebase instances
let firebaseApp: any = null;
let firebaseAuth: any = null;
let firebaseDb: any = null;
let firebaseStorage: any = null;
let firebaseFunctions: any = null;
let emulatorsConnected = false;

// Cache for loaded modules
let firebaseModules: any = null;

/**
 * Load Firebase modules dynamically
 */
async function loadFirebaseModules() {
  if (firebaseModules) return firebaseModules;

  const [appModule, authModule, firestoreModule, storageModule, functionsModule] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
    import('firebase/storage'),
    import('firebase/functions'),
  ]);

  firebaseModules = {
    ...appModule,
    ...authModule,
    ...firestoreModule,
    ...storageModule,
    ...functionsModule,
  };

  return firebaseModules;
}

/**
 * Initialize Firebase app (singleton, lazy)
 */
export async function initializeFirebase() {
  if (firebaseApp) return firebaseApp;

  const { initializeApp, getApps } = await loadFirebaseModules();

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
  } else {
    firebaseApp = initializeApp(firebaseConfig);
  }

  return firebaseApp;
}

/**
 * Get Firebase Auth instance (async)
 */
export async function getFirebaseAuthAsync() {
  if (firebaseAuth) return firebaseAuth;

  const app = await initializeFirebase();
  const { getAuth, connectAuthEmulator } = await loadFirebaseModules();

  firebaseAuth = getAuth(app);

  if (USE_EMULATORS && !emulatorsConnected) {
    try {
      connectAuthEmulator(firebaseAuth, `http://${emulatorConfig.host}:${emulatorConfig.authPort}`, {
        disableWarnings: true,
      });
      console.log('Connected to Auth emulator');
    } catch (e) {
      console.warn('Auth emulator already connected');
    }
  }

  return firebaseAuth;
}

/**
 * Get Firestore instance (async)
 */
export async function getFirebaseDbAsync() {
  if (firebaseDb) return firebaseDb;

  const app = await initializeFirebase();
  const { getFirestore, connectFirestoreEmulator } = await loadFirebaseModules();

  firebaseDb = getFirestore(app);

  if (USE_EMULATORS && !emulatorsConnected) {
    try {
      connectFirestoreEmulator(firebaseDb, emulatorConfig.host, emulatorConfig.firestorePort);
      console.log('Connected to Firestore emulator');
    } catch (e) {
      console.warn('Firestore emulator already connected');
    }
  }

  return firebaseDb;
}

/**
 * Get Firebase Storage instance (async)
 */
export async function getFirebaseStorageAsync() {
  if (firebaseStorage) return firebaseStorage;

  const app = await initializeFirebase();
  const { getStorage, connectStorageEmulator } = await loadFirebaseModules();

  firebaseStorage = getStorage(app);

  if (USE_EMULATORS && !emulatorsConnected) {
    try {
      connectStorageEmulator(firebaseStorage, emulatorConfig.host, emulatorConfig.storagePort);
      console.log('Connected to Storage emulator');
    } catch (e) {
      console.warn('Storage emulator already connected');
    }
  }

  return firebaseStorage;
}

/**
 * Get Firebase Functions instance (async)
 */
export async function getFirebaseFunctionsAsync() {
  if (firebaseFunctions) return firebaseFunctions;

  const app = await initializeFirebase();
  const { getFunctions, connectFunctionsEmulator } = await loadFirebaseModules();

  firebaseFunctions = getFunctions(app, 'us-central1');

  if (USE_EMULATORS && !emulatorsConnected) {
    try {
      connectFunctionsEmulator(firebaseFunctions, emulatorConfig.host, emulatorConfig.functionsPort);
      console.log('Connected to Functions emulator');
      emulatorsConnected = true;
    } catch (e) {
      console.warn('Functions emulator already connected');
    }
  }

  return firebaseFunctions;
}

// Synchronous getters (for use after initialization)

export function getFirebaseApp() {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return firebaseApp;
}

export function getFirebaseAuth() {
  if (!firebaseAuth) {
    throw new Error('Firebase Auth not initialized. Call getFirebaseAuthAsync() first.');
  }
  return firebaseAuth;
}

export function getFirebaseDb() {
  if (!firebaseDb) {
    throw new Error('Firestore not initialized. Call getFirebaseDbAsync() first.');
  }
  return firebaseDb;
}

export function getFirebaseStorage() {
  if (!firebaseStorage) {
    throw new Error('Firebase Storage not initialized. Call getFirebaseStorageAsync() first.');
  }
  return firebaseStorage;
}

export function getFirebaseFunctions() {
  if (!firebaseFunctions) {
    throw new Error('Firebase Functions not initialized. Call getFirebaseFunctionsAsync() first.');
  }
  return firebaseFunctions;
}
