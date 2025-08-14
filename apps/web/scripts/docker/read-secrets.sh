#!/bin/sh

set -eu
if [ -f "/run/secrets/database_url" ]; then
  export DATABASE_URL=$(cat /run/secrets/database_url)
else
  echo "DATABASE_URL secret not found. Build may fail if this is required."
fi

if [ -f "/run/secrets/encryption_key" ]; then
  export ENCRYPTION_KEY=$(cat /run/secrets/encryption_key)
else
  echo "ENCRYPTION_KEY secret not found. Build may fail if this is required."
fi

if [ -f "/run/secrets/sentry_auth_token" ]; then
  # Only upload sourcemaps on amd64 platform to avoid duplicate uploads
  # Sourcemaps are platform-agnostic, so we only need to upload once
  # TARGETARCH is automatically set by Docker during multi-platform builds
  if [ "${TARGETARCH:-}" = "amd64" ]; then
    export SENTRY_AUTH_TOKEN=$(cat /run/secrets/sentry_auth_token)
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
echo "🔍 Environment verification before build:"
echo "  DATABASE_URL: ${DATABASE_URL:+[SET]} ${DATABASE_URL:-[NOT SET]}"
echo "  ENCRYPTION_KEY: ${ENCRYPTION_KEY:+[SET]} ${ENCRYPTION_KEY:-[NOT SET]}"
echo "  SENTRY_AUTH_TOKEN: ${SENTRY_AUTH_TOKEN:+[SET]} ${SENTRY_AUTH_TOKEN:-[NOT SET]}"
echo "  TARGETARCH: ${TARGETARCH:-[NOT SET]}"

exec "$@" 