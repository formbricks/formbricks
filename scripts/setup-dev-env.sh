#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_EXAMPLE="$REPO_ROOT/.env.example"
ENV_FILE="$REPO_ROOT/.env"

if [ ! -f "$ENV_EXAMPLE" ]; then
  echo "❌ Could not find template file at .env.example."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "✅ Created .env from .env.example."
else
  echo "ℹ️ Using existing .env."
fi

changed=()
for key in ENCRYPTION_KEY NEXTAUTH_SECRET CRON_SECRET; do
  value=$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)

  if [ -z "$value" ]; then
    secret=$(openssl rand -hex 32)
    sed -i.bak "s|^${key}=.*|${key}=${secret}|" "$ENV_FILE"
    changed+=("$key")
  fi
done

rm -f "$ENV_FILE.bak"

if [ ${#changed[@]} -gt 0 ]; then
  echo "🔐 Updated .env: $(IFS=', '; echo "${changed[*]}")."
else
  echo "✅ .env already has all required generated secrets."
fi

echo "🚀 Development environment file is ready."
