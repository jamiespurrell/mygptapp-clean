'use client';

import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { signOut, useSession } from 'next-auth/react';

const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER === 'authjs' ? 'authjs' : 'clerk';

export function AuthHeaderControls() {
  const { data: session } = useSession();

  if (authProvider === 'authjs') {
    if (!session?.user) {
      return <a className="status" href="/sign-in">Please sign in below to continue.</a>;
    }

    return (
      <button className="mini-btn" onClick={() => signOut({ callbackUrl: '/sign-in' })}>
        Sign out {session.user.email ?? 'user'}
      </button>
    );
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <span className="status">Please sign in below to continue.</span>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </>
  );
}
