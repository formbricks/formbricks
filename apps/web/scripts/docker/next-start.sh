#!/bin/sh

set -eu
export NODE_ENV=production

# Function to run command with timeout if available, or without timeout as fallback
run_with_timeout() {
  _timeout_duration="$1"
  _timeout_name="$2"
  shift 2
  
  if command -v timeout >/dev/null 2>&1; then
    # timeout command is available, use it
    echo "Using timeout ($_timeout_duration seconds) for $_timeout_name"
    if ! timeout "$_timeout_duration" "$@"; then
      echo "❌ $_timeout_name timed out after $_timeout_duration seconds"
      echo "📋 This might indicate database connectivity issues"
      exit 1
    fi
  else
    # timeout not available, try to install it or run without timeout
    echo "⚠️ timeout command not found, attempting to install..."
    if command -v apk >/dev/null 2>&1; then
      apk add --no-cache coreutils >/dev/null 2>&1 || {
        echo "⚠️ Could not install timeout, running $_timeout_name without timeout protection"
        echo "📋 Note: Process may hang indefinitely if there are connectivity issues"
      }
    fi
    
    # Run the command (either with newly installed timeout or without timeout)
    if command -v timeout >/dev/null 2>&1; then
      echo "✅ timeout installed, using timeout ($_timeout_duration seconds) for $_timeout_name"
      if ! timeout "$_timeout_duration" "$@"; then
        echo "❌ $_timeout_name timed out after $_timeout_duration seconds"
        echo "📋 This might indicate database connectivity issues"
        exit 1
      fi
    else
      echo "Running $_timeout_name without timeout protection..."
      if ! "$@"; then
        echo "❌ $_timeout_name failed"
        echo "📋 This might indicate database connectivity issues"
        exit 1
      fi
    fi
  fi
}


# The web runtime image no longer bundles the Prisma CLI, so it cannot migrate
# itself. Migrations run in the dedicated formbricks-migrate image (Helm Job,
# docker-compose one-shot service, or a manual one-shot container) BEFORE the web
# app starts (ENG-1153). Verify the database is fully migrated and fail fast
# otherwise, instead of serving traffic against an empty or half-migrated schema.
echo "🗃️ Verifying database migrations are applied..."
run_with_timeout 60 "migration check" node packages/database/dist/scripts/check-migrations.js

echo "🗃️ Running SAML database setup..."
run_with_timeout 60 "SAML database setup" node packages/database/dist/scripts/create-saml-database.js

echo "✅ Database setup completed"
echo "🚀 Starting Next.js server..."
exec node apps/web/server.js
