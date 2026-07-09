#!/bin/sh

set -eu
export NODE_ENV=production

# Run a command under a timeout when available (installing coreutils on Alpine if
# needed), and report accurately: a genuine timeout (exit 124/137) is distinguished
# from any other non-zero exit, so an expected failure — e.g. the migration check
# reporting pending migrations — is not mislabelled as a timeout.
run_with_timeout() {
  _timeout_duration="$1"
  _timeout_name="$2"
  shift 2

  if ! command -v timeout >/dev/null 2>&1 && command -v apk >/dev/null 2>&1; then
    echo "⚠️ timeout command not found, attempting to install..."
    apk add --no-cache coreutils >/dev/null 2>&1 \
      || echo "⚠️ Could not install timeout; running $_timeout_name without timeout protection"
  fi

  _status=0
  if command -v timeout >/dev/null 2>&1; then
    echo "Using timeout ($_timeout_duration seconds) for $_timeout_name"
    timeout "$_timeout_duration" "$@" || _status=$?
  else
    echo "Running $_timeout_name without timeout protection..."
    "$@" || _status=$?
  fi

  if [ "$_status" -eq 0 ]; then
    return 0
  elif [ "$_status" -eq 124 ] || [ "$_status" -eq 137 ]; then
    echo "❌ $_timeout_name timed out after $_timeout_duration seconds"
    echo "📋 This might indicate database connectivity issues"
    exit 1
  else
    echo "❌ $_timeout_name failed (exit code $_status)"
    exit "$_status"
  fi
}


# The web runtime image no longer bundles the Prisma CLI, so it cannot migrate
# itself. Migrations run in the dedicated formbricks-migrate image (Helm Job,
# docker-compose one-shot service, or a manual one-shot container) BEFORE the web
# app starts (ENG-1153). Verify the database is fully migrated and fail fast
# otherwise, instead of serving traffic against an empty or half-migrated schema.
# Operators who apply migrations fully out-of-band can opt out with
# SKIP_MIGRATION_CHECK=true (at their own risk).
if [ "${SKIP_MIGRATION_CHECK:-false}" = "true" ]; then
  echo "⏭️ Skipping startup migration check (SKIP_MIGRATION_CHECK=true)"
else
  echo "🗃️ Verifying database migrations are applied..."
  run_with_timeout 60 "migration check" node packages/database/dist/scripts/check-migrations.js
fi

echo "🗃️ Running SAML database setup..."
run_with_timeout 60 "SAML database setup" node packages/database/dist/scripts/create-saml-database.js

echo "✅ Database setup completed"
echo "🚀 Starting Next.js server..."
exec node apps/web/server.js
