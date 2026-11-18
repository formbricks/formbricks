#!/bin/sh

set -eu
export NODE_ENV=production

echo "Validating environment variables..."
node /home/nextjs/validate-env.mjs --server

# coreutils' timeout bounds each database step, so a hung connection fails the start instead of blocking it.
run_with_timeout() {
  _timeout_duration="$1"
  _timeout_name="$2"
  shift 2

  echo "Using timeout ($_timeout_duration seconds) for $_timeout_name"
  if ! timeout "$_timeout_duration" "$@"; then
    echo "❌ $_timeout_name failed or timed out after $_timeout_duration seconds"
    echo "📋 This might indicate database connectivity issues"
    exit 1
  fi
}


# Check if migrations should be skipped (e.g., when using Helm migration job)
if [ "${SKIP_STARTUP_MIGRATION:-false}" = "true" ]; then
  echo "⏭️ Skipping startup migrations (handled by migration job)"
else
  echo "🗃️ Running database migrations..."
  run_with_timeout 300 "database migration" node packages/database/dist/scripts/apply-migrations.js
fi

echo "🗃️ Running SAML database setup..."
run_with_timeout 60 "SAML database setup" node packages/database/dist/scripts/create-saml-database.js

echo "✅ Database setup completed"
echo "🚀 Starting Next.js server..."
exec node apps/web/online-server.js
