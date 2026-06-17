import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInControl from './SignInControl'

describe('SignInControl', () => {
  it('shows a Google sign-in button when signed out', async () => {
    const onSignIn = vi.fn()
    render(<SignInControl user={null} onSignIn={onSignIn} onSignOut={vi.fn()} />)
    const button = screen.getByRole('button', { name: /sign in with google/i })
    await userEvent.click(button)
    expect(onSignIn).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('shows the account and a sign-out button when signed in', async () => {
    const onSignOut = vi.fn()
    render(
      <SignInControl
        user={{ uid: 'u1', displayName: 'Ada Lovelace', email: 'ada@example.com', photoURL: null }}
        onSignIn={vi.fn()}
        onSignOut={onSignOut}
      />,
    )
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument()
  })

  it('falls back to the email when there is no display name', () => {
    render(
      <SignInControl
        user={{ uid: 'u1', displayName: null, email: 'ada@example.com', photoURL: null }}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })
})
