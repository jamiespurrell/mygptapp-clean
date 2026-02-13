'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/',
    });

    if (result?.error) {
      setError('Invalid email or password');
      return;
    }

    window.location.href = '/';
  }

  return (
    <main className="app">
      <section className="panel auth-panel">
        <h2>Sign in</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error ? <p className="status">{error}</p> : null}
          <button className="btn btn-primary" type="submit">Sign in</button>
        </form>
        <p className="status">Need an account? <a href="/sign-up">Sign up</a></p>
      </section>
    </main>
  );
}
