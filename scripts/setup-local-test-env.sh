#!/usr/bin/env bash
# Brings a fresh container from zero to a running Formbricks dev server with seeded data,
# ready for Playwright runs. Written for sandboxes where Docker images cannot be pulled,
# so it uses natively installed PostgreSQL and Redis instead of docker-compose.dev.yml.
#
# On a machine with working Docker, prefer `pnpm db:up` — it brings up Mailhog, RustFS (S3),
# Cube and Hub too, none of which this script can provide.
#
# Usage:  bash scripts/setup-local-test-env.sh
# Result: dev server on http://localhost:3000, seeded login admin@formbricks.com / Password#123
#
# Background, traps and known noise: scripts/local-test-environment.md

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly LOG_DIR="${REPO_ROOT}/.local-test-logs"
readonly DEV_LOG="${LOG_DIR}/dev-server.log"
readonly DB_NAME="formbricks"
readonly APP_URL="http://localhost:3000"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
fail() { printf '\033[31mError: %s\033[0m\n' "$1" >&2; exit 1; }

cd "${REPO_ROOT}"
mkdir -p "${LOG_DIR}"

# ---------------------------------------------------------------------------
# 1. PostgreSQL, including pgvector.
#
# pgvector is NOT optional and NOT visible in schema.prisma. Migration
# 20241017124431_add_documents_and_insights runs `CREATE EXTENSION vector`, and migrations
# replay history, so a stock cluster fails with P3018 / 0A000 partway through. Install it
# BEFORE the first migrate: a failed migration is recorded in _prisma_migrations and blocks
# every retry until the database is dropped.
# ---------------------------------------------------------------------------
step "PostgreSQL"

PG_MAJOR="$(ls /usr/lib/postgresql 2>/dev/null | sort -n | tail -1 || true)"
[[ -n "${PG_MAJOR}" ]] || fail "No PostgreSQL server found under /usr/lib/postgresql. Install postgresql-16 or newer."
info "Found PostgreSQL ${PG_MAJOR}"

if [[ ! -f "/usr/share/postgresql/${PG_MAJOR}/extension/vector.control" ]]; then
  info "Installing pgvector (postgresql-${PG_MAJOR}-pgvector)"
  apt-get install -y "postgresql-${PG_MAJOR}-pgvector" >"${LOG_DIR}/apt.log" 2>&1 \
    || fail "pgvector install failed. See ${LOG_DIR}/apt.log"
else
  info "pgvector already present"
fi

if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  info "Starting cluster ${PG_MAJOR}/main"
  pg_ctlcluster "${PG_MAJOR}" main start || true
  for _ in $(seq 1 30); do
    pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 && break
    sleep 1
  done
fi
pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 || fail "PostgreSQL did not accept TCP connections."

# DATABASE_URL in .env.example expects postgres:postgres over TCP; the packaged cluster
# ships with peer auth and no password, so set one explicitly.
su postgres -c "psql -qc \"ALTER USER postgres WITH PASSWORD 'postgres';\"" >/dev/null
su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" | grep -q 1 \
  || su postgres -c "createdb ${DB_NAME}"
info "Database '${DB_NAME}' ready on :5432"

# ---------------------------------------------------------------------------
# 2. Redis (stands in for Valkey from the compose stack).
# ---------------------------------------------------------------------------
step "Redis"
if redis-cli ping >/dev/null 2>&1; then
  info "Already running"
else
  redis-server --daemonize yes --save '' --appendonly no
  for _ in $(seq 1 15); do redis-cli ping >/dev/null 2>&1 && break; sleep 1; done
  redis-cli ping >/dev/null 2>&1 || fail "Redis did not start."
  info "Started on :6379"
fi

# ---------------------------------------------------------------------------
# 3. Environment file. Generates the four required secrets; idempotent.
#    apps/web/.env is a symlink to this one, so there is only a single file.
# ---------------------------------------------------------------------------
step "Environment file"
bash "${REPO_ROOT}/scripts/setup-dev-env.sh"

# CI disables rate limiting for E2E (.github/workflows/e2e.yml). Without this the auth security
# specs trip the limiter, and later tests fail with 429s that look like real bugs.
if ! grep -qE '^RATE_LIMITING_DISABLED=1' "${REPO_ROOT}/.env"; then
  printf '\nRATE_LIMITING_DISABLED=1\n' >>"${REPO_ROOT}/.env"
  info "Disabled rate limiting (matches CI E2E)"
fi

# ---------------------------------------------------------------------------
# 4. Dependencies.
# ---------------------------------------------------------------------------
step "Dependencies"
pnpm install >"${LOG_DIR}/install.log" 2>&1 || fail "pnpm install failed. See ${LOG_DIR}/install.log"
info "Installed"

# ---------------------------------------------------------------------------
# 5. Workspace packages.
#
# apps/web imports workspace packages from their dist/ output, and the turbo `dev` task
# declares no dependsOn, so nothing builds them implicitly. Without this the dev server
# fails to resolve imports or serves stale bundles.
# ---------------------------------------------------------------------------
step "Workspace packages"
pnpm build --filter=@formbricks/web^... >"${LOG_DIR}/build.log" 2>&1 \
  || fail "Package build failed. See ${LOG_DIR}/build.log"
info "Built"

# ---------------------------------------------------------------------------
# 5b. Playwright browser shim.
#
# The pinned Playwright wants a specific Chromium build; sandboxes ship whatever was
# pre-provisioned, and `playwright install` is blocked when the CDN is unreachable. Point the
# expected build at the available one. The headless-shell layout changed across builds, so the
# shell path is wired to the full chrome binary, which accepts the same headless flags.
# No-op when the expected build is already present.
# ---------------------------------------------------------------------------
step "Playwright browsers"
PW_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
if [[ -d "${PW_PATH}" ]]; then
  WANT="$(node -e "const b=require('${REPO_ROOT}/node_modules/playwright-core/browsers.json');
    const c=b.browsers.find(x=>x.name==='chromium'); process.stdout.write(c?c.revision:'')" 2>/dev/null || true)"
  HAVE="$(ls -d "${PW_PATH}"/chromium-* 2>/dev/null | grep -oE '[0-9]+$' | sort -n | tail -1 || true)"

  if [[ -n "${WANT}" && -n "${HAVE}" && "${WANT}" != "${HAVE}" ]]; then
    info "Shimming Chromium ${HAVE} as ${WANT}"
    ln -sfn "${PW_PATH}/chromium-${HAVE}" "${PW_PATH}/chromium-${WANT}"
    rm -rf "${PW_PATH}/chromium_headless_shell-${WANT}"
    mkdir -p "${PW_PATH}/chromium_headless_shell-${WANT}/chrome-headless-shell-linux64"
    ln -sfn "${PW_PATH}/chromium-${HAVE}/chrome-linux/chrome" \
      "${PW_PATH}/chromium_headless_shell-${WANT}/chrome-headless-shell-linux64/chrome-headless-shell"
    touch "${PW_PATH}/chromium_headless_shell-${WANT}/INSTALLATION_COMPLETE" \
      "${PW_PATH}/chromium_headless_shell-${WANT}/DEPENDENCIES_VALIDATED"
  else
    info "Expected build present (${WANT:-unknown})"
  fi
else
  info "No pre-provisioned browser path at ${PW_PATH}; skipping"
fi

# ---------------------------------------------------------------------------
# 6. Schema, then seed data.
#
# db:seed creates admin/manager/member users plus an organization, workspace and several
# surveys — which skips the entire onboarding wizard.
# ---------------------------------------------------------------------------
step "Migrations"
pnpm db:migrate:dev >"${LOG_DIR}/migrate.log" 2>&1 \
  || fail "Migrations failed. See ${LOG_DIR}/migrate.log"
info "Applied"

step "Seed data"
pnpm db:seed >"${LOG_DIR}/seed.log" 2>&1 || fail "Seeding failed. See ${LOG_DIR}/seed.log"
info "Seeded — admin@formbricks.com / Password#123"

# ---------------------------------------------------------------------------
# 7. Dev server. playwright.config.ts has no webServer block, so specs assume this is
#    already up at baseURL http://localhost:3000.
# ---------------------------------------------------------------------------
step "Dev server"
if curl -sSf --noproxy '*' -m 5 -o /dev/null "${APP_URL}" 2>/dev/null; then
  info "Already responding on :3000"
else
  nohup pnpm --filter=@formbricks/web dev >"${DEV_LOG}" 2>&1 &
  info "Starting (first compile takes ~50s under Turbopack)"
  ready=""
  for _ in $(seq 1 60); do
    if curl -sSf --noproxy '*' -m 10 -o /dev/null "${APP_URL}" 2>/dev/null; then ready=1; break; fi
    sleep 5
  done
  [[ -n "${ready}" ]] || fail "Dev server did not respond within 5 minutes. See ${DEV_LOG}"
fi

code="$(curl -sS --noproxy '*' -m 30 -o /dev/null -w '%{http_code}' "${APP_URL}")"
step "Ready"
info "App:    ${APP_URL} (HTTP ${code})"
info "Login:  admin@formbricks.com / Password#123"
info "Logs:   ${LOG_DIR}/"
info ""
info "Not available without Docker: Mailhog (email), RustFS (uploads), Cube (analytics), Hub (AI)."
