#!/bin/sh
# Runs inside the nginx image (via /docker-entrypoint.d/) before nginx starts.
# Writes the runtime config.json so the SAME image can be re-pointed at any API
# host by setting API_BASE_URL — no rebuild needed. useMock:false turns ON real,
# password-checked authentication against the backend. apiBaseUrl must be ABSOLUTE
# (the client builds requests with `new URL(base + path)`).
set -e
: "${API_BASE_URL:=/api}"
cat > /usr/share/nginx/html/config.json <<EOF
{
  "apiBaseUrl": "${API_BASE_URL}",
  "currency": "${CURRENCY:-LYD}",
  "useMock": false
}
EOF
echo "[entrypoint] wrote config.json (apiBaseUrl=${API_BASE_URL}, useMock=false)"
