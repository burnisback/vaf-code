/**
 * Firebase Admin SDK Initialization
 */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

let app: App;
let db: Firestore;
let auth: Auth;
let storage: Storage;

export function initializeFirebase(): App {
  if (getApps().length === 0) {
    app = initializeApp();
  } else {
    app = getApps()[0];
  }
  return app;
}

export function getDb(): Firestore {
  if (!db) {
    initializeFirebase();
    db = getFirestore();
  }
  return db;
}

export function getAdminAuth(): Auth {
  if (!auth) {
    initializeFirebase();
    auth = getAuth();
  }
  return auth;
}

export function getAdminStorage(): Storage {
  if (!storage) {
    initializeFirebase();
    storage = getStorage();
  }
  return storage;
}

// Collection references
export const Collections = {
  USERS: 'users',
  PROJECTS: 'projects',
  TEMPLATES: 'templates',
  USAGE: 'usage',
} as const;

// Subcollection references
export const Subcollections = {
  PREFERENCES: 'preferences',
  FILES: 'files',
  CHAT_SESSIONS: 'chatSessions',
  MESSAGES: 'messages',
  DAILY: 'daily',
  SUMMARY: 'summary',
} as const;
