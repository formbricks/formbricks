#!/bin/sh

set -eu

# Build-time fallbacks used only when Docker secrets are unavailable (for example
# in forked PR validations where repository secrets are not exposed).
DEFAULT_DATABASE_URL="postgresql://test:test@localhost:5432/formbricks"
DEFAULT_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef"
DEFAULT_REDIS_URL="redis://localhost:6379"

if [ -f "/run/secrets/database_url" ]; then
  IFS= read -r DATABASE_URL < /run/secrets/database_url || true
fi
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="${DEFAULT_DATABASE_URL}"
  echo "⚠️  DATABASE_URL secret not found or empty. Using build-time fallback value."
fi
export DATABASE_URL

if [ -f "/run/secrets/encryption_key" ]; then
  IFS= read -r ENCRYPTION_KEY < /run/secrets/encryption_key || true
fi
if [ -z "${ENCRYPTION_KEY:-}" ]; then
  ENCRYPTION_KEY="${DEFAULT_ENCRYPTION_KEY}"
  echo "⚠️  ENCRYPTION_KEY secret not found or empty. Using build-time fallback value."
fi
export ENCRYPTION_KEY

if [ -f "/run/secrets/redis_url" ]; then
  IFS= read -r REDIS_URL < /run/secrets/redis_url || true
fi
if [ -z "${REDIS_URL:-}" ]; then
  REDIS_URL="${DEFAULT_REDIS_URL}"
  echo "⚠️  REDIS_URL secret not found or empty. Using build-time fallback value."
fi
export REDIS_URL

if [ -f "/run/secrets/posthog_key" ]; then
  IFS= read -r POSTHOG_KEY < /run/secrets/posthog_key || true
fi
if [ -n "${POSTHOG_KEY:-}" ]; then
  export POSTHOG_KEY
  echo "✅ POSTHOG_KEY secret found. PostHog proxy rewrites will be generated."
else
  echo "ℹ️  POSTHOG_KEY secret not found. PostHog proxy rewrites will not be generated."
fi

if [ -f "/run/secrets/sentry_auth_token" ]; then
  # Only upload sourcemaps on amd64 platform to avoid duplicate uploads
  # Sourcemaps are platform-agnostic, so we only need to upload once
  # TARGETARCH is automatically set by Docker during multi-platform builds
  if [ "${TARGETARCH:-}" = "amd64" ]; then
    IFS= read -r SENTRY_AUTH_TOKEN < /run/secrets/sentry_auth_token || true
    SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN%$'\n'}
    export SENTRY_AUTH_TOKEN
    echo "✅ Sentry auth token found. Sourcemaps will be uploaded during build (${TARGETARCH} platform)."
    echo "🔧 SENTRY_AUTH_TOKEN environment variable exported for build process."
  else
    echo "✅ Sentry auth token found but skipping upload on ${TARGETARCH:-unknown} platform."
    echo "ℹ️  Sourcemaps will only be uploaded on amd64 platform to avoid duplicates."
    echo "🔧 Debug IDs will still be injected for proper error correlation."
  fi
else
  echo "⚠️  SENTRY_AUTH_TOKEN secret not found. Sourcemaps will not be uploaded but Debug IDs will still be injected."
fi

# Verify environment variables are set before starting build
echo "  DATABASE_URL: $([ -n "${DATABASE_URL:-}" ] && printf '[SET]' || printf '[NOT SET]')"
echo "  ENCRYPTION_KEY: $([ -n "${ENCRYPTION_KEY:-}" ] && printf '[SET]' || printf '[NOT SET]')"
echo "  REDIS_URL: $([ -n "${REDIS_URL:-}" ] && printf '[SET]' || printf '[NOT SET]')"
echo "  SENTRY_AUTH_TOKEN: $([ -n "${SENTRY_AUTH_TOKEN:-}" ] && printf '[SET]' || printf '[NOT SET]')"
echo "  POSTHOG_KEY: $([ -n "${POSTHOG_KEY:-}" ] && printf '[SET]' || printf '[NOT SET]')"
echo "  TARGETARCH: $([ -n "${TARGETARCH:-}" ] && printf '%s' "${TARGETARCH}" || printf '[NOT SET]')"

exec "$@" 
