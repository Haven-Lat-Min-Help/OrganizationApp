import { supabase } from './supabase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error('VITE_BACKEND_URL must be set');
}

/** Thrown by apiFetch on a non-2xx response — carries Backend's typed error shape. */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * One request to the Backend. Uses the current session's access token — the
 * same JWT verifySupabaseJwt checks server-side — unless the caller already
 * has a fresher one (right after a refresh).
 */
async function send(path: string, options: RequestInit, accessToken?: string): Promise<Response> {
  const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;

  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

/**
 * Calls the Backend Express server. A 401 usually means the access token went
 * stale while the tab sat idle (browsers throttle the background timer that
 * renews it), so on a 401 the session is refreshed once and the request
 * retried. If it's still 401 the session is genuinely dead: the local session
 * is cleared and the user is sent to /login.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      response = await send(path, options, data.session.access_token);
    }

    if (response.status === 401) {
      await supabase.auth.signOut({ scope: 'local' });
      window.location.assign('/login');
    }
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error ?? 'unknown_error',
      body?.message ?? 'Something went wrong, please try again',
    );
  }

  return body as T;
}
