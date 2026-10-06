import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import defaultFirebaseConfig from '../firebase-applet-config.json';

// Support custom Firebase project config (e.g. for project 'copag')
export function getFirebaseConfig() {
  let config: any = { ...defaultFirebaseConfig };
  try {
    const custom = localStorage.getItem('copag_firebase_project_config');
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed && typeof parsed === 'object') {
        config = { ...config, ...parsed };
      }
    }
  } catch {}
  return config;
}

const firebaseConfig = getFirebaseConfig();

let app: ReturnType<typeof initializeApp> | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  // Support custom database id if provided
  if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }
  auth = getAuth(app);
} catch (err) {
  console.warn('Firebase initialization note: using dual local/cloud cache mechanism', err);
}

export { app, db, auth, GoogleAuthProvider, firebaseConfig };
