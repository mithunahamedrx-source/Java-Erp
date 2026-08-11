import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthenticationFailed, useAuth } from './AuthContext';
import ApplicationBrand from '../shell/ApplicationBrand';

/**
 * The authentication surface.
 *
 * <p>Composed entirely from ratified Design Constitution primitives — Manrope, the canonical
 * surfaces, `§3.18` form-control language with its `oklch(0.65 0.006 290)` enabled boundary,
 * `RULE 6.0.b` focus (ink boundary + neutral halo), `§3.11` buttons, `RULE 3.18.f` error
 * treatment, and the approved radius and spacing scale.
 *
 * <p>🔴 No new visual language. No marketing hero, no illustration, no gradient, no
 * auth-specific token. A login page was not permission to invent a design system — and
 * deliberately no shell, sidebar or header, which belong to Step 3.
 */
export default function LoginPage(): React.JSX.Element {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  // Already signed in: go where the operator was headed.
  if (session.status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFailed(false);
    setSubmitting(true);
    try {
      await signIn(username, password);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      void navigate(from, { replace: true });
    } catch (error) {
      if (error instanceof AuthenticationFailed) {
        setFailed(true);
      } else {
        setFailed(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    height: 'var(--control-height-form)',
    borderRadius: 'var(--radius-control)',
    padding: '0 12px',
    fontSize: '13px',
    fontFamily: 'inherit',
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
    border: `1px solid ${failed ? 'var(--color-destructive)' : 'var(--color-border-form-control)'}`,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11.5px',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-2)',
  };

  return (
    <main
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
      }}
    >
      <section
        style={{
          width: '380px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-card)',
          borderRadius: 'var(--radius-panel)',
          boxShadow: 'var(--elevation-card)',
          padding: '26px 28px',
        }}
      >
        {/*
          The SAME shared brand component the sidebar uses - one asset, one implementation.
          🔴 No separate login logo, no wordmark text beside it, nothing behind it.
        */}
        <div style={{ marginBottom: 'var(--space-7)' }}>
          <ApplicationBrand surface="auth" />
        </div>

        <h1
          style={{
            fontSize: '15.5px',
            fontWeight: 700,
            color: 'var(--color-heading-ink)',
            margin: 0,
            textAlign: 'center',
          }}
        >
          Welcome Back
        </h1>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            margin: 'var(--space-2) 0 var(--space-7)',
            textAlign: 'center',
          }}
        >
          Please login to start your work today
        </p>

        <form onSubmit={(event) => void onSubmit(event)} noValidate>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label style={labelStyle} htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              style={fieldStyle}
              disabled={submitting}
            />
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label style={labelStyle} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={fieldStyle}
              disabled={submitting}
            />
          </div>

          {failed && (
            // RULE 3.18.f - the message is mandatory, not decoration: the boundary colour
            // change alone is not a sufficient signal, and colour is never the only cue.
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '13px',
                  height: '13px',
                  borderRadius: '50%',
                  border: '1.5px solid var(--color-destructive)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  lineHeight: 1,
                  fontWeight: 800,
                  color: 'var(--color-destructive)',
                  flexShrink: 0,
                }}
              >
                !
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-destructive)' }}>
                Those credentials were not accepted.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              height: 'var(--control-height-button)',
              padding: '0 16px',
              background: 'var(--color-ink)',
              border: 'none',
              borderRadius: 'var(--radius-control)',
              color: 'var(--color-surface)',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
