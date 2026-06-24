// Single HTTP entry point for the whole app. When config.useMock is true it
// dispatches to the in-memory mock; otherwise it talks to the live FastAPI server.
// Swapping between the two is purely a config.json change — no page edits.

import { getConfig } from '../config.js';
import { getToken, logout } from '../auth.js';
import { ApiError } from './errors.js';

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

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'تعذّر الاتصال بالخادم. تحقّق من اتصال الشبكة.');
  }

  if (res.status === 401) {
    logout(false);
    throw new ApiError(401, 'انتهت الجلسة. يرجى تسجيل الدخول من جديد.');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || 'حدث خطأ غير متوقّع.';
    throw new ApiError(res.status, message, data);
  }
  return data;
}
