// Single HTTP entry point for the whole app. When config.useMock is true it
// dispatches to the in-memory mock; otherwise it talks to the live FastAPI server.
// Swapping between the two is purely a config.json change — no page edits.
//
// Auth is cookie-based: the browser sends the HttpOnly access/refresh cookies
// automatically (credentials: 'same-origin'), so there is no Authorization
// header to attach. On a 401 we transparently try ONE refresh (single-flighted
// so concurrent calls share it) and retry; if that fails we log out.

import { getConfig } from '../config.js';
import { logout } from '../auth.js';
import { ApiError } from './errors.js';

let refreshPromise = null;

function refreshOnce(base) {
  // Single-flight: many parallel 401s trigger only one /auth/refresh.
  if (!refreshPromise) {
    refreshPromise = fetch(base + '/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function call(method, path, { params, body } = {}) {
  const cfg = await getConfig();

  if (cfg.useMock) {
    const { dispatch } = await import('./mock/index.js');
    return dispatch(method, path, { params: params || {}, body });
  }

  const base = (cfg.apiBaseUrl || '').replace(/\/$/, '');
  const url = new URL(base + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') url.searchParams.set(k, v);
    }
  }

  const doFetch = () =>
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body != null ? JSON.stringify(body) : undefined,
    });

  let res;
  try {
    res = await doFetch();
  } catch {
    throw new ApiError(0, 'تعذّر الاتصال بالخادم. تحقّق من اتصال الشبكة.');
  }

  // Access token expired → try one refresh, then replay the original request.
  // Never do this for the auth endpoints themselves (avoids loops).
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await refreshOnce(base);
    if (refreshed) {
      try {
        res = await doFetch();
      } catch {
        throw new ApiError(0, 'تعذّر الاتصال بالخادم. تحقّق من اتصال الشبكة.');
      }
    }
    if (res.status === 401) {
      // Session is truly dead (refresh failed): clear it and send the user to
      // the login page rather than leaving them on a half-rendered page.
      logout(true);
      throw new ApiError(401, 'انتهت الجلسة. يرجى تسجيل الدخول من جديد.');
    }
  }
  // A 401 straight from an /auth/ endpoint (e.g. a wrong password on login) is a
  // genuine server response — fall through so its `detail` is surfaced below,
  // not masked by a generic "session expired" message.

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || 'حدث خطأ غير متوقّع.';
    throw new ApiError(res.status, message, data);
  }
  return data;
}
