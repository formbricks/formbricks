#!/bin/sh

set -eu
export NODE_ENV=production

# Start cron jobs if enabled
if [ "${DOCKER_CRON_ENABLED:-1}" = "1" ]; then
  echo "Starting cron jobs...";
  supercronic -quiet /app/docker/cronjobs &
else
  echo "Docker cron jobs are disabled via DOCKER_CRON_ENABLED=0";
fi

echo "🗃️ Running database migrations..."

# Add timeout to prevent hanging indefinitely, but still run the migrations
timeout 300 sh -c '(cd packages/database && npm run db:migrate:deploy)' || {
  echo "❌ Database migration timed out after 5 minutes"
  echo "📋 This might indicate database connectivity issues"
  exit 1
}

echo "🗃️ Running SAML database setup..."
timeout 60 sh -c '(cd packages/database && npm run db:create-saml-database:deploy)' || {
  echo "❌ SAML database setup timed out after 1 minute"
  echo "📋 This might indicate database connectivity issues"
  exit 1
}

echo "✅ Database setup completed"
echo "🚀 Starting Next.js server..."
exec node apps/web/server.js