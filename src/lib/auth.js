// Client-side session handling. Tokens now live in HttpOnly cookies set by the
// backend (unreadable by JS → no XSS token theft); only the NON-sensitive current
// user is cached in localStorage so the UI can render/guard without a round-trip.
// NOTE: route guards here are for UX/navigation only — the backend enforces real
// auth and roles on every request.

const USER_KEY = 'hefs_user';

// Higher number = more privilege.
const ROLE_RANK = { employee: 1, manager: 2, superadmin: 3 };

function withBase(path) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}/${path}`.replace(/\/{2,}/g, '/');
}

export function setSession(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

// The access/refresh tokens are HttpOnly, so the presence of a cached user is our
// best client-side signal of a session. The backend is the real gate.
export function isAuthenticated() {
  return Boolean(getCurrentUser());
}

export function hasRole(minRole) {
  const user = getCurrentUser();
  if (!user) return false;
  return (ROLE_RANK[user.role] || 0) >= (ROLE_RANK[minRole] || 0);
}

export async function logout(redirect = true) {
  try {
    // Best-effort server-side revocation (revokes the refresh token, clears the
    // auth cookies). Ignore network/HTTP errors — we clear locally regardless.
    const { logout: apiLogout } = await import('./api/endpoints.js');
    await apiLogout();
  } catch {
    /* ignore — local cleanup below still runs */
  }
  localStorage.removeItem(USER_KEY);
  if (redirect) location.href = withBase('login');
}

// Call at the top of a protected page's script. Returns false (and redirects)
// when the user may not view the page.
export function requireAuth(minRole = null) {
  if (!isAuthenticated()) {
    location.href = withBase('login');
    return false;
  }
  if (minRole && !hasRole(minRole)) {
    location.href = withBase('');
    return false;
  }
  return true;
}
