#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMMON_ARGS=(--set formbricks.webappUrl=https://qa.example.com)

temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT

# `helm template` deliberately omits NOTES.txt, while Helm 3.15 still contacts Kubernetes during a dry-run
# install. Evaluate the real notes through `tpl` in a minimal ConfigMap chart so this contract remains
# clusterless and release-accurate across supported Helm versions.
notes_chart="${temp_dir}/notes-chart"
mkdir -p "${notes_chart}/templates"
cp "${CHART_DIR}/values.yaml" "${notes_chart}/values.yaml"
cp "${CHART_DIR}/templates/_helpers.tpl" "${notes_chart}/templates/_helpers.tpl"
cp "${CHART_DIR}/templates/NOTES.txt" "${notes_chart}/notes.txt"
printf '%s\n' \
  'apiVersion: v2' \
  'name: formbricks-notes-contract' \
  'version: 0.0.0' \
  'appVersion: 0.0.0' >"${notes_chart}/Chart.yaml"
printf '%s\n' \
  'apiVersion: v1' \
  'kind: ConfigMap' \
  'metadata:' \
  '  name: notes-contract' \
  'data:' \
  '  notes: |' \
  '{{ tpl (.Files.Get "notes.txt") . | nindent 4 }}' >"${notes_chart}/templates/notes.yaml"

render_notes() {
  local release_name="$1"
  shift

  helm template "${release_name}" "${notes_chart}" --namespace qa "${COMMON_ARGS[@]}" "$@" \
    --show-only templates/notes.yaml \
    | sed -n '/^  notes: |/,$p' \
    | sed '1d; s/^    //'
}

authzed_operations_notes() {
  sed -n '/AuthZed \/ SpiceDB Operations:/,/^---$/p' <<<"$1"
}

assert_safe_authzed_notes() {
  local release_name="$1"
  local notes="$2"

  if grep --extended-regexp --ignore-case 'preshared|datastore_uri|token|ingress' <<<"${notes}" >/dev/null; then
    printf '%s\n' "AuthZed operations notes for ${release_name} must not expose secrets or suggest an Ingress." >&2
    exit 1
  fi
}

disabled_notes="$(render_notes authzed-disabled --set authzed.enabled=false)"
if grep --fixed-strings "AuthZed / SpiceDB Operations:" <<<"${disabled_notes}" >/dev/null; then
  printf '%s\n' "AuthZed operations notes must be hidden when AuthZed is disabled." >&2
  exit 1
fi

external_notes="$(render_notes authzed-external \
  --set authzed.enabled=true \
  --set authzed.mode=external \
  --set authzed.operator.install=false \
  --set authzed.endpoint=grpc.authzed.com:443 \
  --set authzed.insecure=false \
  --set authzed.auth.existingSecret=formbricks-authzed)"

authzed_notes="$(authzed_operations_notes "${external_notes}")"
grep --fixed-strings 'SpiceDB is configured in `external` mode.' <<<"${authzed_notes}" >/dev/null
grep --fixed-strings 'formbricks-authzed health' <<<"${authzed_notes}" >/dev/null
grep --fixed-strings 'formbricks-authzed schema check' <<<"${authzed_notes}" >/dev/null
grep --fixed-strings 'formbricks-authzed activation runtime-check' <<<"${authzed_notes}" >/dev/null
grep --fixed-strings 'self-hosting/advanced/authzed-operations' <<<"${authzed_notes}" >/dev/null
assert_safe_authzed_notes authzed-external "${authzed_notes}"

# Fresh installs render an ordinary, idempotent bootstrap Job. It is not a Helm post-install hook:
# the Deployment waits for its DB receipt, so a post-install hook would deadlock behind readiness.
default_install="$(helm template authzed-default "${CHART_DIR}" "${COMMON_ARGS[@]}")"
grep --fixed-strings 'name: formbricks-authzed-install-bootstrap' <<<"${default_install}" >/dev/null
grep --fixed-strings 'formbricks-authzed activation bootstrap' <<<"${default_install}" >/dev/null
grep --fixed-strings 'argocd.argoproj.io/sync-wave: "1"' <<<"${default_install}" >/dev/null
if grep --fixed-strings 'helm.sh/hook: post-install' <<<"${default_install}" >/dev/null; then
  printf '%s\n' "Fresh AuthZed bootstrap must not be a post-install hook." >&2
  exit 1
fi
grep --fixed-strings 'argocd.argoproj.io/sync-wave: "0"' <<<"${default_install}" >/dev/null
grep --fixed-strings 'argocd.argoproj.io/sync-wave: "2"' <<<"${default_install}" >/dev/null
grep --fixed-strings 'value: fully_consistent' <<<"${default_install}" >/dev/null
grep --fixed-strings 'name: AUTHZED_ACTIVATION_STARTUP_WAIT_SECONDS' <<<"${default_install}" >/dev/null
grep --fixed-strings 'name: AUTHZED_ACTIVATION_STARTUP_INTERVAL_SECONDS' <<<"${default_install}" >/dev/null

custom_startup_wait="$(helm template authzed-custom-startup-wait "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set-string deployment.env.AUTHZED_ACTIVATION_STARTUP_WAIT_SECONDS=60 \
  --set-string deployment.env.AUTHZED_ACTIVATION_STARTUP_INTERVAL_SECONDS=2)"
custom_startup_wait_deployment="$(sed -n \
  '/^# Source: formbricks\/templates\/deployment.yaml$/,/^---$/p' <<<"${custom_startup_wait}")"
if [ "$(grep --count 'name: AUTHZED_ACTIVATION_STARTUP_WAIT_SECONDS' <<<"${custom_startup_wait_deployment}")" -ne 1 ] || \
  [ "$(grep --count 'name: AUTHZED_ACTIVATION_STARTUP_INTERVAL_SECONDS' <<<"${custom_startup_wait_deployment}")" -ne 1 ]; then
  printf '%s\n' "Explicit startup receipt wait overrides must replace the chart defaults." >&2
  exit 1
fi
grep --fixed-strings 'value: "60"' <<<"${custom_startup_wait_deployment}" >/dev/null
grep --fixed-strings 'value: "2"' <<<"${custom_startup_wait_deployment}" >/dev/null

install_migration="$(sed -n '/name: formbricks-migration/,/^---$/p' <<<"${default_install}")"
if grep --fixed-strings 'helm.sh/hook:' <<<"${install_migration}" >/dev/null; then
  printf '%s\n' "The fresh-install migration must be an ordinary resource." >&2
  exit 1
fi
grep --fixed-strings 'argocd.argoproj.io/sync-wave: "-1"' <<<"${install_migration}" >/dev/null

install_database_bootstrap="$(sed -n '/name: formbricks-spicedb-database-bootstrap/,/^---$/p' \
  <<<"${default_install}")"
if grep --fixed-strings 'helm.sh/hook:' <<<"${install_database_bootstrap}" >/dev/null; then
  printf '%s\n' "The fresh-install AuthZed database bootstrap must be an ordinary resource." >&2
  exit 1
fi
grep --fixed-strings 'argocd.argoproj.io/sync-wave: "-1"' <<<"${install_database_bootstrap}" >/dev/null

install_bootstrap="$(sed -n '/name: formbricks-authzed-install-bootstrap/,/^---$/p' <<<"${default_install}")"
if grep --fixed-strings 'envFrom:' <<<"${install_bootstrap}" >/dev/null; then
  printf '%s\n' "The install bootstrap must use explicit secretKeyRef entries, not broad envFrom imports." >&2
  exit 1
fi
grep --fixed-strings 'name: formbricks-app-secrets' <<<"${install_bootstrap}" >/dev/null
grep --fixed-strings 'key: DATABASE_URL' <<<"${install_bootstrap}" >/dev/null

if missing_activation_database_secret="$(helm template authzed-no-app-secret "${CHART_DIR}" \
  "${COMMON_ARGS[@]}" --set secret.enabled=false 2>&1)"; then
  printf '%s\n' "Activation Jobs must refuse an implicit DATABASE_URL when app Secret management is disabled." >&2
  exit 1
fi
grep --fixed-strings 'authzed.activation.database.existingSecret is required' \
  <<<"${missing_activation_database_secret}" >/dev/null

explicit_activation_database="$(helm template authzed-explicit-app-secret "${CHART_DIR}" \
  "${COMMON_ARGS[@]}" \
  --set secret.enabled=false \
  --set authzed.activation.database.existingSecret=customer-database \
  --set authzed.activation.database.urlKey=url)"
explicit_install_bootstrap="$(sed -n '/name: formbricks-authzed-install-bootstrap/,/^---$/p' \
  <<<"${explicit_activation_database}")"
grep --fixed-strings 'name: customer-database' <<<"${explicit_install_bootstrap}" >/dev/null
grep --fixed-strings 'key: url' <<<"${explicit_install_bootstrap}" >/dev/null

if implicit_custom_database="$(helm template authzed-implicit-custom-database "${CHART_DIR}" \
  "${COMMON_ARGS[@]}" --set-string deployment.env.DATABASE_URL=postgresql://database.example/formbricks 2>&1)"; then
  printf '%s\n' "A custom application database must name the activation database Secret explicitly." >&2
  exit 1
fi
grep --fixed-strings 'authzed.activation.database.existingSecret is required when deployment.env' \
  <<<"${implicit_custom_database}" >/dev/null

helm template authzed-explicit-custom-database "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set-string deployment.env.DATABASE_URL=postgresql://database.example/formbricks \
  --set authzed.activation.database.existingSecret=customer-database >/dev/null

if retired_initialization_error="$(helm template authzed-retired-initialization "${CHART_DIR}" \
  "${COMMON_ARGS[@]}" --set authzed.initialization.enabled=false 2>&1)"; then
  printf '%s\n' "The retired AuthZed initialization values must be rejected." >&2
  exit 1
fi
grep --fixed-strings 'authzed.initialization was replaced' <<<"${retired_initialization_error}" >/dev/null

if retired_acknowledgement_error="$(helm template authzed-retired-acknowledgement "${CHART_DIR}" \
  "${COMMON_ARGS[@]}" --set authzed.migrationAcknowledged=true 2>&1)"; then
  printf '%s\n' "The retired boolean migration acknowledgement must be rejected." >&2
  exit 1
fi
grep --fixed-strings 'authzed.migrationAcknowledged was removed' <<<"${retired_acknowledgement_error}" >/dev/null

for authzed_override in \
  AUTHZED_ENABLED \
  AUTHZED_ENDPOINT \
  AUTHZED_TOKEN \
  AUTHZED_SYSTEM_KEY \
  AUTHZED_INSECURE \
  AUTHZED_CONSISTENCY; do
  if split_authzed_contract="$(helm template authzed-split-contract "${CHART_DIR}" \
    "${COMMON_ARGS[@]}" --set-string "deployment.env.${authzed_override}=test-value" 2>&1)"; then
    printf '%s\n' "${authzed_override} must have one chart-level source of truth." >&2
    exit 1
  fi
  grep --fixed-strings "deployment.env.${authzed_override} is not supported" \
    <<<"${split_authzed_contract}" >/dev/null
done

if retired_migration_enabled_error="$(helm template authzed-retired-migration-enabled "${CHART_DIR}" \
  "${COMMON_ARGS[@]}" --set migration.enabled=true 2>&1)"; then
  printf '%s\n' "The ambiguous migration.enabled switch must be rejected." >&2
  exit 1
fi
grep --fixed-strings 'migration.enabled was replaced by migration.mode' \
  <<<"${retired_migration_enabled_error}" >/dev/null

startup_install="$(helm template authzed-startup-migrations "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set migration.mode=startup)"
if grep --fixed-strings 'name: formbricks-migration' <<<"${startup_install}" >/dev/null; then
  printf '%s\n' "migration.mode=startup must not render a migration Job." >&2
  exit 1
fi
if grep --fixed-strings 'name: SKIP_STARTUP_MIGRATION' <<<"${startup_install}" >/dev/null; then
  printf '%s\n' "migration.mode=startup must leave startup migrations enabled." >&2
  exit 1
fi

external_migration_install="$(helm template authzed-external-migrations "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set migration.mode=external)"
if grep --fixed-strings 'name: formbricks-migration' <<<"${external_migration_install}" >/dev/null; then
  printf '%s\n' "migration.mode=external must not render a migration Job." >&2
  exit 1
fi
grep --fixed-strings 'name: SKIP_STARTUP_MIGRATION' <<<"${external_migration_install}" >/dev/null

if invalid_migration_mode="$(helm template authzed-invalid-migration "${CHART_DIR}" \
  "${COMMON_ARGS[@]}" --set migration.mode=automatic 2>&1)"; then
  printf '%s\n' "Unknown migration ownership must fail at render time." >&2
  exit 1
fi
grep --fixed-strings 'migration.mode must be one of' <<<"${invalid_migration_mode}" >/dev/null

if invalid_startup_wait="$(helm template authzed-invalid-startup-wait "${CHART_DIR}" \
  "${COMMON_ARGS[@]}" --set authzed.activation.startupWait.timeoutSeconds=0 2>&1)"; then
  printf '%s\n' "An unbounded startup receipt configuration must fail at render time." >&2
  exit 1
fi
grep --fixed-strings 'authzed.activation.startupWait.timeoutSeconds must be between 1 and 3600' \
  <<<"${invalid_startup_wait}" >/dev/null

helm template authzed-null-annotations "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set-json 'deployment.annotations=null' >/dev/null

if authzed_disabled_error="$(helm template authzed-disabled "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set authzed.enabled=false 2>&1)"; then
  printf '%s\n' "Formbricks v6 must refuse a chart deployment with AuthZed disabled." >&2
  exit 1
fi
grep --fixed-strings 'Formbricks v6 requires AuthZed' <<<"${authzed_disabled_error}" >/dev/null

if mutable_upgrade="$(helm template authzed-mutable-upgrade "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --is-upgrade \
  --set global.postgresql.auth.password=test-password \
  --set global.postgresql.auth.postgresPassword=test-password 2>&1)"; then
  printf '%s\n' "Every Helm upgrade must pin the exact application image by digest." >&2
  exit 1
fi
grep --fixed-strings 'deployment.image.digest must be a lowercase sha256 digest for every Formbricks v6 Helm upgrade' \
  <<<"${mutable_upgrade}" >/dev/null

if mutable_bridge_upgrade="$(helm template authzed-mutable-bridge-upgrade "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --is-upgrade \
  --set global.postgresql.auth.password=test-password \
  --set global.postgresql.auth.postgresPassword=test-password \
  --set authzed.activation.upgradeGate.enabled=false 2>&1)"; then
  printf '%s\n' "The bridge exception must still pin the exact application image by digest." >&2
  exit 1
fi
grep --fixed-strings 'deployment.image.digest must be a lowercase sha256 digest for every Formbricks v6 Helm upgrade' \
  <<<"${mutable_bridge_upgrade}" >/dev/null

readonly TEST_IMAGE_DIGEST="sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
gated_upgrade="$(helm template authzed-upgrade "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --is-upgrade \
  --set global.postgresql.auth.password=test-password \
  --set global.postgresql.auth.postgresPassword=test-password \
  --set migration.mode=external \
  --set deployment.image.digest="${TEST_IMAGE_DIGEST}")"
grep --fixed-strings 'name: formbricks-authzed-upgrade-gate' <<<"${gated_upgrade}" >/dev/null
grep --fixed-strings 'args: ["activation", "runtime-check"]' <<<"${gated_upgrade}" >/dev/null
grep --fixed-strings 'helm.sh/hook: pre-upgrade' <<<"${gated_upgrade}" >/dev/null
grep --fixed-strings 'helm.sh/hook-weight: "20"' <<<"${gated_upgrade}" >/dev/null
if grep --fixed-strings 'name: formbricks-authzed-install-bootstrap' <<<"${gated_upgrade}" >/dev/null; then
  printf '%s\n' "An upgrade must not render the fresh-install bootstrap." >&2
  exit 1
fi
if grep --fixed-strings 'name: formbricks-migration' <<<"${gated_upgrade}" >/dev/null; then
  printf '%s\n' "The first receipt-gated candidate must not race an in-chart migration Job." >&2
  exit 1
fi
if grep --fixed-strings 'envFrom:' <<<"$(sed -n '/name: formbricks-authzed-upgrade-gate/,/^---$/p' <<<"${gated_upgrade}")" >/dev/null; then
  printf '%s\n' "The receipt gate must use explicit secretKeyRef entries, not broad envFrom imports." >&2
  exit 1
fi
gated_upgrade_job="$(sed -n '/name: formbricks-authzed-upgrade-gate/,/^---$/p' <<<"${gated_upgrade}")"
grep --fixed-strings 'name: formbricks-app-secrets' <<<"${gated_upgrade_job}" >/dev/null
grep --fixed-strings 'key: DATABASE_URL' <<<"${gated_upgrade_job}" >/dev/null
grep --fixed-strings 'name: formbricks-authzed' <<<"${gated_upgrade_job}" >/dev/null

if grep --extended-regexp 'authzed (initialize|upgrade (prepare|check))' <<<"${default_install}${gated_upgrade}" >/dev/null; then
  printf '%s\n' "Permanent chart resources must not invoke the retired cutover protocol." >&2
  exit 1
fi

bridge_upgrade="$(helm template authzed-bridge "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --is-upgrade \
  --set global.postgresql.auth.password=test-password \
  --set global.postgresql.auth.postgresPassword=test-password \
  --set authzed.activation.upgradeGate.enabled=false \
  --set deployment.image.digest="${TEST_IMAGE_DIGEST}")"
if grep --fixed-strings 'name: formbricks-authzed-upgrade-gate' <<<"${bridge_upgrade}" >/dev/null; then
  printf '%s\n' "The initial bridge rollout must be able to defer the candidate receipt gate." >&2
  exit 1
fi

# Render each supported ownership and datastore shape. These are intentionally render-only checks: none
# of the operational commands are Helm hooks or automatically created Jobs.
helm template authzed-bundled "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=true >/dev/null

bundled_notes="$(render_notes authzed-bundled \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=true)"
assert_safe_authzed_notes authzed-bundled "$(authzed_operations_notes "${bundled_notes}")"

helm template authzed-existing-operator "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=false \
  --set authzed.auth.existingSecret=formbricks-authzed \
  --set authzed.datastore.existingSecret=formbricks-authzed >/dev/null

existing_operator_notes="$(render_notes authzed-existing-operator \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=false \
  --set authzed.auth.existingSecret=formbricks-authzed \
  --set authzed.datastore.existingSecret=formbricks-authzed)"
assert_safe_authzed_notes authzed-existing-operator "$(authzed_operations_notes "${existing_operator_notes}")"

managed_postgresql_notes="$(render_notes authzed-managed-postgresql \
  --set postgresql.enabled=false \
  --set-string postgresql.externalDatabaseUrl=postgresql://formbricks:notes-secret@postgres.example:5432/formbricks?sslmode=require \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=false \
  --set authzed.auth.existingSecret=formbricks-authzed \
  --set authzed.datastore.existingSecret=formbricks-authzed)"

if grep --fixed-strings 'notes-secret' <<<"${managed_postgresql_notes}" >/dev/null; then
  printf '%s\n' "Helm notes must not render PostgreSQL credentials." >&2
  exit 1
fi
assert_safe_authzed_notes authzed-managed-postgresql \
  "$(authzed_operations_notes "${managed_postgresql_notes}")"

helm template authzed-external "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set authzed.enabled=true \
  --set authzed.mode=external \
  --set authzed.operator.install=false \
  --set authzed.endpoint=grpc.authzed.com:443 \
  --set authzed.insecure=false \
  --set authzed.auth.existingSecret=formbricks-authzed >/dev/null

# ENG-2390: the bundled database bootstrap must not hard-require a role named `postgres`.
# An existing PostgreSQL installed without one previously had no option but to disable bootstrap
# entirely, which left the SpiceDB role and database uncreated.

render_bootstrap() {
  helm template "$1" "${CHART_DIR}" "${COMMON_ARGS[@]}" \
    --set authzed.enabled=true \
    --set authzed.mode=selfHosted \
    "${@:2}" \
    --show-only templates/authzed-postgresql-bootstrap.yaml
}

# The default is unchanged: the bundled `postgres` superuser on the `postgres` database.
default_bootstrap="$(render_bootstrap authzed-bootstrap-default)"
grep --quiet 'value: "postgres"' <<<"${default_bootstrap}"

# The regression itself. Without an override this still refuses, but it must name the way out
# rather than simply asserting that enablePostgresUser is required.
if bootstrap_refusal="$(render_bootstrap authzed-bootstrap-no-superuser \
  --set postgresql.auth.enablePostgresUser=false 2>&1)"; then
  printf '%s\n' "Bootstrap must refuse a missing postgres superuser when no admin role is configured." >&2
  exit 1
fi
grep --quiet 'adminUsername' <<<"${bootstrap_refusal}"

# ...and configuring an existing administrative role is what unblocks it.
existing_admin_bootstrap="$(render_bootstrap authzed-bootstrap-existing-admin \
  --set postgresql.auth.enablePostgresUser=false \
  --set authzed.bundledPostgresqlBootstrap.adminUsername=fbadmin \
  --set authzed.bundledPostgresqlBootstrap.adminDatabase=formbricks \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordSecretName=existing-pg-admin \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordKey=password)"
grep --quiet 'value: "fbadmin"' <<<"${existing_admin_bootstrap}"
grep --quiet 'value: "formbricks"' <<<"${existing_admin_bootstrap}"
grep --quiet 'name: existing-pg-admin' <<<"${existing_admin_bootstrap}"

# Matti's finding on #8875: the key needs its own guard. `$bundledAdminKey` falls back to the
# subchart's non-empty default, so "is it set at all" can never fail for a custom role, and forgetting
# the key silently looks up the subchart's key name inside the operator's own Secret.
if render_bootstrap authzed-bootstrap-admin-without-key \
  --set authzed.bundledPostgresqlBootstrap.adminUsername=fbadmin \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordSecretName=existing-pg-admin >/dev/null 2>&1; then
  printf '%s\n' "Bootstrap must require adminPasswordKey when adminUsername is overridden." >&2
  exit 1
fi

# An existing server whose privileged role is called `postgres` is a configured administrator, not the
# bundled superuser — supplying its Secret explicitly must be accepted even with enablePostgresUser=false.
explicit_postgres_bootstrap="$(render_bootstrap authzed-bootstrap-explicit-postgres \
  --set postgresql.auth.enablePostgresUser=false \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordSecretName=existing-pg-admin \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordKey=password)"
grep --quiet 'value: "postgres"' <<<"${explicit_postgres_bootstrap}"
grep --quiet 'name: existing-pg-admin' <<<"${explicit_postgres_bootstrap}"

# ...but that administrator still supplies its own Secret, which is no likelier to carry the
# subchart's key name than any other. Keying the key guard off the username left this configuration
# rendering a dangling secretKeyRef (Bhagya's finding on #8875, and CodeRabbit's before it), so the
# guard keys off the credential source and this render must be refused.
if render_bootstrap authzed-bootstrap-explicit-postgres-without-key \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordSecretName=existing-pg-admin >/dev/null 2>&1; then
  printf '%s\n' "Bootstrap must require adminPasswordKey when the administrator Secret is configured explicitly." >&2
  exit 1
fi

# A custom admin role with no Secret would silently fall back to the bundled superuser's password.
if render_bootstrap authzed-bootstrap-admin-without-secret \
  --set authzed.bundledPostgresqlBootstrap.adminUsername=fbadmin >/dev/null 2>&1; then
  printf '%s\n' "Bootstrap must require adminPasswordSecretName when adminUsername is overridden." >&2
  exit 1
fi

# Credentials reach the Job only by reference, in every mode.
#
# Asserted structurally, per Bhagya's finding on #8875. The previous check grepped for `PGPASSWORD: `,
# a shape the renderer never emits — env entries are `- name: PGPASSWORD` followed by `value:` or
# `valueFrom:`. A literal leak therefore matched nothing and the test passed through the exact
# regression it existed to catch. A whole-manifest regex cannot do better: it cannot tell a `value:`
# under PGPASSWORD from the legitimate one under PGHOST. So walk the env list instead and check how
# each sensitive entry is supplied.
assert_env_supplied_by_reference() {
  local manifest="$1" variable="$2"

  awk -v target="${variable}" '
    /^[[:space:]]*-[[:space:]]+name:[[:space:]]/ {
      if (current == target) { seen = 1; if (source != "reference") literal = 1 }
      current = $3
      source = ""
      next
    }
    current == target && /^[[:space:]]*value:/ { source = "literal" }
    current == target && /^[[:space:]]*valueFrom:/ { source = "reference" }
    END {
      if (current == target) { seen = 1; if (source != "reference") literal = 1 }
      if (!seen) { print "absent"; exit 2 }
      if (literal) { print "literal"; exit 1 }
      print "reference"
    }
  ' <<<"${manifest}"
}

for credential_variable in PGPASSWORD SPICEDB_DATABASE_PASSWORD; do
  if ! supplied_by="$(assert_env_supplied_by_reference "${existing_admin_bootstrap}" "${credential_variable}")"; then
    printf '%s\n' "Bootstrap must supply ${credential_variable} by secret reference, found: ${supplied_by}." >&2
    exit 1
  fi
done

external_bootstrap="$(render_bootstrap authzed-bootstrap-external \
  --set authzed.bundledPostgresqlBootstrap.enabled=false \
  --set authzed.externalPostgresqlBootstrap.enabled=true \
  --set authzed.externalPostgresqlBootstrap.adminSecretName=external-pg-admin \
  --set authzed.datastore.existingSecret=external-datastore)"
for credential_variable in ADMIN_DATABASE_URL SPICEDB_DATABASE_PASSWORD; do
  if ! supplied_by="$(assert_env_supplied_by_reference "${external_bootstrap}" "${credential_variable}")"; then
    printf '%s\n' "External bootstrap must supply ${credential_variable} by secret reference, found: ${supplied_by}." >&2
    exit 1
  fi
done

printf '%s\n' "AuthZed Helm operations contracts are valid."
