// Client-side session handling. The JWT + current user live in localStorage
// (DRD §7). NOTE: route guards here are for UX/navigation only — the backend
// must enforce real auth and roles on every request.

const TOKEN_KEY = 'hefs_token';
const USER_KEY = 'hefs_user';

// Higher number = more privilege.
const ROLE_RANK = { employee: 1, manager: 2, superadmin: 3 };

function withBase(path) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}/${path}`.replace(/\/{2,}/g, '/');
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function hasRole(minRole) {
  const user = getCurrentUser();
  if (!user) return false;
  return (ROLE_RANK[user.role] || 0) >= (ROLE_RANK[minRole] || 0);
}

export function logout(redirect = true) {
  localStorage.removeItem(TOKEN_KEY);
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
