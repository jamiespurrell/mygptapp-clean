'use client';

import { FormEvent, useState } from 'react';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to create account');
      return;
    }

    setSuccess('Account created. You can now sign in.');
  }

  return (
    <main className="app">
      <section className="panel auth-panel">
        <h2>Sign up</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="name">Name (optional)</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error ? <p className="status">{error}</p> : null}
          {success ? <p className="status">{success}</p> : null}
          <button className="btn btn-primary" type="submit">Create account</button>
        </form>
      </section>
    </main>
  );
}
