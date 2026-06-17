import type { AuthUser } from './lib/useAuth'

type SignInControlProps = {
  user: AuthUser | null
  onSignIn: () => void
  onSignOut: () => void
}

// Presentational sign-in / sign-out control. Auth logic lives in useAuth; this
// just renders the current state and raises intent, so it's trivially testable.
function SignInControl({ user, onSignIn, onSignOut }: SignInControlProps) {
  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
      >
        Sign in with Google
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {user.photoURL && (
        <img
          src={user.photoURL}
          alt=""
          className="h-7 w-7 rounded-full"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="text-sm text-slate-600">{user.displayName ?? user.email}</span>
      <button
        type="button"
        onClick={onSignOut}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:border-slate-500 focus:outline-none"
      >
        Sign out
      </button>
    </div>
  )
}

export default SignInControl
