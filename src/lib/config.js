// Loads runtime configuration from /config.json (served from public/).
// Kept OUTSIDE the build so the same `dist` can be re-pointed at any LAN server
// by editing dist/config.json — no rebuild required.

const DEFAULTS = {
  apiBaseUrl: 'http://localhost:8000',
  currency: 'LYD',
  useMock: true,
};

let cache = null;
let inflight = null;

export async function getConfig() {
  if (cache) return cache;
  if (!inflight) {
    const url = `${import.meta.env.BASE_URL}config.json`;
    inflight = fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((cfg) => {
        cache = { ...DEFAULTS, ...cfg };
        return cache;
      });
  }
  return inflight;
}
