#!/bin/bash
+set -euo pipefail
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

exec "$@" 