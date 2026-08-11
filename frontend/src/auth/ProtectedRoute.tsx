import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Route boundary for authenticated surfaces.
 *
 * <p>🔴 This is navigation, not security. It stops an unauthenticated operator seeing a
 * page shell; it does not protect data. Every protected endpoint refuses on the server
 * regardless of what the client renders ({@code PRJ-120} — a hidden button is not
 * authorization).
 *
 * <p>While the session is bootstrapping it renders neither the page nor a redirect: sending
 * an authenticated operator to the login screen because the answer had not arrived yet
 * would be a defect, not a safe default.
 */
export default function ProtectedRoute({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const { session } = useAuth();
  const location = useLocation();

  if (session.status === 'bootstrapping') {
    return (
      <main
        style={{
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
        }}
      >
        Loading…
      </main>
    );
  }

  if (session.status === 'anonymous') {
    // Remember where the operator was going, so sign-in returns them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
