import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
  manifest: string;
  releases: string;
  state: string;
}>;

const createFixture = (
  directory: string,
  options: Readonly<{ gitops?: boolean; invalidChart?: boolean }> = {}
): TFixture => {
  const bundle = join(directory, "bundle");
  const bin = join(directory, "bin");
  const manifest = join(bundle, "formbricks-upgrade-manifest.json");
  const mainChart = join(bundle, "formbricks-6.0.0.tgz");
  const upgradeChart = join(bundle, "formbricks-upgrade-6.0.0.tgz");
  const checksums = join(bundle, "formbricks-upgrade-checksums.txt");
  const commandLog = join(directory, "commands.log");
  const clusterState = join(directory, "cluster.json");
  const releases = join(directory, "releases.json");
  const values = join(directory, "values.json");
  const effectiveValues = join(directory, "effective-values.json");
  const jobState = join(directory, "job.json");
  const temporaryReleaseState = join(directory, "temporary-release.json");
  const interruptMarker = join(directory, "interrupt.marker");
  const mainHistory = join(directory, "main-history.json");
  const mainRevisions = join(directory, "main-revisions");
  const state = join(directory, "upgrade-state.json");
  const databaseSecret = "database-secret-that-must-not-escape";

  mkdirSync(bundle);
  mkdirSync(bin);
  mkdirSync(mainRevisions);
  writeFileSync(commandLog, "");
  writeFileSync(mainChart, "signed-main-chart");
  writeFileSync(upgradeChart, options.invalidChart ? "tampered-upgrade-chart" : "signed-upgrade-chart");
  writeFileSync(
    manifest,
    JSON.stringify({
      schemaVersion: 1,
      releaseVersion: "6.0.0",
      sourceRevision: "0123456789012345678901234567890123456789",
      minimumSourceVersion: "5.4.0",
      supportedInstallTypes: ["docker_compose", "helm", "one_click"],
      artifacts: {
        bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        bridgeRuntimeManifestDigest: bridgeManifestDigest,
        formbricksChart: "formbricks-6.0.0.tgz",
        dockerAuthzedOverlaySha256: `sha256:${"e".repeat(64)}`,
        authzedPostgresBootstrapSha256: `sha256:${"f".repeat(64)}`,
        postgresBootstrapImage,
        spicedbImage,
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
      authzed: { initialization: { enabled: true }, migrationAcknowledged: true },
      deployment: { image: { digest: `sha256:${"9".repeat(64)}` } },
      postgresql: { enabled: true, auth: { password: databaseSecret } },
    })
  );
  writeFileSync(
    effectiveValues,
    JSON.stringify({
      nameOverride: "formbricks",
      deployment: { nodeSelector: {}, tolerations: [], affinity: {} },
      authzed: {
        mode: "selfHosted",
        endpoint: "",
        insecure: null,
        systemKey: "formbricks",
        auth: { existingSecret: "", tokenKey: "preshared_key" },
        cluster: { name: "" },
        activation: { database: { existingSecret: "", urlKey: "DATABASE_URL" } },
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
    })
  );
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
      printf 'main-values digest=%s replicas=%s hpa=%s migration=%s gate=%s\n' \
        "$digest" "$replicas" "$hpa" "$migration_mode" "$gate" >> "$COMMAND_LOG"
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
if [[ "$1" == "auth" && "$2" == "can-i" ]]; then printf '%s\n' yes; exit 0; fi
if [[ "$1" == "rollout" ]]; then exit 0; fi
if [[ "$1" == "wait" ]]; then exit 0; fi
if [[ "$1" == "get" && "$2" == "horizontalpodautoscaler" ]]; then
  printf '%s\n' '{"spec":{"minReplicas":2,"maxReplicas":5}}'; exit 0
fi
if [[ "$1" == "get" && ( "$2" == "deployments" || "$2" == "deployment" ) ]]; then
  item=$(jq -c --argjson gitops '${options.gitops === true}' '
    {metadata:{name:"formbricks",labels:{"app.kubernetes.io/component":"formbricks"},annotations:(if $gitops then {"argocd.argoproj.io/tracking-id":"active"} else {} end)},spec:{replicas:.replicas,template:{spec:{containers:[{name:"formbricks",image:.image}]}}}}' "$CLUSTER_STATE")
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
  if [[ "$*" == *" runtime-check" ]]; then
    if [[ $(jq -r '.image' "$CLUSTER_STATE") == *"${targetDigest}" ]]; then authority=spicedb; else authority=legacy; fi
    jq -cn --arg authority "$authority" '{status:"ready",authority:$authority}'
  elif [[ "$*" == *"http://127.0.0.1:"*"/health"* ]]; then
    if [[ "$FAIL_HEALTH" == "true" ]]; then exit 1; fi
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

  return { bin, bundle, clusterState, commandLog, manifest, releases, state };
};

type TRunOptions = Readonly<{
  action?: "execute" | "resume";
  backupConfirmed?: boolean;
  confirmed?: boolean;
  extraArgs?: ReadonlyArray<string>;
  failCandidate?: boolean;
  failBridge?: boolean;
  failHealth?: boolean;
  interruptPhase?: string;
  interruptCandidate?: boolean;
  interruptBridge?: boolean;
  interruptFinalize?: boolean;
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
        JOB_STATE: join(fixture.bundle, "../job.json"),
        FAIL_CANDIDATE: options.failCandidate === true ? "true" : "false",
        FAIL_BRIDGE: options.failBridge === true ? "true" : "false",
        FAIL_HEALTH: options.failHealth === true ? "true" : "false",
        INTERRUPT_MARKER: join(fixture.bundle, "../interrupt.marker"),
        INTERRUPT_PHASE: options.interruptPhase ?? "",
        INTERRUPT_CANDIDATE: options.interruptCandidate === true ? "true" : "false",
        INTERRUPT_BRIDGE: options.interruptBridge === true ? "true" : "false",
        INTERRUPT_FINALIZE: options.interruptFinalize === true ? "true" : "false",
        MAIN_HISTORY: join(fixture.bundle, "../main-history.json"),
        MAIN_REVISIONS: join(fixture.bundle, "../main-revisions"),
        TEMP_RELEASE_STATE: join(fixture.bundle, "../temporary-release.json"),
        FORMBRICKS_UPGRADE_POLL_INTERVAL_SECONDS: "0",
      },
    }
  );

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("Formbricks v6 Helm upgrade executor", { timeout: 20_000 }, () => {
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
    expect(readFileSync(fixture.state, "utf8")).toContain("migrationAcknowledged");
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
    const result = run(fixture, { failHealth: true });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "helm_candidate_failed_rolled_back", status: "blocked" }],
    });
    const commands = readFileSync(fixture.commandLog, "utf8");
    expect(commands).toContain("http://127.0.0.1:");
    expect(commands).toContain("rollback-begin");
    expect(commands).not.toContain("activation finalize");
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
    const fixture = createFixture(temporaryDirectory(), { gitops: true });
    const result = run(fixture);

    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "gitops_reconciliation_not_paused", status: "blocked" }],
    });
    expect(readFileSync(fixture.commandLog, "utf8")).not.toContain("helm upgrade");
  });
});
