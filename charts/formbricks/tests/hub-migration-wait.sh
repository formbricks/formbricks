#!/usr/bin/env bash

# Once the migration Job is gone (ttlSecondsAfterFinished), Hub's wait-for-formbricks-migration init
# container falls back to the persisted migration markers. It may only expect markers apply-migrations
# actually writes: deferred migrations never run, so expecting them kept every Hub pod created after the
# Job's TTL in Init forever (ENG-3948). This runs the rendered script itself against a fixture image.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd -- "${CHART_DIR}/../.." && pwd)"
readonly SCRIPT_DIR CHART_DIR REPO_DIR
readonly DEFERRED_MIGRATION="20260928120000_eng_2404_backfill_remaining_embedded_data"

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

render() {
  helm template qa "${CHART_DIR}" \
    --set formbricks.webappUrl=https://qa.example.com \
    --show-only "templates/$1"
}

# The chart requires the phase helper from the image, so the database build has to emit it there.
grep -q '"scripts/migration-phases": resolve(__dirname, "src/scripts/migration-phases.ts")' \
  "${REPO_DIR}/packages/database/vite.config.ts" ||
  fail "packages/database must build scripts/migration-phases for the Hub migration wait"

# The Hub mirrors the maintenance phase because that is what the migration Job runs.
if render migration-job.yaml | grep -q -- '--phase'; then
  fail "The migration Job now passes --phase; update MIGRATION_PHASE in hub-deployment.yaml to match"
fi

render hub-deployment.yaml >"${tmp}/hub.yaml"
node - "${tmp}/hub.yaml" "${tmp}/wait.js" <<'JS'
const fs = require("node:fs");
const [rendered, out] = process.argv.slice(2);
const lines = fs.readFileSync(rendered, "utf8").split("\n");
const container = lines.findIndex((line) => /^\s+- name: wait-for-formbricks-migration$/.test(line));
const start = lines.findIndex((line, index) => index > container && /^\s+- \|-?$/.test(line));
if (container < 0 || start < 0) throw new Error("wait-for-formbricks-migration script not rendered");
const indent = /^\s*/.exec(lines[start + 1])[0];
const body = [];
for (const line of lines.slice(start + 1)) {
  if (line.trim() !== "" && !line.startsWith(indent)) break;
  body.push(line.slice(indent.length));
}
fs.writeFileSync(out, body.join("\n"));
JS

# The migration Job is already gone: every Kubernetes lookup is a 404, which sends the script to the markers.
cat >"${tmp}/fake-kubernetes.cjs" <<'JS'
const fs = require("node:fs");
const https = require("node:https");
const { EventEmitter } = require("node:events");
const serviceAccount = "/var/run/secrets/kubernetes.io/serviceaccount/";
const readFileSync = fs.readFileSync;
fs.readFileSync = (file, ...rest) =>
  String(file).startsWith(serviceAccount) ? "fixture" : readFileSync(file, ...rest);
https.request = (_options, callback) => {
  const request = new EventEmitter();
  request.end = () => {
    const response = new EventEmitter();
    response.statusCode = 404;
    response.setEncoding = () => {};
    callback(response);
    process.nextTick(() => {
      response.emit("data", '{"reason":"NotFound"}');
      response.emit("end");
    });
  };
  return request;
};
JS

# A fixture image tree: one schema and one data migration that ran, plus the deferred data migration that
# apply-migrations never runs. QA_NEVER_APPLIED lists the markers the database lacks.
make_image() {
  local root="$1" with_phases="$2" with_deferred="$3"
  local dist="${root}/packages/database/dist"
  mkdir -p "${dist}/src" "${dist}/scripts" "${dist}/migration/20250101000000_schema_one" \
    "${dist}/migration/20250101000001_data_one"
  printf '{"type":"module"}\n' >"${root}/packages/database/package.json"
  printf 'SELECT 1;\n' >"${dist}/migration/20250101000000_schema_one/migration.sql"
  printf 'export const dataOne = { type: "data", id: "data-one", name: "20250101000001_data_one" };\n' \
    >"${dist}/migration/20250101000001_data_one/migration.js"
  if [[ "${with_deferred}" == yes ]]; then
    mkdir -p "${dist}/migration/${DEFERRED_MIGRATION}"
    printf 'export const deferred = { type: "data", id: "deferred-data", name: "%s" };\n' "${DEFERRED_MIGRATION}" \
      >"${dist}/migration/${DEFERRED_MIGRATION}/migration.js"
  fi
  if [[ "${with_phases}" == yes ]]; then
    cat >"${dist}/scripts/migration-phases.cjs" <<JS
exports.shouldRunMigration = (name, phase) => {
  if (phase !== "maintenance") throw new Error("Hub must mirror the migration Job's phase, got " + phase);
  return name !== "${DEFERRED_MIGRATION}";
};
JS
  fi
  cat >"${dist}/src/prisma.cjs" <<'JS'
const neverApplied = new Set((process.env.QA_NEVER_APPLIED || "").split(",").filter(Boolean));
class PrismaClient {
  async $queryRaw(strings, requested) {
    const applied = requested.filter((marker) => !neverApplied.has(marker));
    return strings.join("?").includes("_prisma_migrations")
      ? applied.map((migration_name) => ({ migration_name }))
      : applied.map((id) => ({ id }));
  }
  async $disconnect() {}
}
module.exports = { Prisma: { join: (values) => values }, PrismaClient };
JS
  printf 'exports.createPrismaPgAdapter = () => ({ adapter: {} });\n' >"${dist}/src/prisma-adapter.cjs"
}

run_wait() {
  local root="$1" never_applied="$2"
  (
    cd "${root}"
    QA_NEVER_APPLIED="${never_applied}" \
      FORMBRICKS_MIGRATION_JOB_NAME=formbricks-migration \
      FORMBRICKS_MIGRATION_WAIT_MAX_ATTEMPTS=2 \
      FORMBRICKS_MIGRATION_WAIT_MISSING_JOB_MAX_ATTEMPTS=1 \
      FORMBRICKS_MIGRATION_WAIT_INTERVAL_SECONDS=1 \
      KUBERNETES_SERVICE_HOST=127.0.0.1 \
      NODE_OPTIONS="--require ${tmp}/fake-kubernetes.cjs" \
      node -e "$(cat "${tmp}/wait.js")"
  )
}

readonly started="all Formbricks migration success markers are present"

# 6.1 image: the deferred migration has no marker, as on every real install, and Hub still starts.
make_image "${tmp}/current" yes yes
output="$(run_wait "${tmp}/current" deferred-data 2>&1)" ||
  fail "Hub must start when only a deferred migration lacks its marker:"$'\n'"${output}"
grep -q "${started}" <<<"${output}" || fail "Expected the marker fallback to start Hub:"$'\n'"${output}"

# A migration the Job does run is still required: missing its marker keeps Hub waiting.
if output="$(run_wait "${tmp}/current" data-one 2>&1)"; then
  fail "Hub must keep waiting while a migration that runs lacks its marker:"$'\n'"${output}"
fi
grep -q "Data migration markers are incomplete; 1 data migration(s) are missing." <<<"${output}" ||
  fail "Expected the missing data migration to be reported:"$'\n'"${output}"

# Images that predate migration phases have no deferred migrations and no helper; Hub still starts.
make_image "${tmp}/older" no no
output="$(run_wait "${tmp}/older" "" 2>&1)" ||
  fail "Hub must start on an image without the phase helper:"$'\n'"${output}"
grep -q "Migration phases are not available in this image" <<<"${output}" ||
  fail "Expected the phase-helper fallback to be logged:"$'\n'"${output}"
grep -q "${started}" <<<"${output}" || fail "Expected the marker fallback to start Hub:"$'\n'"${output}"

printf 'Hub migration wait skips deferred migrations and still requires the ones that run\n'
