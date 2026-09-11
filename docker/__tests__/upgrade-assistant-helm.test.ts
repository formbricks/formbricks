import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const assistantPath = join(repositoryRoot, "docker/formbricks-upgrade-assistant");
const bridgeDigest = `sha256:${"a".repeat(64)}`;
const targetDigest = `sha256:${"b".repeat(64)}`;
const bridgeManifestDigest = `sha256:${"c".repeat(64)}`;
const targetManifestDigest = `sha256:${"d".repeat(64)}`;
const postgresBootstrapImage = `pgvector/pgvector@sha256:${"e".repeat(64)}`;
const spicedbImage = `authzed/spicedb@sha256:${"f".repeat(64)}`;
const receipt = "00000000-0000-4000-8000-000000000001";
const temporaryDirectories: string[] = [];

const hash = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

const temporaryDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "formbricks-upgrade-helm-"));
  temporaryDirectories.push(directory);
  return directory;
};

const executable = (path: string, contents: string): void => {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
};

type TFixture = Readonly<{
  bin: string;
  bundle: string;
  clusterState: string;
  commandLog: string;
  crdState: string;
  effectiveValues: string;
  gitopsMode: TGitOpsState;
  hpaState: string;
  manifest: string;
  releases: string;
  state: string;
  temporaryValuesLog: string;
  upgradeLockState: string;
}>;

type TCrdState = "missing" | "compatible" | "incompatible" | "unestablished";
type THpaState = "chart" | "external" | "multiple" | "none";
type TGitOpsState = "argocd" | "fluxHelmRelease" | "none";
type TDatabaseSource =
  | "configMap"
  | "databaseWithEnvFromNoMigrate"
  | "envFromOnly"
  | "literal"
  | "migrateDifferentSecret"
  | "migrateSameSecret"
  | "missingKey"
  | "optional"
  | "secretRef"
  | "templatedSecretRef";

const createFixture = (
  directory: string,
  options: Readonly<{
    authzedMode?: "external" | "selfHosted";
    crd?: TCrdState;
    databaseSource?: TDatabaseSource;
    disableIstioInject?: boolean;
    gitops?: Exclude<TGitOpsState, "none">;
    hpa?: THpaState;
    invalidChart?: boolean;
    helmVersion?: string;
    operatorInstall?: boolean;
    unsafePodAnnotations?: boolean;
    unsafeSecurityContexts?: boolean;
  }> = {}
): TFixture => {
  const bundle = join(directory, "bundle");
  const bin = join(directory, "bin");
  const manifest = join(bundle, "formbricks-upgrade-manifest.json");
  const mainChart = join(bundle, "formbricks-6.0.0.tgz");
  const upgradeChart = join(bundle, "formbricks-upgrade-6.0.0.tgz");
  const spicedbCrd = join(bundle, "authzed.com_spicedbclusters.yaml");
  const checksums = join(bundle, "formbricks-upgrade-checksums.txt");
  const commandLog = join(directory, "commands.log");
  const clusterState = join(directory, "cluster.json");
  const crdState = join(directory, "spicedb-crd.json");
  const hpaState = join(directory, "hpas.json");
  const releases = join(directory, "releases.json");
  const values = join(directory, "values.json");
  const effectiveValues = join(directory, "effective-values.json");
  const jobState = join(directory, "job.json");
  const temporaryReleaseState = join(directory, "temporary-release.json");
  const upgradeLockState = join(directory, "upgrade-lock.json");
  const interruptMarker = join(directory, "interrupt.marker");
  const mainHistory = join(directory, "main-history.json");
  const mainRevisions = join(directory, "main-revisions");
  const state = join(directory, "upgrade-state.json");
  const temporaryValuesLog = join(directory, "temporary-values.jsonl");
  const databaseSecret = "database-secret-that-must-not-escape";
  const customDatabaseDeployment = (() => {
    const secretKeyRef = {
      valueFrom: {
        secretKeyRef: {
          name:
            options.databaseSource === "templatedSecretRef"
              ? "{{ .Release.Name }}-database"
              : "customer-database",
          key: "DATABASE_URL",
        },
      },
    };
    switch (options.databaseSource) {
      case "configMap":
        return {
          env: {
            DATABASE_URL: {
              valueFrom: { configMapKeyRef: { name: "customer-database", key: "DATABASE_URL" } },
            },
          },
        };
      case "envFromOnly":
        return { envFrom: { database: { type: "secret", name: "customer-database" } } };
      case "databaseWithEnvFromNoMigrate":
        return {
          env: { DATABASE_URL: secretKeyRef },
          envFrom: { database: { type: "secret", name: "customer-migration-database" } },
        };
      case "literal":
        return { env: { DATABASE_URL: "postgresql://database.example/formbricks" } };
      case "migrateDifferentSecret":
        return {
          env: {
            DATABASE_URL: secretKeyRef,
            MIGRATE_DATABASE_URL: {
              valueFrom: {
                secretKeyRef: { name: "customer-migration-database", key: "MIGRATE_DATABASE_URL" },
              },
            },
          },
        };
      case "migrateSameSecret":
        return {
          env: {
            DATABASE_URL: secretKeyRef,
            MIGRATE_DATABASE_URL: {
              valueFrom: { secretKeyRef: { name: "customer-database", key: "DIRECT_DATABASE_URL" } },
            },
          },
        };
      case "missingKey":
        return {
          env: { DATABASE_URL: { valueFrom: { secretKeyRef: { name: "customer-database" } } } },
        };
      case "optional":
        return {
          env: {
            DATABASE_URL: {
              valueFrom: {
                secretKeyRef: { name: "customer-database", key: "DATABASE_URL", optional: true },
              },
            },
          },
        };
      case "secretRef":
      case "templatedSecretRef":
        return { env: { DATABASE_URL: secretKeyRef } };
      case undefined:
        return {};
    }
  })();
  const liveDatabaseEnvironment = (() => {
    switch (options.databaseSource) {
      case "configMap":
        return [
          {
            name: "DATABASE_URL",
            valueFrom: { configMapKeyRef: { name: "customer-database", key: "DATABASE_URL" } },
          },
        ];
      case "literal":
        return [{ name: "DATABASE_URL", value: "postgresql://database.example/formbricks" }];
      case "missingKey":
        return [{ name: "DATABASE_URL", valueFrom: { secretKeyRef: { name: "customer-database" } } }];
      case "optional":
        return [
          {
            name: "DATABASE_URL",
            valueFrom: {
              secretKeyRef: { name: "customer-database", key: "DATABASE_URL", optional: true },
            },
          },
        ];
      case "migrateDifferentSecret":
        return [
          {
            name: "DATABASE_URL",
            valueFrom: { secretKeyRef: { name: "customer-database", key: "DATABASE_URL" } },
          },
          {
            name: "MIGRATE_DATABASE_URL",
            valueFrom: {
              secretKeyRef: { name: "customer-migration-database", key: "MIGRATE_DATABASE_URL" },
            },
          },
        ];
      case "migrateSameSecret":
        return [
          {
            name: "DATABASE_URL",
            valueFrom: { secretKeyRef: { name: "customer-database", key: "DATABASE_URL" } },
          },
          {
            name: "MIGRATE_DATABASE_URL",
            valueFrom: { secretKeyRef: { name: "customer-database", key: "DIRECT_DATABASE_URL" } },
          },
        ];
      case "secretRef":
      case "templatedSecretRef":
      case "databaseWithEnvFromNoMigrate":
        return [
          {
            name: "DATABASE_URL",
            valueFrom: { secretKeyRef: { name: "customer-database", key: "DATABASE_URL" } },
          },
        ];
      case "envFromOnly":
      case undefined:
        return [];
    }
  })();

  mkdirSync(bundle);
  mkdirSync(bin);
  mkdirSync(mainRevisions);
  writeFileSync(commandLog, "");
  writeFileSync(temporaryValuesLog, "");
  writeFileSync(mainChart, "signed-main-chart");
  writeFileSync(upgradeChart, options.invalidChart ? "tampered-upgrade-chart" : "signed-upgrade-chart");
  const spicedbCrdDocument = {
    apiVersion: "apiextensions.k8s.io/v1",
    kind: "CustomResourceDefinition",
    metadata: { name: "spicedbclusters.authzed.com" },
    spec: {
      group: "authzed.com",
      names: { kind: "SpiceDBCluster", plural: "spicedbclusters" },
      scope: "Namespaced",
      versions: [
        {
          name: "v1alpha1",
          served: true,
          storage: true,
          schema: {
            openAPIV3Schema: {
              properties: {
                spec: {
                  properties: {
                    channel: { type: "string" },
                    config: { type: "object" },
                    credentials: {
                      properties: {
                        datastoreURI: {
                          properties: { key: { type: "string" }, secretName: { type: "string" } },
                        },
                        presharedKey: {
                          properties: { key: { type: "string" }, secretName: { type: "string" } },
                        },
                      },
                    },
                    patches: { type: "array" },
                    version: { type: "string" },
                  },
                },
              },
            },
          },
          subresources: { status: {} },
        },
      ],
    },
  };
  writeFileSync(spicedbCrd, JSON.stringify(spicedbCrdDocument));
  if ((options.crd ?? "missing") !== "missing") {
    const established = options.crd === "unestablished" ? "False" : "True";
    const existingCrd = {
      ...spicedbCrdDocument,
      spec:
        options.crd === "incompatible"
          ? { ...spicedbCrdDocument.spec, group: "incompatible.example" }
          : spicedbCrdDocument.spec,
      status: { conditions: [{ status: established, type: "Established" }] },
    };
    writeFileSync(crdState, JSON.stringify(existingCrd));
  }
  writeFileSync(
    manifest,
    JSON.stringify({
      schemaVersion: 1,
      releaseVersion: "6.0.0",
      sourceRevision: "0123456789012345678901234567890123456789",
      minimumSourceVersion: "5.4.0",
      supportedPreActivationVersions: ["6.0.0-rc.1", "6.0.0-rc.2"],
      supportedInstallTypes: ["docker_compose", "helm", "one_click"],
      artifacts: {
        bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        bridgeRuntimeManifestDigest: bridgeManifestDigest,
        formbricksChart: "formbricks-6.0.0.tgz",
        dockerAuthzedOverlaySha256: `sha256:${"e".repeat(64)}`,
        authzedPostgresBootstrapSha256: `sha256:${"f".repeat(64)}`,
        postgresBootstrapImage,
        spicedbImage,
        spicedbClusterCrdSha256: `sha256:${hash(spicedbCrd)}`,
        targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
        targetRuntimeManifestDigest: targetManifestDigest,
        upgradeChart: "formbricks-upgrade-6.0.0.tgz",
      },
    })
  );
  writeFileSync(
    checksums,
    [
      `${hash(manifest)}  formbricks-upgrade-manifest.json`,
      `${hash(spicedbCrd)}  authzed.com_spicedbclusters.yaml`,
      `${hash(mainChart)}  formbricks-6.0.0.tgz`,
      `${createHash("sha256").update("signed-upgrade-chart").digest("hex")}  formbricks-upgrade-6.0.0.tgz`,
      "",
    ].join("\n")
  );
  writeFileSync(
    releases,
    JSON.stringify([
      {
        name: "customer",
        namespace: "private",
        chart: "formbricks-5.4.0",
        app_version: "5.4.3",
        status: "deployed",
        revision: "7",
      },
    ])
  );
  writeFileSync(
    values,
    JSON.stringify({
      migration: { enabled: true },
      authzed: {
        initialization: { enabled: true },
        migrationAcknowledged: true,
        mode: options.authzedMode ?? "selfHosted",
        ...(options.operatorInstall === undefined ? {} : { operator: { install: options.operatorInstall } }),
      },
      deployment: {
        image: { digest: `sha256:${"9".repeat(64)}` },
        ...customDatabaseDeployment,
      },
      postgresql: {
        enabled: options.databaseSource === undefined,
        auth: { password: databaseSecret },
      },
      ...(options.databaseSource === undefined ? {} : { secret: { enabled: false } }),
    })
  );
  writeFileSync(
    effectiveValues,
    JSON.stringify({
      nameOverride: "formbricks",
      deployment: {
        nodeSelector: {},
        tolerations: [],
        affinity: {},
        disableIstioInject: options.disableIstioInject ?? false,
        ...customDatabaseDeployment,
        ...(options.unsafePodAnnotations === true
          ? {
              additionalPodAnnotations: {
                "sidecar.istio.io/inject": "true",
                "vault.hashicorp.com/agent-inject": "true",
              },
            }
          : {}),
        ...(options.unsafeSecurityContexts === true
          ? {
              securityContext: {
                fsGroup: 0,
                runAsGroup: 0,
                runAsNonRoot: false,
                runAsUser: 0,
                seccompProfile: { type: "Unconfined" },
              },
              containerSecurityContext: {
                allowPrivilegeEscalation: true,
                capabilities: { add: ["SYS_ADMIN"], drop: [] },
                privileged: true,
                readOnlyRootFilesystem: false,
                runAsNonRoot: false,
                runAsUser: 0,
              },
            }
          : {}),
      },
      authzed: {
        mode: options.authzedMode ?? "selfHosted",
        endpoint: options.authzedMode === "external" ? "grpc.authzed.com:443" : "",
        insecure: options.authzedMode === "external" ? false : null,
        systemKey: "formbricks",
        auth: {
          existingSecret: options.authzedMode === "external" ? "external-authzed" : "",
          tokenKey: "preshared_key",
        },
        cluster: { name: "" },
        activation: { database: { existingSecret: "", urlKey: "DATABASE_URL" } },
        ...(options.operatorInstall === undefined ? {} : { operator: { install: options.operatorInstall } }),
      },
    })
  );
  writeFileSync(
    clusterState,
    JSON.stringify({
      authority: "legacy",
      transition: "idle",
      image: `ghcr.io/formbricks/formbricks@sha256:${"9".repeat(64)}`,
      imageID: `ghcr.io/formbricks/formbricks@sha256:${"9".repeat(64)}`,
      replicas: 2,
      hpa: true,
      environment: liveDatabaseEnvironment,
    })
  );
  const chartHpa = {
    metadata: {
      annotations: {
        "meta.helm.sh/release-name": "customer",
        "meta.helm.sh/release-namespace": "private",
      },
      labels: {
        "app.kubernetes.io/component": "formbricks",
        "app.kubernetes.io/instance": "customer",
        "app.kubernetes.io/managed-by": "Helm",
      },
      name: "formbricks",
      namespace: "private",
    },
    spec: {
      maxReplicas: 5,
      minReplicas: 2,
      scaleTargetRef: { apiVersion: "apps/v1", kind: "Deployment", name: "formbricks" },
    },
  };
  const externalHpa = {
    metadata: {
      annotations: {},
      labels: { "app.kubernetes.io/managed-by": "platform-team" },
      name: "customer-workload-autoscaler",
      namespace: "private",
    },
    spec: {
      maxReplicas: 8,
      minReplicas: 3,
      scaleTargetRef: { apiVersion: "apps/v1", kind: "Deployment", name: "formbricks" },
    },
  };
  const hpaItems = (() => {
    switch (options.hpa ?? "chart") {
      case "chart":
        return [chartHpa];
      case "external":
        return [externalHpa];
      case "multiple":
        return [chartHpa, externalHpa];
      case "none":
        return [];
    }
  })();
  writeFileSync(hpaState, JSON.stringify({ items: hpaItems }));
  writeFileSync(jobState, JSON.stringify({ execution: 0, phase: "none" }));
  writeFileSync(temporaryReleaseState, JSON.stringify({ name: "", revision: 0, status: "absent" }));
  writeFileSync(mainHistory, JSON.stringify([{ revision: 7, status: "deployed" }]));
  writeFileSync(join(mainRevisions, "7.json"), readFileSync(values));

  executable(
    join(bin, "helm"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'helm %s\n' "$*" >> "$COMMAND_LOG"
case "$1" in
  version) printf '%s\n' '${options.helmVersion ?? "v3.15.4"}' ;;
  list)
    if [[ $(jq -r '.status' "$TEMP_RELEASE_STATE") == "absent" ]]; then
      cat "$RELEASES_JSON"
    else
      jq -c --slurpfile temporary "$TEMP_RELEASE_STATE" \
        '. + [{name:$temporary[0].name,namespace:"private",chart:"formbricks-upgrade-6.0.0",app_version:"6.0.0",status:$temporary[0].status,revision:($temporary[0].revision | tostring)}]' \
        "$RELEASES_JSON"
    fi
    ;;
  get)
    revision=""
    previous=""
    for argument in "$@"; do
      if [[ "$previous" == "--revision" ]]; then revision="$argument"; fi
      previous="$argument"
    done
    if [[ -n "$revision" ]]; then cat "$MAIN_REVISIONS/$revision.json"
    elif [[ "$*" == *" --all "* ]]; then cat "$EFFECTIVE_VALUES_JSON"
    else cat "$VALUES_JSON"
    fi
    ;;
  status) printf '%s\n' '{"version":7,"info":{"status":"deployed"}}' ;;
  template)
    found_cleanup=false
    previous=""
    for argument in "$@"; do
      if [[ "$previous" == "--values" ]] &&
        jq -e '
          (.migration | has("enabled")) and .migration.enabled == null and
          (.authzed | has("migrationAcknowledged")) and .authzed.migrationAcknowledged == null and
          (.authzed | has("initialization")) and .authzed.initialization == null
        ' \
          "$argument" >/dev/null 2>&1; then
        found_cleanup=true
      fi
      previous="$argument"
    done
    [[ "$found_cleanup" == "true" ]]
    ;;
  upgrade)
    previous=""
    values_file=""
    for argument in "$@"; do
      if [[ "$previous" == "--values" ]]; then values_file="$argument"; fi
      previous="$argument"
    done
    if [[ "$*" == *"--dry-run=server"* ]]; then
      [[ "$*" == *"--hide-secret"* ]]
      if [[ "$2" == "--install" ]]; then
        jq -e '
          .targetRelease == "customer" and
          (.phase | IN("status", "prepare", "audit", "activate", "rollback-begin", "rollback-complete")) and
          (.job | type == "object")
        ' "$values_file" >/dev/null
        exit 0
      fi
      found_cleanup=false
      previous=""
      for argument in "$@"; do
        if [[ "$previous" == "--values" ]] &&
          jq -e '
            (.migration | has("enabled")) and .migration.enabled == null and
            (.authzed | has("migrationAcknowledged")) and .authzed.migrationAcknowledged == null and
            (.authzed | has("initialization")) and .authzed.initialization == null
          ' "$argument" >/dev/null 2>&1; then
          found_cleanup=true
        fi
        previous="$argument"
      done
      [[ "$found_cleanup" == "true" ]]
      exit 0
    fi
    if [[ "$2" == "--install" ]]; then
      temporary_release="$3"
      phase=$(jq -r '.phase' "$values_file")
      execution=$(jq -r '.execution' "$values_file")
      printf 'temporary-values phase=%s execution=%s\n' "$phase" "$execution" >> "$COMMAND_LOG"
      jq -c '{phase,database,job}' "$values_file" >> "$TEMP_VALUES_LOG"
      jq -cn --arg phase "$phase" --argjson execution "$execution" '{phase:$phase,execution:$execution}' > "$JOB_STATE"
      case "$phase" in
        prepare) jq '.transition="prepared"' "$CLUSTER_STATE" > "$CLUSTER_STATE.tmp" ;;
        activate) jq '.authority="spicedb" | .transition="activating"' "$CLUSTER_STATE" > "$CLUSTER_STATE.tmp" ;;
        rollback-begin) jq '.authority="spicedb" | .transition="rolling_back"' "$CLUSTER_STATE" > "$CLUSTER_STATE.tmp" ;;
        rollback-complete) jq '.authority="legacy" | .transition="idle"' "$CLUSTER_STATE" > "$CLUSTER_STATE.tmp" ;;
        *) cp "$CLUSTER_STATE" "$CLUSTER_STATE.tmp" ;;
      esac
      mv "$CLUSTER_STATE.tmp" "$CLUSTER_STATE"
      previous_revision=$(jq -r '.revision' "$TEMP_RELEASE_STATE")
      next_revision=$((previous_revision + 1))
      if [[ "$INTERRUPT_PHASE" == "$phase" && ! -e "$INTERRUPT_MARKER" ]]; then
        if [[ "$previous_revision" == "0" ]]; then pending_status=pending-install; else pending_status=pending-upgrade; fi
        jq -cn --arg name "$temporary_release" --arg status "$pending_status" --argjson revision "$next_revision" \
          '{name:$name,status:$status,revision:$revision}' > "$TEMP_RELEASE_STATE"
        touch "$INTERRUPT_MARKER"
        assistant_pid=$(ps -o ppid= -p "$PPID" | tr -d ' ')
        kill -9 "$assistant_pid"
        exit 137
      fi
      jq -cn --arg name "$temporary_release" --argjson revision "$next_revision" \
        '{name:$name,status:"deployed",revision:$revision}' > "$TEMP_RELEASE_STATE"
    else
      repository=$(jq -r '.deployment.image.repository' "$values_file")
      digest=$(jq -r '.deployment.image.digest' "$values_file")
      replicas=$(jq -r '.deployment.replicas' "$values_file")
      hpa=$(jq -r '.autoscaling.enabled' "$values_file")
      migration_mode=$(jq -r '.migration.mode // empty' "$values_file")
      gate=$(jq -r '.authzed.activation.upgradeGate.enabled' "$values_file")
      activation_database=$(jq -r '.authzed.activation.database.existingSecret // empty' "$values_file")
      activation_database_key=$(jq -r '.authzed.activation.database.urlKey // empty' "$values_file")
      migration_database=$(jq -r '.migration.database.existingSecret // empty' "$values_file")
      migration_database_key=$(jq -r '.migration.database.urlKey // empty' "$values_file")
      migration_direct_key=$(jq -r '.migration.database.migrateUrlKey // empty' "$values_file")
      printf 'main-values digest=%s replicas=%s hpa=%s migration=%s gate=%s\n' \
        "$digest" "$replicas" "$hpa" "$migration_mode" "$gate" >> "$COMMAND_LOG"
      printf 'main-database activation=%s/%s migration=%s/%s/%s\n' \
        "$activation_database" "$activation_database_key" "$migration_database" \
        "$migration_database_key" "$migration_direct_key" >> "$COMMAND_LOG"
      if [[ -n "$activation_database" ]]; then
        jq --slurpfile phase "$values_file" '
          .deployment.env = ((.deployment.env // {}) * ($phase[0].deployment.env // {})) |
          .migration.database = $phase[0].migration.database |
          .authzed.activation.database = $phase[0].authzed.activation.database
        ' "$EFFECTIVE_VALUES_JSON" > "$EFFECTIVE_VALUES_JSON.tmp"
        mv "$EFFECTIVE_VALUES_JSON.tmp" "$EFFECTIVE_VALUES_JSON"
      fi
      if [[ "$FAIL_CANDIDATE" == "true" && "$digest" == "${targetDigest}" && "$replicas" == "1" ]]; then
        exit 1
      fi
      jq --arg image "\${repository}@\${digest}" --arg imageID "\${repository}@\${digest}" \
        --argjson replicas "$replicas" --argjson hpa "$hpa" \
        '.image=$image | .imageID=$imageID | .replicas=$replicas | .hpa=$hpa' \
        "$CLUSTER_STATE" > "$CLUSTER_STATE.tmp"
      mv "$CLUSTER_STATE.tmp" "$CLUSTER_STATE"
      current_revision=$(jq -r '.[0].revision | tonumber' "$RELEASES_JSON")
      next_revision=$((current_revision + 1))
      jq 'map(if .status == "deployed" then .status = "superseded" else . end)' "$MAIN_HISTORY" > "$MAIN_HISTORY.tmp"
      mv "$MAIN_HISTORY.tmp" "$MAIN_HISTORY"
      if [[ "$FAIL_BRIDGE" == "true" && "$digest" == "${bridgeDigest}" && "$migration_mode" == "job" ]]; then
        jq --argjson revision "$next_revision" \
          '.[0].status="failed" | .[0].revision=($revision | tostring) | .[0].app_version="6.0.0"' \
          "$RELEASES_JSON" > "$RELEASES_JSON.tmp"
        mv "$RELEASES_JSON.tmp" "$RELEASES_JSON"
        jq --argjson revision "$next_revision" '. + [{revision:$revision,status:"failed"}]' \
          "$MAIN_HISTORY" > "$MAIN_HISTORY.tmp"
        mv "$MAIN_HISTORY.tmp" "$MAIN_HISTORY"
        cp "$values_file" "$MAIN_REVISIONS/$next_revision.json"
        exit 1
      fi
      if [[ "$INTERRUPT_BRIDGE" == "true" && "$digest" == "${bridgeDigest}" && "$migration_mode" == "job" && ! -e "$INTERRUPT_MARKER" ]]; then
        jq --argjson revision "$next_revision" \
          '.[0].status="pending-upgrade" | .[0].revision=($revision | tostring) | .[0].app_version="6.0.0"' \
          "$RELEASES_JSON" > "$RELEASES_JSON.tmp"
        mv "$RELEASES_JSON.tmp" "$RELEASES_JSON"
        jq --argjson revision "$next_revision" '. + [{revision:$revision,status:"pending-upgrade"}]' \
          "$MAIN_HISTORY" > "$MAIN_HISTORY.tmp"
        mv "$MAIN_HISTORY.tmp" "$MAIN_HISTORY"
        cp "$values_file" "$MAIN_REVISIONS/$next_revision.json"
        touch "$INTERRUPT_MARKER"
        kill -9 "$PPID"
        exit 137
      fi
      if [[ "$INTERRUPT_CANDIDATE" == "true" && "$digest" == "${targetDigest}" && "$replicas" == "1" && ! -e "$INTERRUPT_MARKER" ]]; then
        jq --argjson revision "$next_revision" \
          '.[0].status="pending-upgrade" | .[0].revision=($revision | tostring) | .[0].app_version="6.0.0"' \
          "$RELEASES_JSON" > "$RELEASES_JSON.tmp"
        mv "$RELEASES_JSON.tmp" "$RELEASES_JSON"
        jq --argjson revision "$next_revision" '. + [{revision:$revision,status:"pending-upgrade"}]' \
          "$MAIN_HISTORY" > "$MAIN_HISTORY.tmp"
        mv "$MAIN_HISTORY.tmp" "$MAIN_HISTORY"
        cp "$values_file" "$MAIN_REVISIONS/$next_revision.json"
        touch "$INTERRUPT_MARKER"
        kill -9 "$PPID"
        exit 137
      fi
      cp "$values_file" "$MAIN_REVISIONS/$next_revision.json"
      jq --argjson revision "$next_revision" '. + [{revision:$revision,status:"deployed"}]' \
        "$MAIN_HISTORY" > "$MAIN_HISTORY.tmp"
      mv "$MAIN_HISTORY.tmp" "$MAIN_HISTORY"
      jq --argjson revision "$next_revision" \
        '.[0].status="deployed" | .[0].revision=($revision | tostring) | .[0].app_version="6.0.0"' \
        "$RELEASES_JSON" > "$RELEASES_JSON.tmp"
      mv "$RELEASES_JSON.tmp" "$RELEASES_JSON"
      if [[ "$STEAL_LOCK_AFTER_FIRST_HELM_MUTATION" == "true" && ! -e "$LOCK_STEAL_MARKER" ]]; then
        jq '.spec.holderIdentity="another-upgrade-client"' "$UPGRADE_LOCK_STATE" \
          > "$UPGRADE_LOCK_STATE.tmp"
        mv "$UPGRADE_LOCK_STATE.tmp" "$UPGRADE_LOCK_STATE"
        touch "$LOCK_STEAL_MARKER"
      fi
    fi
    ;;
  history)
    if [[ "$2" == "customer" ]]; then
      cat "$MAIN_HISTORY"
    else
      revision=$(jq -r '.revision' "$TEMP_RELEASE_STATE")
      jq -cn --argjson revision "$revision" \
        '[range(1; $revision + 1) | {revision:.,status:(if . == $revision then "deployed" else "superseded" end)}]'
    fi
    ;;
  rollback)
    if [[ "$2" == "customer" ]]; then
      target_revision="$3"
      values_file="$MAIN_REVISIONS/$target_revision.json"
      repository=$(jq -r '.deployment.image.repository // "ghcr.io/formbricks/formbricks"' "$values_file")
      digest=$(jq -r '.deployment.image.digest' "$values_file")
      replicas=$(jq -r '.deployment.replicas // 2' "$values_file")
      hpa=$(jq -r '.autoscaling.enabled // true' "$values_file")
      jq --arg image "$repository@$digest" --arg imageID "$repository@$digest" \
        --argjson replicas "$replicas" --argjson hpa "$hpa" \
        '.image=$image | .imageID=$imageID | .replicas=$replicas | .hpa=$hpa' \
        "$CLUSTER_STATE" > "$CLUSTER_STATE.tmp"
      mv "$CLUSTER_STATE.tmp" "$CLUSTER_STATE"
      current_revision=$(jq -r '.[0].revision | tonumber' "$RELEASES_JSON")
      next_revision=$((current_revision + 1))
      cp "$values_file" "$MAIN_REVISIONS/$next_revision.json"
      jq 'map(if .status == "deployed" or .status == "pending-upgrade" then .status = "superseded" else . end)' \
        "$MAIN_HISTORY" > "$MAIN_HISTORY.tmp"
      mv "$MAIN_HISTORY.tmp" "$MAIN_HISTORY"
      jq --argjson revision "$next_revision" '. + [{revision:$revision,status:"deployed"}]' \
        "$MAIN_HISTORY" > "$MAIN_HISTORY.tmp"
      mv "$MAIN_HISTORY.tmp" "$MAIN_HISTORY"
      jq --argjson revision "$next_revision" \
        '.[0].status="deployed" | .[0].revision=($revision | tostring)' "$RELEASES_JSON" > "$RELEASES_JSON.tmp"
      mv "$RELEASES_JSON.tmp" "$RELEASES_JSON"
    else
      jq '.status="deployed"' "$TEMP_RELEASE_STATE" > "$TEMP_RELEASE_STATE.tmp"
      mv "$TEMP_RELEASE_STATE.tmp" "$TEMP_RELEASE_STATE"
    fi
    ;;
  uninstall)
    jq '.status="absent"' "$TEMP_RELEASE_STATE" > "$TEMP_RELEASE_STATE.tmp"
    mv "$TEMP_RELEASE_STATE.tmp" "$TEMP_RELEASE_STATE"
    ;;
  *) exit 1 ;;
esac
`
  );

  executable(
    join(bin, "kubectl"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'kubectl %s\n' "$*" >> "$COMMAND_LOG"
if [[ "$1" == "auth" && "$2" == "can-i" ]]; then
  permission="$3 $4"
  if [[ ",$DENIED_PERMISSIONS," == *",$permission,"* ]]; then printf '%s\n' no; else printf '%s\n' yes; fi
  exit 0
fi
if [[ "$1" == "api-resources" && "$*" == *"--api-group=helm.toolkit.fluxcd.io"* ]]; then
  if [[ "$GITOPS_MODE" == "fluxHelmRelease" ]]; then
    printf '%s\n' helmreleases.helm.toolkit.fluxcd.io
  fi
  exit 0
fi
if [[ "$1" == "get" && "$2" == "customresourcedefinition" ]]; then
  if [[ -f "$CRD_STATE" ]]; then cat "$CRD_STATE"; fi
  exit 0
fi
if [[ "$1" == "create" && "$*" == *" -f -"* ]]; then
  document=$(mktemp)
  cat > "$document"
  kind=$(jq -r '.kind // empty' "$document")
  if [[ "$kind" == "Lease" ]]; then
    [[ ! -e "$UPGRADE_LOCK_STATE" ]] || { rm -f "$document"; exit 1; }
    jq '.metadata.resourceVersion="1"' "$document" > "$UPGRADE_LOCK_STATE"
    if [[ "$DRIFT_RELEASE_BEFORE_LOCK" == "true" && ! -e "$RELEASE_DRIFT_MARKER" ]]; then
      jq '.[0].revision=((.[0].revision | tonumber) + 1 | tostring)' "$RELEASES_JSON" \
        > "$RELEASES_JSON.tmp"
      mv "$RELEASES_JSON.tmp" "$RELEASES_JSON"
      jq '.concurrentOperatorChange=true' "$VALUES_JSON" > "$VALUES_JSON.tmp"
      mv "$VALUES_JSON.tmp" "$VALUES_JSON"
      touch "$RELEASE_DRIFT_MARKER"
    fi
  elif [[ "$kind" == "CustomResourceDefinition" ]]; then
    [[ ! -f "$CRD_STATE" ]] || { rm -f "$document"; exit 1; }
    jq '.status.conditions=[{type:"Established",status:"True"}]' "$document" > "$CRD_STATE"
  else
    rm -f "$document"
    exit 1
  fi
  rm -f "$document"
  exit 0
fi
if [[ "$1" == "get" && "$2" == "lease" ]]; then
  [[ -f "$UPGRADE_LOCK_STATE" ]] || exit 1
  cat "$UPGRADE_LOCK_STATE"
  exit 0
fi
if [[ "$1" == "replace" && "$*" == *" -f -"* ]]; then
  replacement=$(mktemp)
  cat > "$replacement"
  [[ -f "$UPGRADE_LOCK_STATE" ]] || { rm -f "$replacement"; exit 1; }
  current_version=$(jq -r '.metadata.resourceVersion' "$UPGRADE_LOCK_STATE")
  replacement_version=$(jq -r '.metadata.resourceVersion' "$replacement")
  [[ "$current_version" == "$replacement_version" ]] || { rm -f "$replacement"; exit 1; }
  jq --arg version "$((current_version + 1))" '.metadata.resourceVersion=$version' "$replacement" \
    > "$UPGRADE_LOCK_STATE"
  rm -f "$replacement"
  exit 0
fi
if [[ "$1" == "patch" && "$2" == "lease" ]]; then
  payload=""
  previous=""
  for argument in "$@"; do
    if [[ "$previous" == "-p" ]]; then payload="$argument"; fi
    previous="$argument"
  done
  expected_holder=$(jq -r '[.[] | select(.op == "test" and .path == "/spec/holderIdentity")][0].value' \
    <<<"$payload")
  [[ "$(jq -r '.spec.holderIdentity' "$UPGRADE_LOCK_STATE")" == "$expected_holder" ]] || exit 1
  replacement_holder=$(jq -r '[.[] | select(.op == "replace" and .path == "/spec/holderIdentity")][-1].value // empty' \
    <<<"$payload")
  replacement_duration=$(jq -r '[.[] | select(.op == "replace" and .path == "/spec/leaseDurationSeconds")][-1].value // empty' \
    <<<"$payload")
  replacement_renew_time=$(jq -r '[.[] | select(.op == "replace" and .path == "/spec/renewTime")][-1].value // empty' \
    <<<"$payload")
  jq --arg holder "$replacement_holder" --arg duration "$replacement_duration" --arg renew "$replacement_renew_time" '
    if $holder != "" then .spec.holderIdentity=$holder elif ($duration != "") then .spec.holderIdentity="" else . end |
    if $duration != "" then .spec.leaseDurationSeconds=($duration | tonumber) else . end |
    if $renew != "" then .spec.renewTime=$renew else . end
  ' "$UPGRADE_LOCK_STATE" > "$UPGRADE_LOCK_STATE.tmp"
  mv "$UPGRADE_LOCK_STATE.tmp" "$UPGRADE_LOCK_STATE"
  exit 0
fi
if [[ "$1" == "create" && "$*" == *"authzed.com_spicedbclusters.yaml"* ]]; then
  if [[ "$*" == *"--dry-run=client"* ]]; then
    cat "$SPICEDB_CRD"
  else
    [[ ! -f "$CRD_STATE" ]] || exit 1
    jq '.status.conditions=[{type:"Established",status:"True"}]' "$SPICEDB_CRD" > "$CRD_STATE"
  fi
  exit 0
fi
if [[ "$1" == "rollout" ]]; then exit 0; fi
if [[ "$1" == "wait" ]]; then exit 0; fi
if [[ "$1" == "get" && ( "$2" == "horizontalpodautoscaler" || "$2" == "horizontalpodautoscalers" ) ]]; then
  if [[ "$2" == "horizontalpodautoscalers" || "$3" == --* ]]; then
    cat "$HPA_STATE"
  else
    jq -ce --arg name "$3" '.items[] | select(.metadata.name == $name)' "$HPA_STATE" || exit 1
  fi
  exit 0
fi
if [[ "$1" == "get" && "$2" == "helmreleases.helm.toolkit.fluxcd.io" ]]; then
  if [[ "$GITOPS_MODE" == "fluxHelmRelease" ]]; then
    printf '%s\n' '{"items":[{"metadata":{"name":"customer","namespace":"private"}}]}'
  else
    printf '%s\n' '{"items":[]}'
  fi
  exit 0
fi
if [[ "$1" == "get" && ( "$2" == "deployments" || "$2" == "deployment" ) ]]; then
  item=$(jq -c --arg gitopsMode "$GITOPS_MODE" '
    {
      metadata:{
        name:"formbricks",
        labels:{"app.kubernetes.io/component":"formbricks"},
        annotations:(
          if $gitopsMode == "argocd" then {"argocd.argoproj.io/tracking-id":"active"}
          elif $gitopsMode == "fluxHelmRelease" then {
            "helm.toolkit.fluxcd.io/name":"customer",
            "helm.toolkit.fluxcd.io/namespace":"private"
          }
          else {} end
        )
      },
      spec:{replicas:.replicas,template:{spec:{containers:[{
        name:"formbricks",image:.image,env:(.environment // [])
      }]}}}
    }' "$CLUSTER_STATE")
  if [[ "$2" == "deployments" ]]; then jq -cn --argjson item "$item" '{items:[$item]}'; else printf '%s\n' "$item"; fi
  exit 0
fi
if [[ "$1" == "get" && "$2" == "pods" ]]; then
  if [[ $(jq -r '.replicas' "$CLUSTER_STATE") == "0" ]]; then printf '%s\n' '{"items":[]}'; else
    jq -cn --arg imageID "$(jq -r '.imageID' "$CLUSTER_STATE")" '{items:[{metadata:{deletionTimestamp:null},status:{containerStatuses:[{name:"formbricks",ready:true,imageID:$imageID}]}}]}'
  fi
  exit 0
fi
if [[ "$1" == "get" && ( "$2" == "jobs" || "$2" == "job" ) ]]; then
  phase=$(jq -r '.phase' "$JOB_STATE")
  execution=$(jq -r '.execution' "$JOB_STATE")
  item=$(jq -cn --arg name "job-\${phase}-\${execution}" '{metadata:{name:$name},status:{succeeded:1}}')
  if [[ "$2" == "jobs" ]]; then jq -cn --argjson item "$item" '{items:[$item]}'; else printf '%s\n' "$item"; fi
  exit 0
fi
if [[ "$1" == "logs" ]]; then
  phase=$(jq -r '.phase' "$JOB_STATE")
  case "$phase" in
    status) jq -c '{status:"ready",authority,transition}' "$CLUSTER_STATE" ;;
    prepare) printf '%s\n' '{"status":"prepared","receipt":"${receipt}"}' ;;
    audit) printf '%s\n' '{"status":"reconciled","truncated":false,"failures":[],"lastOrganizationId":"identifier-that-must-not-escape"}' ;;
    activate) printf '%s\n' '{"status":"activated"}' ;;
    rollback-begin) printf '%s\n' '{"status":"rollback_started"}' ;;
    rollback-complete) printf '%s\n' '{"status":"rolled_back"}' ;;
  esac
  exit 0
fi
if [[ "$1" == "exec" ]]; then
  if [[ "$*" == *" activation status" ]]; then
    jq -c '{status:"ready",authority,transition}' "$CLUSTER_STATE"
  elif [[ "$*" == *" runtime-check" ]]; then
    if [[ $(jq -r '.image' "$CLUSTER_STATE") == *"${targetDigest}" ]]; then authority=spicedb; else authority=legacy; fi
    jq -cn --arg authority "$authority" '{status:"ready",authority:$authority}'
  elif [[ "$*" == *"http://127.0.0.1:"*"/health"* ]]; then
    image=$(jq -r '.image' "$CLUSTER_STATE")
    transition=$(jq -r '.transition' "$CLUSTER_STATE")
    if [[ "$image" == *"${targetDigest}" && "$FAIL_CANDIDATE_HEALTH" == "true" ]]; then exit 1; fi
    if [[ "$image" == *"${bridgeDigest}" && "$transition" == "rolling_back" && "$FAIL_BRIDGE_HEALTH" == "true" ]]; then exit 1; fi
  elif [[ "$*" == *" activation finalize "* ]]; then
    jq '.authority="spicedb" | .transition="idle"' "$CLUSTER_STATE" > "$CLUSTER_STATE.tmp"
    mv "$CLUSTER_STATE.tmp" "$CLUSTER_STATE"
    if [[ "$INTERRUPT_FINALIZE" == "true" && ! -e "$INTERRUPT_MARKER" ]]; then
      touch "$INTERRUPT_MARKER"
      assistant_pid=$(ps -o ppid= -p "$PPID" | tr -d ' ')
      kill -9 "$assistant_pid"
      exit 137
    fi
    printf '%s\n' '{"status":"finalized"}'
  else exit 1; fi
  exit 0
fi
exit 1
`
  );

  return {
    bin,
    bundle,
    clusterState,
    commandLog,
    crdState,
    effectiveValues,
    gitopsMode: options.gitops ?? "none",
    hpaState,
    manifest,
    releases,
    state,
    temporaryValuesLog,
    upgradeLockState,
  };
};

type TRunOptions = Readonly<{
  action?: "execute" | "resume";
  backupConfirmed?: boolean;
  confirmed?: boolean;
  deniedPermissions?: ReadonlyArray<string>;
  extraArgs?: ReadonlyArray<string>;
  failCandidate?: boolean;
  failBridge?: boolean;
  failBridgeHealth?: boolean;
  failCandidateHealth?: boolean;
  interruptPhase?: string;
  interruptCandidate?: boolean;
  interruptBridge?: boolean;
  interruptFinalize?: boolean;
  stealLockAfterFirstHelmMutation?: boolean;
  driftReleaseBeforeLock?: boolean;
}>;

const run = (fixture: TFixture, options: TRunOptions = {}) =>
  spawnSync(
    assistantPath,
    [
      options.action ?? "execute",
      "--manifest",
      fixture.manifest,
      "--install-type",
      "helm",
      "--helm-release",
      "customer",
      "--namespace",
      "private",
      "--state-file",
      fixture.state,
      ...(options.confirmed === false ? [] : ["--yes"]),
      ...(options.backupConfirmed === false ? [] : ["--backup-confirmed"]),
      ...(options.extraArgs ?? []),
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fixture.bin}:${process.env.PATH}`,
        COMMAND_LOG: fixture.commandLog,
        RELEASES_JSON: join(fixture.bundle, "../releases.json"),
        VALUES_JSON: join(fixture.bundle, "../values.json"),
        EFFECTIVE_VALUES_JSON: join(fixture.bundle, "../effective-values.json"),
        CLUSTER_STATE: fixture.clusterState,
        CRD_STATE: fixture.crdState,
        DENIED_PERMISSIONS: options.deniedPermissions?.join(",") ?? "",
        GITOPS_MODE: fixture.gitopsMode,
        HPA_STATE: fixture.hpaState,
        SPICEDB_CRD: join(fixture.bundle, "authzed.com_spicedbclusters.yaml"),
        JOB_STATE: join(fixture.bundle, "../job.json"),
        FAIL_CANDIDATE: options.failCandidate === true ? "true" : "false",
        FAIL_BRIDGE: options.failBridge === true ? "true" : "false",
        FAIL_BRIDGE_HEALTH: options.failBridgeHealth === true ? "true" : "false",
        FAIL_CANDIDATE_HEALTH: options.failCandidateHealth === true ? "true" : "false",
        INTERRUPT_MARKER: join(fixture.bundle, "../interrupt.marker"),
        INTERRUPT_PHASE: options.interruptPhase ?? "",
        INTERRUPT_CANDIDATE: options.interruptCandidate === true ? "true" : "false",
        INTERRUPT_BRIDGE: options.interruptBridge === true ? "true" : "false",
        INTERRUPT_FINALIZE: options.interruptFinalize === true ? "true" : "false",
        STEAL_LOCK_AFTER_FIRST_HELM_MUTATION:
          options.stealLockAfterFirstHelmMutation === true ? "true" : "false",
        DRIFT_RELEASE_BEFORE_LOCK: options.driftReleaseBeforeLock === true ? "true" : "false",
        RELEASE_DRIFT_MARKER: join(fixture.bundle, "../release-drift.marker"),
        LOCK_STEAL_MARKER: join(fixture.bundle, "../lock-steal.marker"),
        MAIN_HISTORY: join(fixture.bundle, "../main-history.json"),
        MAIN_REVISIONS: join(fixture.bundle, "../main-revisions"),
        TEMP_RELEASE_STATE: join(fixture.bundle, "../temporary-release.json"),
        TEMP_VALUES_LOG: fixture.temporaryValuesLog,
        UPGRADE_LOCK_STATE: fixture.upgradeLockState,
        FORMBRICKS_UPGRADE_LOCK_RENEW_SECONDS: "1",
        FORMBRICKS_UPGRADE_POLL_INTERVAL_SECONDS: "0",
      },
    }
  );

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("Formbricks v6 Helm upgrade executor", { timeout: 30_000 }, () => {
  test("executes bridge, prepare, audit, quiesce, activate, candidate, finalize, restore, and cleanup", () => {
    const fixture = createFixture(temporaryDirectory());
    const result = run(fixture);

    expect(
      result.status,
      `${result.stdout}\n${result.stderr}\n${readFileSync(fixture.commandLog, "utf8")}`
    ).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ installType: "helm", status: "upgraded" });
    expect(statSync(fixture.state).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({ state: "completed" });
    expect(readFileSync(fixture.clusterState, "utf8")).toContain(targetDigest);

    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands).toContain("helm upgrade customer");
    expect(commands).toContain("--dry-run=server --hide-secret");
    expect(commands).not.toContain("helm template");
    expect(commands).toContain("phase-values.json --wait --wait-for-jobs");
    expect(commands).toContain("helm uninstall customer-");
    expect(commands).not.toContain("helm rollback");
    expect(commands.indexOf('"prepare"')).toBe(-1);
    expect(commands.indexOf("helm upgrade customer")).toBeLessThan(
      commands.indexOf("helm upgrade --install")
    );
    expect(commands.indexOf("http://127.0.0.1:")).toBeLessThan(commands.indexOf("activation finalize"));
    expect(commands).toContain(
      `main-values digest=${targetDigest} replicas=1 hpa=false migration=external gate=true`
    );
    expect(
      commands
        .trimEnd()
        .split("\n")
        .filter((line) => line.startsWith("main-values "))
        .at(-1)
    ).toBe(`main-values digest=${targetDigest} replicas=2 hpa=true migration= gate=true`);
    expect(result.stdout + result.stderr).not.toContain("database-secret-that-must-not-escape");
    expect(result.stdout + result.stderr).not.toContain("identifier-that-must-not-escape");
    expect(readFileSync(fixture.state.replace(/\.json$/, ".log"), "utf8")).not.toContain(
      "database-secret-that-must-not-escape"
    );
    expect(readFileSync(fixture.state.replace(/\.json$/, ".log"), "utf8")).not.toContain(
      "identifier-that-must-not-escape"
    );
    // The exact Helm values are recovery state, not a support-safe artifact. Prove the credential is
    // retained only there while every user-facing/support-facing output remains secret-safe.
    expect(readFileSync(fixture.state, "utf8")).toContain("database-secret-that-must-not-escape");
    expect(readFileSync(fixture.state, "utf8")).toContain("migrationAcknowledged");
  });

  test("carries a v5 custom database Secret binding through every main and coordinator phase", () => {
    const fixture = createFixture(temporaryDirectory(), { databaseSource: "secretRef" });
    const result = run(fixture);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const databaseLines = readFileSync(fixture.commandLog, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("main-database "));
    expect(databaseLines.length).toBeGreaterThan(0);
    expect(new Set(databaseLines)).toEqual(
      new Set([
        "main-database activation=customer-database/DATABASE_URL " +
          "migration=customer-database/DATABASE_URL/MIGRATE_DATABASE_URL",
      ])
    );

    const temporaryValues = readFileSync(fixture.temporaryValuesLog, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(temporaryValues.length).toBeGreaterThan(0);
    for (const values of temporaryValues) {
      expect(values.database.existingSecret).toEqual({ name: "customer-database", key: "DATABASE_URL" });
    }
  });

  test("preserves a same-Secret migration endpoint key during a custom database upgrade", () => {
    const fixture = createFixture(temporaryDirectory(), { databaseSource: "migrateSameSecret" });
    const result = run(fixture);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const databaseLines = readFileSync(fixture.commandLog, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("main-database "));
    expect(databaseLines.length).toBeGreaterThan(0);
    expect(new Set(databaseLines)).toEqual(
      new Set([
        "main-database activation=customer-database/DATABASE_URL " +
          "migration=customer-database/DATABASE_URL/DIRECT_DATABASE_URL",
      ])
    );
  });

  test("captures a templated v5 database Secret name from the live Deployment", () => {
    const fixture = createFixture(temporaryDirectory(), { databaseSource: "templatedSecretRef" });
    const result = run(fixture);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const databaseLines = readFileSync(fixture.commandLog, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("main-database "));
    expect(new Set(databaseLines)).toEqual(
      new Set([
        "main-database activation=customer-database/DATABASE_URL " +
          "migration=customer-database/DATABASE_URL/MIGRATE_DATABASE_URL",
      ])
    );
    expect(JSON.parse(readFileSync(fixture.state, "utf8")).databaseBinding).toEqual({
      source: "secret_ref",
      secretName: "customer-database",
      urlKey: "DATABASE_URL",
      migrateUrlKey: "MIGRATE_DATABASE_URL",
    });
  });

  test.each([
    ["envFromOnly", "helm_database_source_ambiguous"],
    ["databaseWithEnvFromNoMigrate", "helm_database_source_ambiguous"],
    ["literal", "helm_database_source_unsupported"],
    ["configMap", "helm_database_source_unsupported"],
    ["optional", "helm_database_source_unsupported"],
    ["missingKey", "helm_database_source_unsupported"],
    ["migrateDifferentSecret", "helm_database_source_unsupported"],
  ] as const)("blocks an unsafe or ambiguous %s database source before mutation", (databaseSource, code) => {
    const fixture = createFixture(temporaryDirectory(), { databaseSource });
    const result = run(fixture);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(2);
    expect(JSON.parse(result.stdout).checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ code, status: "blocked" })])
    );
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("helm upgrade");
    expect(existsSync(fixture.crdState)).toBe(false);
    expect(existsSync(fixture.state)).toBe(false);
  });

  test("requires both confirmation and a backup acknowledgement before Helm mutation", () => {
    const fixture = createFixture(temporaryDirectory());
    const result = run(fixture, { backupConfirmed: false });

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "helm_confirmation_required", status: "blocked" }],
    });
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("helm upgrade");
  });

  test("blocks a concurrent upgrade holding the release-scoped Lease", () => {
    const fixture = createFixture(temporaryDirectory());
    writeFileSync(
      fixture.upgradeLockState,
      JSON.stringify({
        apiVersion: "coordination.k8s.io/v1",
        kind: "Lease",
        metadata: { name: "existing-lock", namespace: "private", resourceVersion: "1" },
        spec: {
          acquireTime: "2099-01-01T00:00:00Z",
          holderIdentity: "remote-host:999999:other-client",
          leaseDurationSeconds: 90,
          renewTime: "2099-01-01T00:00:00Z",
        },
      })
    );

    const result = run(fixture);

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "upgrade_already_running", status: "blocked" }],
    });
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("helm upgrade");
  });

  test("blocks when the Helm release changes after preflight and before journal creation", () => {
    const fixture = createFixture(temporaryDirectory());
    const result = run(fixture, { driftReleaseBeforeLock: true });
    const commands = readFileSync(fixture.commandLog, "utf8");

    expect(result.status, `${result.stdout}\n${result.stderr}\n${commands}`).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "helm_release_changed_since_preflight", status: "blocked" }],
      status: "blocked",
    });
    expect(commands).not.toContain("helm upgrade");
    expect(commands).not.toContain("kubectl create --validate=strict");
    expect(existsSync(fixture.crdState)).toBe(false);
    expect(existsSync(fixture.state)).toBe(false);
  });

  test("stops mutating immediately when another client steals the release Lease", () => {
    const fixture = createFixture(temporaryDirectory());
    const result = run(fixture, { stealLockAfterFirstHelmMutation: true });

    expect(result.status).not.toBe(0);
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands.match(/^main-values /gm)).toHaveLength(1);
    expect(commands).not.toContain("temporary-values phase=");
    expect(JSON.parse(result.stdout).status).toBe("blocked");
  });

  test("blocks a mutable Helm source image before any cutover mutation", () => {
    const fixture = createFixture(temporaryDirectory());
    const inspectedValues = JSON.parse(readFileSync(join(fixture.bundle, "../values.json"), "utf8"));
    delete inspectedValues.deployment.image.digest;
    inspectedValues.deployment.image.tag = "5.4.3";
    writeFileSync(join(fixture.bundle, "../values.json"), JSON.stringify(inspectedValues));

    const result = run(fixture);

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).checks).toContainEqual({
      code: "helm_source_image_not_pinned",
      status: "blocked",
    });
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("helm upgrade");
  });

  test("rejects Helm versions that cannot perform secret-hidden server dry runs", () => {
    const fixture = createFixture(temporaryDirectory(), { helmVersion: "v3.14.4" });
    const result = run(fixture);

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).checks).toContainEqual({
      code: "helm_version_unsupported",
      status: "blocked",
    });
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("helm upgrade");
  });

  test("blocks an ownerless pre-existing SpiceDBCluster CRD before mutation", () => {
    const fixture = createFixture(temporaryDirectory(), { crd: "compatible" });
    const result = run(fixture);

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).checks).toContainEqual({
      code: "spicedb_operator_ownership_ambiguous",
      status: "blocked",
    });
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("helm upgrade");
  });

  test.each([false, true])(
    "leaves a compatible SpiceDBCluster CRD untouched after an explicit operator choice (%s)",
    (operatorInstall) => {
      const fixture = createFixture(temporaryDirectory(), { crd: "compatible", operatorInstall });
      const result = run(fixture);

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const commands = readFileSync(fixture.commandLog, "utf8");
      expect(commands).toContain("kubectl get customresourcedefinition spicedbclusters.authzed.com");
      expect(commands).not.toContain("kubectl create --validate=strict");
      expect(JSON.parse(readFileSync(fixture.crdState, "utf8"))).toMatchObject({
        status: { conditions: [{ status: "True", type: "Established" }] },
      });
    }
  );

  for (const crd of ["incompatible", "unestablished"] as const) {
    test(`blocks an ${crd} SpiceDBCluster CRD before mutation`, () => {
      const fixture = createFixture(temporaryDirectory(), { crd });
      const result = run(fixture);

      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout).checks).toContainEqual({
        code: "spicedb_crd_incompatible",
        status: "blocked",
      });
      const commands = readFileSync(fixture.commandLog, "utf8");
      expect(commands).not.toContain("kubectl create --validate=strict");
      expect(commands).not.toContain("helm upgrade");
    });
  }

  for (const permission of ["get", "create"] as const) {
    test(`blocks when cluster-scoped CRD ${permission} permission is denied`, () => {
      const fixture = createFixture(temporaryDirectory());
      const result = run(fixture, {
        deniedPermissions: [`${permission} customresourcedefinitions.apiextensions.k8s.io`],
      });

      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout).checks).toContainEqual({
        code:
          permission === "get"
            ? "spicedb_crd_read_permission_missing"
            : "spicedb_crd_create_permission_missing",
        status: "blocked",
      });
      const commands = readFileSync(fixture.commandLog, "utf8");
      expect(commands).not.toContain("kubectl create --validate=strict");
      expect(commands).not.toContain("helm upgrade");
    });
  }

  test("does not inspect or create a SpiceDBCluster CRD for external AuthZed", () => {
    const fixture = createFixture(temporaryDirectory(), { authzedMode: "external" });
    const result = run(fixture);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands).not.toContain("customresourcedefinition");
    expect(commands).not.toContain("authzed.com_spicedbclusters.yaml");
  });

  test("fences rollback, restores the exact bridge, and never rolls back the application release blindly", () => {
    const fixture = createFixture(temporaryDirectory());
    const result = run(fixture, { failCandidate: true });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "helm_candidate_failed_rolled_back", status: "blocked" }],
    });
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands).toContain("rollback-begin");
    expect(commands).toContain("rollback-complete");
    expect(commands).not.toContain("helm rollback customer ");
    expect(JSON.parse(readFileSync(fixture.clusterState, "utf8"))).toMatchObject({
      authority: "legacy",
      hpa: true,
      replicas: 2,
    });
  });

  test("resumes from durable authority and the signed journal after activation interrupts on a v6 bridge", () => {
    const fixture = createFixture(temporaryDirectory());
    const interrupted = run(fixture, { interruptPhase: "activate" });

    expect(
      interrupted.signal === "SIGKILL" || interrupted.status === 137,
      `${interrupted.stdout}\n${interrupted.stderr}\n${readFileSync(fixture.commandLog, "utf8")}`
    ).toBe(true);
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({
      pendingPhase: "activate",
      state: "quiesced",
    });
    expect(JSON.parse(readFileSync(fixture.clusterState, "utf8"))).toMatchObject({ authority: "spicedb" });

    const releases = JSON.parse(readFileSync(fixture.releases, "utf8"));
    releases[0].app_version = "6.0.0";
    writeFileSync(fixture.releases, JSON.stringify(releases));

    const resumed = run(fixture, { action: "resume" });

    expect(resumed.status, `${resumed.stdout}\n${resumed.stderr}`).toBe(0);
    expect(JSON.parse(resumed.stdout)).toMatchObject({ installType: "helm", status: "upgraded" });
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({ state: "completed" });
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands).toContain("helm rollback customer-");
    expect(commands).not.toContain("helm rollback customer 7");
  });

  test("repeats idempotent prepare when its receipt committed before the journal write", () => {
    const fixture = createFixture(temporaryDirectory());
    const interrupted = run(fixture, { interruptPhase: "prepare" });

    expect(interrupted.signal === "SIGKILL" || interrupted.status === 137).toBe(true);
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({
      pendingPhase: "prepare",
      receipt: null,
      state: "bridge_ready",
    });
    expect(JSON.parse(readFileSync(fixture.clusterState, "utf8"))).toMatchObject({
      authority: "legacy",
      transition: "prepared",
    });

    const resumed = run(fixture, { action: "resume" });

    expect(resumed.status, `${resumed.stdout}\n${resumed.stderr}`).toBe(0);
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands.match(/temporary-values phase=prepare /g)).toHaveLength(2);
    expect(commands).not.toContain("manual_recovery_required");
    expect(
      commands.match(/^kubectl create --validate=strict -f .*authzed\.com_spicedbclusters\.yaml/gm)
    ).toHaveLength(1);
    expect(JSON.parse(readFileSync(fixture.crdState, "utf8"))).toMatchObject({
      status: { conditions: [{ status: "True", type: "Established" }] },
    });
  });

  test("recovers the original revision when the first bridge Helm client is interrupted", () => {
    const fixture = createFixture(temporaryDirectory());
    const interrupted = run(fixture, { interruptBridge: true });

    expect(interrupted.signal === "SIGKILL" || interrupted.status === 137).toBe(true);
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({ state: "initialized" });
    expect(JSON.parse(readFileSync(fixture.releases, "utf8"))[0]).toMatchObject({
      app_version: "6.0.0",
      status: "pending-upgrade",
    });

    const resumed = run(fixture, { action: "resume" });

    expect(resumed.status, `${resumed.stdout}\n${resumed.stderr}`).toBe(0);
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({ state: "completed" });
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands).toContain("helm rollback customer 7");
  });

  test("restores the exact original revision when the first bridge deployment fails", () => {
    const fixture = createFixture(temporaryDirectory());
    const result = run(fixture, { failBridge: true });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "helm_bridge_deployment_failed", status: "blocked" }],
    });
    expect(readFileSync(fixture.commandLog, "utf8")).toContain("helm rollback customer 7");
    expect(JSON.parse(readFileSync(fixture.clusterState, "utf8"))).toMatchObject({
      authority: "legacy",
      hpa: true,
      image: `ghcr.io/formbricks/formbricks@sha256:${"9".repeat(64)}`,
      replicas: 2,
    });
  });

  test("recovers a pending candidate Helm revision only through the quiesced exact bridge revision", () => {
    const fixture = createFixture(temporaryDirectory());
    const interrupted = run(fixture, { interruptCandidate: true });

    expect(interrupted.signal === "SIGKILL" || interrupted.status === 137).toBe(true);
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({ state: "activated" });
    expect(JSON.parse(readFileSync(fixture.clusterState, "utf8"))).toMatchObject({
      authority: "spicedb",
      replicas: 1,
    });

    const resumed = run(fixture, { action: "resume" });

    expect(resumed.status, `${resumed.stdout}\n${resumed.stderr}`).toBe(0);
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({ state: "completed" });
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands).toMatch(/helm rollback customer (?!7\b)\d+/);
    expect(commands).not.toContain("helm rollback customer 7");
  });

  test("resumes an idempotent finalize when the database committed before the journal write", () => {
    const fixture = createFixture(temporaryDirectory());
    const interrupted = run(fixture, { interruptFinalize: true });

    expect(interrupted.signal === "SIGKILL" || interrupted.status === 137).toBe(true);
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({ state: "candidate_ready" });
    expect(JSON.parse(readFileSync(fixture.clusterState, "utf8"))).toMatchObject({
      authority: "spicedb",
      transition: "idle",
    });

    const resumed = run(fixture, { action: "resume" });

    expect(resumed.status, `${resumed.stdout}\n${resumed.stderr}`).toBe(0);
    expect(JSON.parse(readFileSync(fixture.state, "utf8"))).toMatchObject({ state: "completed" });
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands.match(/activation finalize/g)).toHaveLength(2);
    expect(commands).not.toContain("rollback-begin");
  });

  test("rolls back instead of finalizing when the authoritative candidate is not serving health", () => {
    const fixture = createFixture(temporaryDirectory());
    const result = run(fixture, { failCandidateHealth: true });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "helm_candidate_failed_rolled_back", status: "blocked" }],
    });
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands).toContain("http://127.0.0.1:");
    expect(commands).toContain("rollback-begin");
    expect(commands).not.toContain("activation finalize");
  });

  test("does not complete rollback until the restored bridge is healthy", () => {
    const fixture = createFixture(temporaryDirectory());
    const result = run(fixture, { failBridgeHealth: true, failCandidateHealth: true });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "helm_candidate_failed_rollback_incomplete", status: "blocked" }],
    });
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain(
      "temporary-values phase=rollback-complete"
    );
  });

  test("rejects a chart that does not match the verified checksum set before mutation", () => {
    const fixture = createFixture(temporaryDirectory(), { invalidChart: true });
    const result = run(fixture);

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "signed_helm_artifact_invalid", status: "blocked" }],
    });
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("helm upgrade");
  });

  test("refuses an actively reconciled GitOps workload without an explicit paused certification", () => {
    const fixture = createFixture(temporaryDirectory(), { gitops: "argocd" });
    const result = run(fixture);

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "gitops_reconciliation_not_paused", status: "blocked" }],
    });
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("helm upgrade");
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("kubectl create --validate=strict");
    expect(existsSync(fixture.crdState)).toBe(false);
    expect(existsSync(fixture.state)).toBe(false);
  });

  test("detects a Flux HelmRelease before any CRD or Helm mutation", () => {
    const fixture = createFixture(temporaryDirectory(), { gitops: "fluxHelmRelease" });
    const result = run(fixture);

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "gitops_reconciliation_not_paused", status: "blocked" }],
    });
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands).not.toContain("helm upgrade");
    expect(commands).not.toContain("kubectl create --validate=strict");
    expect(existsSync(fixture.crdState)).toBe(false);
    expect(existsSync(fixture.state)).toBe(false);
  });

  for (const hpa of ["external", "multiple"] as const) {
    test(`blocks a ${hpa} HPA targeting the Formbricks Deployment`, () => {
      const fixture = createFixture(temporaryDirectory(), { hpa });
      const result = run(fixture);

      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        checks: [{ code: "unsupported_external_hpa", status: "blocked" }],
      });
      const commands = readFileSync(fixture.commandLog, "utf8");
      expect(commands).not.toContain("helm upgrade");
      expect(commands).not.toContain("kubectl create --validate=strict");
      expect(existsSync(fixture.crdState)).toBe(false);
      expect(existsSync(fixture.state)).toBe(false);
    });
  }

  test("isolates temporary jobs from application security contexts and injector annotations", () => {
    const fixture = createFixture(temporaryDirectory(), {
      disableIstioInject: true,
      unsafePodAnnotations: true,
      unsafeSecurityContexts: true,
    });
    const result = run(fixture);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const temporaryValues = readFileSync(fixture.temporaryValuesLog, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(temporaryValues.length).toBeGreaterThan(0);
    for (const values of temporaryValues) {
      expect(values.job.podAnnotations).toEqual({});
      expect(values.job.podLabels).toEqual({ "sidecar.istio.io/inject": "false" });
      expect(values.job.podSecurityContext).toEqual({
        runAsNonRoot: true,
        seccompProfile: { type: "RuntimeDefault" },
      });
      expect(values.job.containerSecurityContext).toEqual({
        allowPrivilegeEscalation: false,
        capabilities: { drop: ["ALL"] },
        readOnlyRootFilesystem: true,
        runAsNonRoot: true,
      });
    }
  });
});
