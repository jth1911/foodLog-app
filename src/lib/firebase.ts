// Firebase initialization. Config comes from Vite `VITE_FIREBASE_*` env vars so
// nothing is hard-coded; see `.env.example` and the README.
//
// When the config is absent (e.g. in tests, or a checkout without a .env), we
// skip initialization and export `null` for `auth`/`db`. The auth hook and data
// layer treat that as "signed out", so the app still runs as the local demo.

import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Treat the config as present only when the essentials are set.
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

if (isFirebaseConfigured) {
  app = initializeApp(config)
  auth = getAuth(app)
  // Offline-first: persist reads/writes locally and sync on reconnect
  // ("last write wins"). Single-tab manager is the recommended default.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) }),
  })
}

export { app, auth, db }
