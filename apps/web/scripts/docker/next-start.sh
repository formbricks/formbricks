#!/bin/sh

set -euo pipefail
if [ "${DOCKER_CRON_ENABLED:-1}" = "1" ]; then
  echo "Starting cron jobs...";
  supercronic -quiet /app/docker/cronjobs &
else
  echo "Docker cron jobs are disabled via DOCKER_CRON_ENABLED=0";
fi;
(cd packages/database && npm run db:migrate:deploy) &&
(cd packages/database && npm run db:create-saml-database:deploy) &&
exec node apps/web/server.js