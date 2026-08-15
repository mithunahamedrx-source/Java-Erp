/**
 * The single place the frontend talks to the backend.
 *
 * <p>Deliberately small. This is not a generic enterprise API framework — it does exactly
 * what Step 2 needs: send the session cookie, acquire and submit the CSRF token, parse
 * JSON, and turn 401/403 into distinguishable outcomes.
 */

const API_BASE_URL: string = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:8080';

/** Raised for any non-2xx response, carrying the status so callers can branch on it. */
export class ApiError extends Error {
  readonly status: number;

  /**
   * The server's error envelope, where it sent one.
   *
   * <p>A business refusal names the offending field and states the rule in the operator's
   * language. Discarding it here would force every caller to invent its own message, which
   * is how a precise canonical refusal turns into "something went wrong".
   */
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }

  /** Not authenticated — "who are you". */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** Authenticated, but not permitted — "you may not". Distinct from 401. */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

/**
 * Reads the CSRF token Spring Security wrote as a readable cookie.
 *
 * <p>The token lives in a cookie rather than in JavaScript memory or localStorage, and the
 * session itself stays in an HttpOnly cookie the frontend can never read.
 */
function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Ensures a CSRF token exists before a state-changing request.
 *
 * <p>Login is itself CSRF-protected, so the very first request of a session must fetch a
 * token before it can authenticate.
 */
async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCsrfToken();
  if (existing) {
    return existing;
  }
  await fetch(`${API_BASE_URL}/api/auth/csrf`, { credentials: 'include' });
  return readCsrfToken();
}

type RequestOptions = {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly body?: unknown;
};

/**
 * Performs a request against the API.
 *
 * <p>`credentials: 'include'` is what carries the session cookie — the browser holds the
 * authority, and no token is ever stored in localStorage or in application state.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // CSRF guards state change, not reads.
  if (method !== 'GET') {
    const token = await ensureCsrfToken();
    if (token) {
      headers['X-XSRF-TOKEN'] = token;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    ...(options.body !== undefined
      ? { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) }
      : {}),
  });

  if (!response.ok) {
    // The body is read defensively: an error response may legitimately carry no JSON at all.
    let payload: unknown = null;
    try {
      payload = await response.clone().json();
    } catch {
      payload = null;
    }
    const message =
      payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export { API_BASE_URL };
