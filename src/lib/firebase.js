// Firebase init — auth (login) + Firestore (role lookup).
// Requires these env vars (Vercel + .env.local), all safe to expose client-side:
//   VITE_FIREBASE_API_KEY
//   VITE_FIREBASE_AUTH_DOMAIN
//   VITE_FIREBASE_PROJECT_ID
//   VITE_FIREBASE_APP_ID
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Explicitly persist the session in localStorage so a signed-in user stays
// signed in across tabs, page reloads, and browser restarts — without this,
// some browser storage configurations silently fall back to in-memory-only
// persistence, which is wiped every time a new tab/window opens.
setPersistence(auth, browserLocalPersistence).catch(() => {});
