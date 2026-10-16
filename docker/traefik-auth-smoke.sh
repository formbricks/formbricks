#!/usr/bin/env bash
# Runs the one-click installer's Traefik image and auth-route labels in front of a stub app (ENG-3977) and checks
# what label assertions cannot: the auth routers refuse a body over 1 MiB, and their buffering middleware leaves
# the empty redirects that OAuth/SSO callbacks answer with intact instead of turning them into a 500
# (traefik#11568). HSTS and HTTPS setup are off, so both entrypoints and both auth routers are exercised.

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_NAME="formbricks-traefik-auth-smoke-${$}"
readonly DOMAIN="smoke.localhost"
readonly AUTH_BODY_LIMIT=1048576
SMOKE_TEMP_DIR="$(mktemp -d)" || exit 1
readonly SMOKE_TEMP_DIR
failures=0

compose() {
  docker compose --project-name "${PROJECT_NAME}" --file "${SMOKE_TEMP_DIR}/compose.yml" "$@"
}

cleanup() {
  if ((failures > 0)); then compose logs traefik >&2 || true; fi
  compose down --volumes --timeout 2 >/dev/null 2>&1 || true
  rm -rf "${SMOKE_TEMP_DIR}"
}
trap cleanup EXIT

# The image and the labels come from the installer itself, so this checks exactly what a new install gets.
traefik_image="$(bash -c 'source "$1" >/dev/null; printf %s "$traefik_image"' bash "${SCRIPT_DIR}/formbricks.sh")"
cp "${SCRIPT_DIR}/docker-compose.yml" "${SMOKE_TEMP_DIR}/installer-compose.yml"
bash -c 'source "$1" >/dev/null; add_formbricks_traefik_labels "$2" "$3" n n' bash \
  "${SCRIPT_DIR}/formbricks.sh" "${SMOKE_TEMP_DIR}/installer-compose.yml" "${DOMAIN}"
labels="$(awk '/^  formbricks:$/ { f = 1; next } f && /^  [A-Za-z0-9_-]+:/ { f = 0 } f && /^      - "traefik\./' \
  "${SMOKE_TEMP_DIR}/installer-compose.yml")"
[[ -n "${labels}" ]] || { printf '%s\n' "No Traefik labels were generated for the formbricks service." >&2; exit 1; }

# Answers like the app: auth callbacks redirect with an empty chunked body, which is what Next sends.
cat >"${SMOKE_TEMP_DIR}/stub.js" <<'EOF'
const http = require("node:http");
http
  .createServer((req, res) => {
    let bytes = 0;
    req.on("data", (chunk) => (bytes += chunk.length));
    req.on("end", () => {
      if (req.url.startsWith("/api/auth/callback/")) {
        res.writeHead(302, { location: "/auth/login", "transfer-encoding": "chunked" });
        return res.end();
      }
      if (req.url.startsWith("/api/auth/sso/recovery/")) {
        res.writeHead(307, { location: "/environments", "transfer-encoding": "chunked" });
        return res.end();
      }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(String(bytes));
    });
  })
  .listen(3000);
EOF

cat >"${SMOKE_TEMP_DIR}/traefik.yaml" <<'EOF'
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"
    http:
      tls: {}
providers:
  docker:
    exposedByDefault: false
log:
  level: ERROR
EOF

{
  printf '%s\n' "services:" "  formbricks:" "    image: node:24-alpine" \
    '    command: ["node", "/app/stub.js"]' "    volumes:" "      - ./stub.js:/app/stub.js:ro" "    labels:"
  printf '%s\n' "${labels}"
  printf '%s\n' "  traefik:" "    image: \"${traefik_image}\"" '    command: ["--configFile=/etc/traefik/traefik.yaml"]' \
    "    ports:" '      - "127.0.0.1::80"' '      - "127.0.0.1::443"' "    volumes:" \
    "      - /var/run/docker.sock:/var/run/docker.sock:ro" "      - ./traefik.yaml:/etc/traefik/traefik.yaml:ro"
} >"${SMOKE_TEMP_DIR}/compose.yml"

head -c "${AUTH_BODY_LIMIT}" /dev/zero >"${SMOKE_TEMP_DIR}/at-limit.bin"
head -c $((AUTH_BODY_LIMIT + 1)) /dev/zero >"${SMOKE_TEMP_DIR}/over-limit.bin"
head -c $((2 * AUTH_BODY_LIMIT)) /dev/zero >"${SMOKE_TEMP_DIR}/two-limits.bin"

printf '%s\n' "Starting ${traefik_image} with the installer's auth labels."
compose up --detach --quiet-pull >/dev/null
web_port="$(compose port traefik 80)"
web_port="${web_port##*:}"
websecure_port="$(compose port traefik 443)"
websecure_port="${websecure_port##*:}"

# Prints "<status> <Location>" for a request; extra arguments go to curl.
request() {
  local url=$1
  shift
  curl --silent --insecure --output "${SMOKE_TEMP_DIR}/body" --write-out '%{http_code} %{redirect_url}' \
    --resolve "${DOMAIN}:${web_port}:127.0.0.1" --resolve "${DOMAIN}:${websecure_port}:127.0.0.1" "$@" "${url}"
}

expect() {
  local label=$1 expected=$2 actual=$3
  if [[ "${actual}" == ${expected} ]]; then
    printf '  ok    %-58s %s\n' "${label}" "${actual}"
  else
    printf '  FAIL  %-58s got "%s", expected "%s"\n' "${label}" "${actual}" "${expected}" >&2
    failures=$((failures + 1))
  fi
}

for base in "http://${DOMAIN}:${web_port}" "https://${DOMAIN}:${websecure_port}"; do
  for _ in $(seq 1 30); do
    [[ "$(request "${base}/api/auth/get-session")" == "200 "* ]] && break
    sleep 1
  done

  printf '%s\n' "${base%%:*} entrypoint:"
  expect "GET  empty chunked 302 from an OAuth callback" "302 */auth/login" \
    "$(request "${base}/api/auth/callback/google?code=c&state=s")"
  expect "POST empty chunked 302 from an OAuth callback" "302 */auth/login" \
    "$(request "${base}/api/auth/callback/google" --data 'code=c&state=s')"
  expect "GET  empty chunked 307 from SSO recovery" "307 */environments" \
    "$(request "${base}/api/auth/sso/recovery/complete?token=t")"
  expect "1 MiB body reaches the app whole" "200 " \
    "$(request "${base}/api/auth/sign-in/email" --data-binary "@${SMOKE_TEMP_DIR}/at-limit.bin")"
  expect "  ...and the app read all of it" "${AUTH_BODY_LIMIT}" "$(cat "${SMOKE_TEMP_DIR}/body")"
  expect "1 MiB + 1 is refused" "413 " \
    "$(request "${base}/api/auth/sign-in/email" --data-binary "@${SMOKE_TEMP_DIR}/over-limit.bin")"
  expect "2 MiB chunked is refused" "413 " \
    "$(request "${base}/api/auth/oauth2/register" --header 'Transfer-Encoding: chunked' \
      --data-binary "@${SMOKE_TEMP_DIR}/two-limits.bin")"
  expect "2 MiB outside /api/auth is not capped" "200 " \
    "$(request "${base}/api/v1/client/env/responses" --data-binary "@${SMOKE_TEMP_DIR}/two-limits.bin")"
done

if ((failures > 0)); then
  printf '%s\n' "${failures} Traefik auth-route check(s) failed with ${traefik_image}." >&2
  exit 1
fi
printf '%s\n' "All Traefik auth-route checks passed with ${traefik_image}."
