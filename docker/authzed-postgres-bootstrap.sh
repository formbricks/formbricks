#!/bin/sh

set -eu

: "${POSTGRES_ADMIN_URL:?POSTGRES_ADMIN_URL is required}"
: "${AUTHZED_DATABASE_PASSWORD:?AUTHZED_DATABASE_PASSWORD is required}"

AUTHZED_DATABASE_NAME="${AUTHZED_DATABASE_NAME:-spicedb}"
AUTHZED_DATABASE_USERNAME="${AUTHZED_DATABASE_USERNAME:-spicedb}"

psql "${POSTGRES_ADMIN_URL}" \
  --set=ON_ERROR_STOP=1 \
  --set=database_name="${AUTHZED_DATABASE_NAME}" \
  --set=database_username="${AUTHZED_DATABASE_USERNAME}" \
  --set=database_password="${AUTHZED_DATABASE_PASSWORD}" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'database_username', :'database_password')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'database_username'
) \gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'database_username', :'database_password') \gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'database_name', :'database_username')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'database_name'
) \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'database_name', :'database_username') \gexec
SQL

printf '%s\n' "AuthZed database bootstrap completed."
