'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/';

  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      if (res.ok) {
        router.replace(from);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Login failed.');
        setBusy(false);
      }
    } catch {
      setError('Network error — try again.');
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="glass login-card" onSubmit={submit}>
        <div className="login-badge">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
            <path d="m3 8 9 5 9-5M12 13v8" />
          </svg>
        </div>
        <p className="eyebrow" style={{ margin: '18px 0 8px' }}>TechLabs · Inventory</p>
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Access is restricted to your team.</p>

        <label className="field-label" htmlFor="user">Username</label>
        <input
          id="user"
          type="text"
          autoComplete="username"
          placeholder="admin"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="password" style={{ marginTop: 14 }}>Password</label>
        <div className="pw-wrap">
          <input
            id="password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}

        <button type="submit" disabled={busy} className="login-submit">
          {busy ? <span className="spinner" /> : null}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
