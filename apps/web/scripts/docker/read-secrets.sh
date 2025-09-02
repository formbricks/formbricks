#!/bin/sh

set -eu
if [ -f "/run/secrets/database_url" ]; then
  IFS= read -r DATABASE_URL < /run/secrets/database_url || true
  DATABASE_URL=${DATABASE_URL%$'\n'}
  export DATABASE_URL
else
  echo "DATABASE_URL secret not found. Build may fail if this is required."
fi

if [ -f "/run/secrets/encryption_key" ]; then
  IFS= read -r ENCRYPTION_KEY < /run/secrets/encryption_key || true
  ENCRYPTION_KEY=${ENCRYPTION_KEY%$'\n'}
  export ENCRYPTION_KEY
else
  echo "ENCRYPTION_KEY secret not found. Build may fail if this is required."
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
echo "  SENTRY_AUTH_TOKEN: $([ -n "${SENTRY_AUTH_TOKEN:-}" ] && printf '[SET]' || printf '[NOT SET]')"
echo "  TARGETARCH: $([ -n "${TARGETARCH:-}" ] && printf '%s' "${TARGETARCH}" || printf '[NOT SET]')"

exec "$@" 