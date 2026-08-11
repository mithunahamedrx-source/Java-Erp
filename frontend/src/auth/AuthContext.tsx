import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, apiRequest } from '../platform/api';

/**
 * The signed-in actor as the server reports it.
 *
 * <p>🔴 This is an AFFORDANCE, never authorization. Permissions are carried so navigation
 * can hide what a user cannot reach ({@code UX-014}), but the backend refuses regardless
 * ({@code PRJ-120}). Nothing here is trusted for access control.
 */
export type CurrentUser = {
  readonly id: string;
  readonly username: string;
  readonly fullName: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
};

/**
 * Session state.
 *
 * <p>`bootstrapping` is a genuine third state, not a boolean: until `/api/auth/me` answers
 * we do not know whether an existing cookie session is valid, and treating "unknown" as
 * "signed out" would flash the login page at an already-authenticated operator on reload.
 */
export type SessionState =
  | { readonly status: 'bootstrapping' }
  | { readonly status: 'authenticated'; readonly user: CurrentUser }
  | { readonly status: 'anonymous' };

type AuthContextValue = {
  readonly session: SessionState;
  readonly signIn: (username: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Raised when credentials are rejected. Carries no detail about why. */
export class AuthenticationFailed extends Error {
  constructor() {
    super('authentication failed');
    this.name = 'AuthenticationFailed';
  }
}

export function AuthProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<SessionState>({ status: 'bootstrapping' });

  /**
   * Session bootstrap.
   *
   * <p>The browser may already hold a valid session cookie, so on load we ask the server
   * who we are rather than assuming. The server is the only authority on that question.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const user = await apiRequest<CurrentUser>('/api/auth/me');
        if (!cancelled) {
          setSession({ status: 'authenticated', user });
        }
      } catch {
        // 401 here is the normal "not signed in" answer, not an error condition.
        if (!cancelled) {
          setSession({ status: 'anonymous' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string): Promise<void> => {
    try {
      const user = await apiRequest<CurrentUser>('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      setSession({ status: 'authenticated', user });
    } catch (error) {
      setSession({ status: 'anonymous' });
      if (error instanceof ApiError && error.isUnauthenticated) {
        // The server does not say which of unknown-user, wrong-password or an
        // ineligible account lifecycle failed, and neither does this client.
        throw new AuthenticationFailed();
      }
      throw error;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await apiRequest<void>('/api/auth/logout', { method: 'POST' });
    } finally {
      // The server invalidated the session; reflect that locally whatever the response.
      setSession({ status: 'anonymous' });
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ session, signIn, signOut }), [session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
