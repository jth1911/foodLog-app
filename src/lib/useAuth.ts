import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth'
import { auth } from './firebase'

// The slice of the Firebase user the UI cares about.
export type AuthUser = {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

export type Auth = {
  // Null while signed out (or when Firebase isn't configured).
  user: AuthUser | null
  // False until the first auth state has resolved, so the UI can avoid flashing
  // the signed-out demo before a returning user is recognised.
  ready: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const provider = new GoogleAuthProvider()

/**
 * Drives auth state from Firebase. When Firebase isn't configured (no env vars,
 * e.g. in tests), it stays signed out and the sign-in/out calls are no-ops, so
 * the app falls back to its local demo behaviour.
 */
export function useAuth(): Auth {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(auth == null)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (fbUser) => {
      setUser(
        fbUser
          ? {
              uid: fbUser.uid,
              displayName: fbUser.displayName,
              email: fbUser.email,
              photoURL: fbUser.photoURL,
            }
          : null,
      )
      setReady(true)
    })
  }, [])

  return {
    user,
    ready,
    async signIn() {
      if (auth) await signInWithPopup(auth, provider)
    },
    async signOut() {
      if (auth) await fbSignOut(auth)
    },
  }
}
