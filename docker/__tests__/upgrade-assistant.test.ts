import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
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
const bundleBuilderPath = join(repositoryRoot, "scripts/build-v6-upgrade-assistant-bundle.sh");
const bridgeDigest = `sha256:${"a".repeat(64)}`;
const targetDigest = `sha256:${"b".repeat(64)}`;
const bridgeRuntimeManifestDigest = `sha256:${"c".repeat(64)}`;
const targetRuntimeManifestDigest = `sha256:${"d".repeat(64)}`;
const postgresBootstrapImage = `pgvector/pgvector@sha256:${"e".repeat(64)}`;
const spicedbImage = `authzed/spicedb@sha256:${"f".repeat(64)}`;
const dockerOverlayPath = join(repositoryRoot, "docker/formbricks-authzed-overlay.yml");
const postgresBootstrapPath = join(repositoryRoot, "docker/authzed-postgres-bootstrap.sh");
const digestFile = (path: string): string =>
  `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
const dockerOverlayDigest = digestFile(dockerOverlayPath);
const postgresBootstrapDigest = digestFile(postgresBootstrapPath);
const tempDirectories: string[] = [];

type TAssistantResult = Readonly<{
  status: number | null;
  stdout: string;
  stderr: string;
  result: {
    schemaVersion: number;
    status: "blocked" | "not_required" | "ready";
    mutating: boolean;
    installation: {
      type: "docker_compose" | "helm" | "one_click" | "unknown";
      currentVersion: string | null;
      currentImagePinned: boolean;
      currentImageDigest: string | null;
      databaseMode: "bundled" | "external" | "unknown";
      authzedConfigured: boolean;
    };
    release: {
      version: string | null;
      bridgeImageDigest: string | null;
      bridgeRuntimeManifestDigest: string | null;
      targetImageDigest: string | null;
      targetRuntimeManifestDigest: string | null;
    };
    checks: { code: string; status: "blocked" | "pass" | "warning" }[];
    plan: { phase: string; mutating: boolean; requiresConfirmation: boolean }[];
  };
}>;

const createTempDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "formbricks-upgrade-assistant-"));
  tempDirectories.push(directory);
  return directory;
};

const writeExecutable = (path: string, contents: string): void => {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
};

const writeManifest = (directory: string, overrides: Record<string, unknown> = {}): string => {
  const manifestPath = join(directory, "formbricks-upgrade-manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify({
      schemaVersion: 1,
      releaseVersion: "6.0.0",
      sourceRevision: "0123456789012345678901234567890123456789",
      minimumSourceVersion: "5.4.0",
      supportedInstallTypes: ["docker_compose", "helm", "one_click"],
      artifacts: {
        bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        bridgeRuntimeManifestDigest,
        formbricksChart: "formbricks-6.0.0.tgz",
        dockerAuthzedOverlaySha256: dockerOverlayDigest,
        authzedPostgresBootstrapSha256: postgresBootstrapDigest,
        postgresBootstrapImage,
        spicedbImage,
        targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
        targetRuntimeManifestDigest,
        upgradeChart: "formbricks-upgrade-6.0.0.tgz",
      },
      ...overrides,
    })
  );
  return manifestPath;
};

const runAssistant = (args: string[], environment: NodeJS.ProcessEnv = {}): TAssistantResult => {
  const processResult = spawnSync(assistantPath, args, {
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });

  return {
    status: processResult.status,
    stdout: processResult.stdout.trim(),
    stderr: processResult.stderr.trim(),
    result: JSON.parse(processResult.stdout) as TAssistantResult["result"],
  };
};

const createFakeDocker = (
  directory: string,
  renderedConfig: Record<string, unknown>
): Readonly<{ binDirectory: string; commandLog: string }> => {
  const binDirectory = join(directory, "bin");
  const configPath = join(directory, "rendered-compose.json");
  const commandLog = join(directory, "docker-commands.log");
  mkdirSync(binDirectory);
  writeFileSync(configPath, JSON.stringify(renderedConfig));
  writeExecutable(
    join(binDirectory, "docker"),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$COMMAND_LOG"
case "$*" in
  *"formbricks-authzed-overlay.yml"*)
    grep -Fqx 'AUTHZED_POSTGRES_BOOTSTRAP_IMAGE_REF=${postgresBootstrapImage}' "$UPGRADE_ENV_FILE" || exit 97
    grep -Fqx 'SPICEDB_IMAGE_REF=${spicedbImage}' "$UPGRADE_ENV_FILE" || exit 98
    [ "$AUTHZED_POSTGRES_BOOTSTRAP_IMAGE_REF" = '${postgresBootstrapImage}' ] || exit 99
    [ "$SPICEDB_IMAGE_REF" = '${spicedbImage}' ] || exit 100
    ;;
esac
case "$*" in
  "compose version") exit 0 ;;
  *" config --format json") cat "$DOCKER_CONFIG_JSON" ;;
  *" ps -q formbricks") printf '%s\\n' 'formbricks-container' ;;
  "inspect "*) printf '%s\\n' "$DOCKER_IMAGE_LABEL_VERSION" ;;
  "exec "*) printf '%s\\n' "$DOCKER_IMAGE_VERSION" ;;
  *) exit 1 ;;
esac
`
  );
  writeFileSync(commandLog, "");

  return { binDirectory, commandLog };
};

const createFakeHelm = (
  directory: string,
  releases: ReadonlyArray<Record<string, unknown>>,
  values: Record<string, unknown>
): Readonly<{ binDirectory: string; commandLog: string }> => {
  const binDirectory = join(directory, "bin");
  const releasesPath = join(directory, "helm-releases.json");
  const valuesPath = join(directory, "helm-values.json");
  const commandLog = join(directory, "cluster-commands.log");
  mkdirSync(binDirectory);
  writeFileSync(releasesPath, JSON.stringify(releases));
  writeFileSync(valuesPath, JSON.stringify(values));
  writeFileSync(commandLog, "");
  writeExecutable(
    join(binDirectory, "helm"),
    `#!/bin/sh
printf 'helm %s\\n' "$*" >> "$COMMAND_LOG"
case "$1" in
  list) cat "$HELM_RELEASES_JSON" ;;
  get) cat "$HELM_VALUES_JSON" ;;
  *) exit 1 ;;
esac
`
  );
  writeExecutable(
    join(binDirectory, "kubectl"),
    `#!/bin/sh
printf 'kubectl %s\\n' "$*" >> "$COMMAND_LOG"
if [ "$1" = auth ] && [ "$2" = can-i ]; then
  printf '%s\\n' yes
  exit 0
fi
exit 1
`
  );

  return { binDirectory, commandLog };
};

const createFakeUpgradeDocker = (
  directory: string,
  renderedConfig: Record<string, unknown>,
  options: Readonly<{
    failFinalize?: boolean;
    failHealth?: boolean;
    interruptBridge?: boolean;
    interruptPrepare?: boolean;
    authority?: "legacy" | "spicedb";
    transition?: string;
  }> = {}
): Readonly<{ binDirectory: string; commandLog: string }> => {
  const binDirectory = join(directory, "bin");
  const configPath = join(directory, "rendered-compose.json");
  const commandLog = join(directory, "upgrade-docker-commands.log");
  const interruptMarker = join(directory, "upgrade-interrupt.marker");
  mkdirSync(binDirectory);
  writeFileSync(configPath, JSON.stringify(renderedConfig));
  writeFileSync(commandLog, "");
  writeExecutable(
    join(binDirectory, "docker"),
    `#!/bin/sh
INTERRUPT_MARKER=${JSON.stringify(interruptMarker)}
printf '%s\\n' "$*" >> "$COMMAND_LOG"
case "$*" in
  "compose version") exit 0 ;;
  *" config --format json") cat "$DOCKER_CONFIG_JSON" ;;
  *" config") exit 0 ;;
  *" up -d --no-deps --force-recreate formbricks")
    if [ "${options.interruptBridge === true ? "true" : "false"}" = true ] && [ ! -e "$INTERRUPT_MARKER" ]; then
      touch "$INTERRUPT_MARKER"
      kill -9 "$PPID"
      exit 137
    fi
    ;;
  *" activation prepare "*)
    if [ "${options.interruptPrepare === true ? "true" : "false"}" = true ] && [ ! -e "$INTERRUPT_MARKER" ]; then
      touch "$INTERRUPT_MARKER"
      assistant_pid=$(ps -o ppid= -p "$PPID" | tr -d ' ')
      kill -9 "$assistant_pid"
      exit 137
    fi
    printf '%s\\n' '{"status":"prepared","receipt":"00000000-0000-4000-8000-000000000001"}'
    ;;
  *" activation status")
    if [ "${options.interruptPrepare === true ? "true" : "false"}" = true ] && [ -e "$INTERRUPT_MARKER" ]; then
      printf '%s\\n' '{"status":"ready","authority":"legacy","transition":"prepared"}'
    else
      printf '%s\\n' '{"status":"ready","authority":"${options.authority ?? "legacy"}","transition":"${options.transition ?? "idle"}"}'
    fi
    ;;
  *" activation runtime-check")
    if grep -Fqx "FORMBRICKS_IMAGE_REF=$TARGET_IMAGE" "$UPGRADE_ENV_FILE"; then
      printf '%s\\n' '{"status":"ready","authority":"spicedb"}'
    else
      printf '%s\\n' '{"status":"ready","authority":"legacy"}'
    fi
    ;;
  *"http://127.0.0.1:"*"/health"*) ${options.failHealth ? "exit 1" : "exit 0"} ;;
  *" activation finalize "*) ${options.failFinalize ? "exit 1" : "printf '%s\\n' '{\"status\":\"finalized\"}'"} ;;
  *" activation rollback-begin "*) printf '%s\\n' '{"status":"rollback_started"}' ;;
  *" activation rollback-complete "*) printf '%s\\n' '{"status":"rolled_back"}' ;;
  *) exit 0 ;;
esac
`
  );
  return { binDirectory, commandLog };
};

const createUpgradeFixture = (
  directory: string,
  options: Readonly<{
    failFinalize?: boolean;
    failHealth?: boolean;
    interruptBridge?: boolean;
    interruptPrepare?: boolean;
    authority?: "legacy" | "spicedb";
    transition?: string;
  }> = {}
): Readonly<{
  binDirectory: string;
  commandLog: string;
  composeDirectory: string;
  manifestPath: string;
}> => {
  const bundleDirectory = join(directory, "bundle");
  const composeDirectory = join(directory, "formbricks");
  mkdirSync(bundleDirectory);
  mkdirSync(composeDirectory);
  const manifestPath = writeManifest(bundleDirectory);
  copyFileSync(dockerOverlayPath, join(bundleDirectory, "formbricks-authzed-overlay.yml"));
  copyFileSync(postgresBootstrapPath, join(bundleDirectory, "authzed-postgres-bootstrap.sh"));
  writeFileSync(join(composeDirectory, "docker-compose.yml"), "services:\n  customer-owned: {}\n");
  writeFileSync(join(composeDirectory, ".env"), 'POSTGRES_PASSWORD="existing-password"\n');
  const { binDirectory, commandLog } = createFakeUpgradeDocker(
    directory,
    {
      services: {
        formbricks: {
          image: "ghcr.io/formbricks/formbricks:5.4.2",
          environment: { DATABASE_URL: "postgresql://postgres:existing-password@postgres:5432/formbricks" },
        },
        postgres: { environment: { POSTGRES_PASSWORD: "existing-password" } },
        traefik: {},
      },
    },
    options
  );
  return { binDirectory, commandLog, composeDirectory, manifestPath };
};

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("Formbricks v6 upgrade assistant", () => {
  test("builds a deterministic release manifest and checksum set", () => {
    const directory = createTempDirectory();
    const outputDirectory = join(directory, "bundle");
    const process = spawnSync(
      bundleBuilderPath,
      [
        "--release-version",
        "v6.0.0",
        "--source-revision",
        "0123456789012345678901234567890123456789",
        "--minimum-source-version",
        "5.4.0",
        "--bridge-image",
        `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        "--bridge-runtime-manifest-digest",
        bridgeRuntimeManifestDigest,
        "--postgres-bootstrap-image",
        postgresBootstrapImage,
        "--spicedb-image",
        spicedbImage,
        "--target-image",
        `ghcr.io/formbricks/formbricks@${targetDigest}`,
        "--target-runtime-manifest-digest",
        targetRuntimeManifestDigest,
        "--output-directory",
        outputDirectory,
      ],
      { cwd: repositoryRoot, encoding: "utf8" }
    );

    expect(process.status).toBe(0);
    expect(statSync(join(outputDirectory, "formbricks-upgrade-assistant")).mode & 0o111).not.toBe(0);
    expect(statSync(join(outputDirectory, "formbricks.sh")).mode & 0o111).not.toBe(0);
    expect(
      JSON.parse(readFileSync(join(outputDirectory, "formbricks-upgrade-manifest.json"), "utf8"))
    ).toMatchObject({
      schemaVersion: 1,
      releaseVersion: "6.0.0",
      minimumSourceVersion: "5.4.0",
      artifacts: {
        bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        bridgeRuntimeManifestDigest,
        formbricksChart: "formbricks-6.0.0.tgz",
        dockerAuthzedOverlaySha256: dockerOverlayDigest,
        authzedPostgresBootstrapSha256: postgresBootstrapDigest,
        postgresBootstrapImage,
        spicedbImage,
        targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
        targetRuntimeManifestDigest,
        upgradeChart: "formbricks-upgrade-6.0.0.tgz",
      },
    });
    expect(readFileSync(join(outputDirectory, "formbricks-upgrade-checksums.txt"), "utf8")).toMatch(
      /^[0-9a-f]{64}  formbricks-upgrade-assistant\n[0-9a-f]{64}  formbricks-upgrade-manifest\.json\n[0-9a-f]{64}  formbricks-authzed-overlay\.yml\n[0-9a-f]{64}  authzed-postgres-bootstrap\.sh\n[0-9a-f]{64}  formbricks\.sh\n$/
    );
  });

  test("detects a one-click install and emits a read-only sanitized plan", () => {
    const directory = createTempDirectory();
    const manifestPath = writeManifest(directory);
    const composeDirectory = join(directory, "formbricks");
    mkdirSync(composeDirectory);
    writeFileSync(join(composeDirectory, "docker-compose.yml"), "services: {}\n");
    const databaseSecret = "postgres-secret-that-must-not-escape";
    const authzedSecret = "authzed-secret-that-must-not-escape";
    const { binDirectory, commandLog } = createFakeDocker(directory, {
      services: {
        formbricks: {
          image: "ghcr.io/formbricks/formbricks:latest",
          environment: { DATABASE_URL: `postgresql://formbricks:${databaseSecret}@postgres/formbricks` },
        },
        postgres: { environment: { POSTGRES_PASSWORD: databaseSecret } },
        traefik: {},
        spicedb: { environment: { SPICEDB_GRPC_PRESHARED_KEY: authzedSecret } },
        "authzed-ops": { environment: { AUTHZED_TOKEN: authzedSecret } },
      },
    });
    const result = runAssistant(["--manifest", manifestPath, "--path", directory], {
      PATH: `${binDirectory}:${process.env.PATH}`,
      COMMAND_LOG: commandLog,
      DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
      DOCKER_IMAGE_VERSION: "5.4.2",
      DOCKER_IMAGE_LABEL_VERSION: "",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.result).toMatchObject({
      schemaVersion: 1,
      status: "ready",
      mutating: false,
      installation: {
        type: "one_click",
        currentVersion: "5.4.2",
        currentImagePinned: false,
        databaseMode: "bundled",
        authzedConfigured: true,
      },
      release: {
        bridgeImageDigest: bridgeDigest,
        bridgeRuntimeManifestDigest,
        targetImageDigest: targetDigest,
        targetRuntimeManifestDigest,
      },
    });
    expect(result.result.plan.map(({ phase }) => phase)).toEqual([
      "backup",
      "prepare_runtime",
      "build_relationship_graph",
      "fence_and_activate",
      "verify",
      "remove_temporary_resources",
    ]);
    expect(result.result.plan.filter(({ mutating }) => mutating)).toEqual(
      expect.arrayContaining([expect.objectContaining({ requiresConfirmation: true })])
    );
    expect(result.stdout).not.toContain(databaseSecret);
    expect(result.stdout).not.toContain(authzedSecret);

    const commands = readFileSync(commandLog, "utf8");
    expect(commands).toContain("compose");
    expect(commands).not.toMatch(/\b(up|down|pull|run|restart|stop|rm)\b/);
  });

  test("detects Helm and validates read-only cluster prerequisites", () => {
    const directory = createTempDirectory();
    const manifestPath = writeManifest(directory);
    const { binDirectory, commandLog } = createFakeHelm(
      directory,
      [
        {
          name: "customer-release",
          namespace: "private-namespace",
          chart: "formbricks-5.4.0",
          app_version: "5.4.3",
          status: "deployed",
        },
      ],
      {
        deployment: { image: { digest: `sha256:${"c".repeat(64)}` } },
        postgresql: { enabled: false, auth: { password: "database-secret-that-must-not-escape" } },
        authzed: { enabled: true, auth: { token: "authzed-secret-that-must-not-escape" } },
      }
    );
    const result = runAssistant(["--manifest", manifestPath, "--install-type", "helm"], {
      PATH: `${binDirectory}:${process.env.PATH}`,
      COMMAND_LOG: commandLog,
      HELM_RELEASES_JSON: join(directory, "helm-releases.json"),
      HELM_VALUES_JSON: join(directory, "helm-values.json"),
    });

    expect(result.status).toBe(0);
    expect(result.result).toMatchObject({
      status: "ready",
      mutating: false,
      installation: {
        type: "helm",
        currentVersion: "5.4.3",
        currentImagePinned: true,
        databaseMode: "external",
        authzedConfigured: true,
      },
    });
    expect(result.stdout).not.toContain("customer-release");
    expect(result.stdout).not.toContain("private-namespace");
    expect(result.stdout).not.toContain("database-secret-that-must-not-escape");
    expect(result.stdout).not.toContain("authzed-secret-that-must-not-escape");

    const commands = readFileSync(commandLog, "utf8");
    expect(commands).toContain("helm list");
    expect(commands).toContain("helm get values");
    expect(commands).toContain("kubectl auth can-i");
    expect(commands).not.toMatch(
      /\b(upgrade|install|uninstall|apply|create|patch|delete)\b(?! jobs| deployments)/
    );
  });

  test("blocks an ambiguous Helm context before reading release values", () => {
    const directory = createTempDirectory();
    const manifestPath = writeManifest(directory);
    const { binDirectory, commandLog } = createFakeHelm(
      directory,
      [
        {
          name: "first",
          namespace: "one",
          chart: "formbricks-5.4.0",
          app_version: "5.4.3",
          status: "deployed",
        },
        {
          name: "second",
          namespace: "two",
          chart: "formbricks-5.4.0",
          app_version: "5.4.3",
          status: "deployed",
        },
      ],
      {}
    );
    const result = runAssistant(["--manifest", manifestPath, "--install-type", "helm"], {
      PATH: `${binDirectory}:${process.env.PATH}`,
      COMMAND_LOG: commandLog,
      HELM_RELEASES_JSON: join(directory, "helm-releases.json"),
      HELM_VALUES_JSON: join(directory, "helm-values.json"),
    });

    expect(result.status).toBe(2);
    expect(result.result.checks).toContainEqual({ code: "helm_release_ambiguous", status: "blocked" });
    expect(readFileSync(commandLog, "utf8")).not.toContain("helm get values");
  });

  test("blocks unsupported and unknown source versions without changing the installation", () => {
    const directory = createTempDirectory();
    const manifestPath = writeManifest(directory);
    const composePath = join(directory, "docker-compose.yml");
    writeFileSync(composePath, "services: {}\n");
    const { binDirectory, commandLog } = createFakeDocker(directory, {
      services: {
        formbricks: {
          image: "ghcr.io/formbricks/formbricks:4.9.0",
          environment: { DATABASE_URL: "postgresql://redacted" },
        },
        postgres: {},
      },
    });
    const result = runAssistant(
      ["--manifest", manifestPath, "--install-type", "docker", "--path", composePath],
      {
        PATH: `${binDirectory}:${process.env.PATH}`,
        COMMAND_LOG: commandLog,
        DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
        DOCKER_IMAGE_VERSION: "",
        DOCKER_IMAGE_LABEL_VERSION: "",
      }
    );

    expect(result.status).toBe(2);
    expect(result.result.status).toBe("blocked");
    expect(result.result.checks).toContainEqual({ code: "source_version_unsupported", status: "blocked" });
    expect(result.result.plan).toEqual([]);
    expect(readFileSync(commandLog, "utf8")).not.toMatch(/\b(up|down|pull|run|restart|stop|rm)\b/);
  });

  test("reports that an existing v6 deployment does not require the major-upgrade plan", () => {
    const directory = createTempDirectory();
    const manifestPath = writeManifest(directory);
    const composePath = join(directory, "docker-compose.yml");
    writeFileSync(composePath, "services: {}\n");
    const { binDirectory, commandLog } = createFakeDocker(directory, {
      services: {
        formbricks: {
          image: `ghcr.io/formbricks/formbricks@sha256:${"c".repeat(64)}`,
          environment: { DATABASE_URL: "postgresql://redacted" },
        },
        postgres: {},
      },
    });
    const result = runAssistant(
      [
        "--manifest",
        manifestPath,
        "--install-type",
        "docker",
        "--path",
        composePath,
        "--current-version",
        "6.0.0-rc.2",
      ],
      {
        PATH: `${binDirectory}:${process.env.PATH}`,
        COMMAND_LOG: commandLog,
        DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
        DOCKER_IMAGE_VERSION: "",
        DOCKER_IMAGE_LABEL_VERSION: "",
      }
    );

    expect(result.status).toBe(0);
    expect(result.result.status).toBe("not_required");
    expect(result.result.plan).toEqual([]);
  });

  test("rejects a manifest whose image references are mutable", () => {
    const directory = createTempDirectory();
    const manifestPath = writeManifest(directory, {
      artifacts: {
        bridgeImage: "ghcr.io/formbricks/formbricks:5.4",
        targetImage: "ghcr.io/formbricks/formbricks:6.0.0",
        token: "manifest-secret-that-must-not-escape",
      },
    });
    const result = runAssistant([
      "--manifest",
      manifestPath,
      "--install-type",
      "docker",
      "--path",
      "/does-not-exist",
      "--current-version",
      "5.4.0",
    ]);

    expect(result.status).toBe(2);
    expect(result.result.checks).toContainEqual({ code: "release_manifest_invalid", status: "blocked" });
    expect(result.stdout).not.toContain("manifest-secret-that-must-not-escape");
    expect(result.stdout).not.toContain("ghcr.io/formbricks/formbricks:5.4");
  });

  test.each([
    ["tag-only PostgreSQL bootstrap image", "pgvector/pgvector:pg18", spicedbImage],
    [
      "foreign PostgreSQL bootstrap repository",
      `example.invalid/pgvector@sha256:${"e".repeat(64)}`,
      spicedbImage,
    ],
    ["tag-only SpiceDB image", postgresBootstrapImage, "authzed/spicedb:v1.52.0"],
    [
      "foreign SpiceDB repository",
      postgresBootstrapImage,
      `example.invalid/spicedb@sha256:${"f".repeat(64)}`,
    ],
  ])("rejects a %s", (_label, invalidPostgresImage, invalidSpicedbImage) => {
    const directory = createTempDirectory();
    const manifestPath = writeManifest(directory, {
      artifacts: {
        bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        bridgeRuntimeManifestDigest,
        formbricksChart: "formbricks-6.0.0.tgz",
        dockerAuthzedOverlaySha256: dockerOverlayDigest,
        authzedPostgresBootstrapSha256: postgresBootstrapDigest,
        postgresBootstrapImage: invalidPostgresImage,
        spicedbImage: invalidSpicedbImage,
        targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
        targetRuntimeManifestDigest,
        upgradeChart: "formbricks-upgrade-6.0.0.tgz",
      },
    });

    const result = runAssistant([
      "--manifest",
      manifestPath,
      "--install-type",
      "docker",
      "--path",
      "/does-not-exist",
      "--current-version",
      "5.4.0",
    ]);

    expect(result.status).toBe(2);
    expect(result.result.checks).toContainEqual({ code: "release_manifest_invalid", status: "blocked" });
    expect(result.stdout).not.toContain(String(invalidPostgresImage));
    expect(result.stdout).not.toContain(String(invalidSpicedbImage));
  });

  test("does not echo an invalid current-version override", () => {
    const directory = createTempDirectory();
    const manifestPath = writeManifest(directory);
    const sensitiveOverride = "not-a-version-secret-value";
    const result = runAssistant([
      "--manifest",
      manifestPath,
      "--install-type",
      "docker",
      "--path",
      "/does-not-exist",
      "--current-version",
      sensitiveOverride,
    ]);

    expect(result.status).toBe(2);
    expect(result.result.checks).toContainEqual({
      code: "current_version_override_invalid",
      status: "blocked",
    });
    expect(result.stdout).not.toContain(sensitiveOverride);
  });

  test("executes bridge, receipt activation, candidate verification, and finalization", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory);
    const originalCompose = readFileSync(join(composeDirectory, "docker-compose.yml"), "utf8");
    const processResult = spawnSync(
      assistantPath,
      ["execute", "--manifest", manifestPath, "--path", composeDirectory, "--yes"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          COMMAND_LOG: commandLog,
          DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
          AUTHZED_POSTGRES_BOOTSTRAP_IMAGE_REF: "pgvector/pgvector:tampered",
          SPICEDB_IMAGE_REF: "authzed/spicedb:tampered",
          TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
          UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
        },
      }
    );

    expect(processResult.status).toBe(0);
    expect(JSON.parse(processResult.stdout)).toMatchObject({ status: "upgraded", mutating: true });
    expect(readFileSync(join(composeDirectory, "docker-compose.yml"), "utf8")).toBe(originalCompose);
    expect(readFileSync(join(composeDirectory, "formbricks-authzed-overlay.yml"), "utf8")).toBe(
      readFileSync(dockerOverlayPath, "utf8")
    );
    expect(readFileSync(join(composeDirectory, ".env"), "utf8")).toContain(
      `FORMBRICKS_IMAGE_REF=ghcr.io/formbricks/formbricks@${targetDigest}`
    );
    expect(readFileSync(join(composeDirectory, ".env"), "utf8")).toContain(
      `AUTHZED_POSTGRES_BOOTSTRAP_IMAGE_REF=${postgresBootstrapImage}`
    );
    expect(readFileSync(join(composeDirectory, ".env"), "utf8")).toContain(
      `SPICEDB_IMAGE_REF=${spicedbImage}`
    );
    expect(
      JSON.parse(readFileSync(join(composeDirectory, ".formbricks-v6-upgrade-state.json"), "utf8"))
    ).toMatchObject({ state: "finalized" });

    const commands = readFileSync(commandLog, "utf8");
    expect(commands.indexOf(`pull ghcr.io/formbricks/formbricks@${targetDigest}`)).toBeLessThan(
      commands.indexOf(" stop --timeout 60 formbricks")
    );
    expect(commands.indexOf("activation prepare")).toBeLessThan(
      commands.indexOf(" stop --timeout 60 formbricks")
    );
    expect(commands.indexOf("activation activate")).toBeLessThan(
      commands.lastIndexOf(" activation runtime-check")
    );
    expect(commands.lastIndexOf(" activation runtime-check")).toBeLessThan(
      commands.indexOf("activation finalize")
    );
    expect(commands.indexOf("http://127.0.0.1:")).toBeLessThan(commands.indexOf("activation finalize"));
    expect(processResult.stdout + processResult.stderr).not.toContain("existing-password");
    expect(readFileSync(join(composeDirectory, "formbricks-v6-upgrade.log"), "utf8")).not.toContain(
      "existing-password"
    );
  });

  test("persists the signed upgrade state before the first bridge start and resumes on a v6 runtime", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory, {
      interruptBridge: true,
    });
    const environment = {
      ...process.env,
      PATH: `${binDirectory}:${process.env.PATH}`,
      COMMAND_LOG: commandLog,
      DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
      TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
      UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
      FORMBRICKS_UPGRADE_POLL_INTERVAL_SECONDS: "0",
    };

    const interrupted = spawnSync(
      assistantPath,
      ["execute", "--manifest", manifestPath, "--path", composeDirectory, "--yes"],
      { encoding: "utf8", env: environment }
    );

    expect(interrupted.signal === "SIGKILL" || interrupted.status === 137).toBe(true);
    const statePath = join(composeDirectory, ".formbricks-v6-upgrade-state.json");
    expect(statSync(statePath).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toMatchObject({
      state: "initialized",
      bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
      targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
    });

    const resumed = spawnSync(
      assistantPath,
      [
        "resume",
        "--manifest",
        manifestPath,
        "--path",
        composeDirectory,
        "--current-version",
        "6.0.0",
        "--yes",
      ],
      { encoding: "utf8", env: environment }
    );

    expect(resumed.status, `${resumed.stdout}\n${resumed.stderr}`).toBe(0);
    expect(JSON.parse(resumed.stdout)).toMatchObject({ status: "upgraded" });
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toMatchObject({ state: "finalized" });
  });

  test("recovers a prepare receipt whose response was lost before the journal write", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory, {
      interruptPrepare: true,
    });
    const environment = {
      ...process.env,
      PATH: `${binDirectory}:${process.env.PATH}`,
      COMMAND_LOG: commandLog,
      DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
      TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
      UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
      FORMBRICKS_UPGRADE_POLL_INTERVAL_SECONDS: "0",
    };
    const interrupted = spawnSync(
      assistantPath,
      ["execute", "--manifest", manifestPath, "--path", composeDirectory, "--yes"],
      { encoding: "utf8", env: environment }
    );

    expect(interrupted.signal === "SIGKILL" || interrupted.status === 137).toBe(true);
    const statePath = join(composeDirectory, ".formbricks-v6-upgrade-state.json");
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toMatchObject({
      state: "bridge_ready",
      receipt: null,
    });

    const resumed = spawnSync(
      assistantPath,
      [
        "resume",
        "--manifest",
        manifestPath,
        "--path",
        composeDirectory,
        "--current-version",
        "6.0.0",
        "--yes",
      ],
      { encoding: "utf8", env: environment }
    );

    expect(resumed.status, `${resumed.stdout}\n${resumed.stderr}`).toBe(0);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toMatchObject({
      state: "finalized",
      receipt: "00000000-0000-4000-8000-000000000001",
    });
    expect(readFileSync(commandLog, "utf8").match(/activation prepare/g)).toHaveLength(2);
  });

  test("accepts an idempotent finalize after the database commit preceded the journal write", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory, {
      authority: "spicedb",
      transition: "idle",
    });
    const statePath = join(composeDirectory, ".formbricks-v6-upgrade-state.json");
    writeFileSync(
      statePath,
      JSON.stringify({
        state: "activated",
        receipt: "00000000-0000-4000-8000-000000000001",
        bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        bridgeManifestDigest: bridgeRuntimeManifestDigest,
        targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
        targetManifestDigest: targetRuntimeManifestDigest,
      })
    );
    chmodSync(statePath, 0o600);
    const resumed = spawnSync(
      assistantPath,
      [
        "resume",
        "--manifest",
        manifestPath,
        "--path",
        composeDirectory,
        "--current-version",
        "6.0.0",
        "--yes",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          COMMAND_LOG: commandLog,
          DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
          TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
          UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
          FORMBRICKS_UPGRADE_POLL_INTERVAL_SECONDS: "0",
        },
      }
    );

    expect(resumed.status, `${resumed.stdout}\n${resumed.stderr}`).toBe(0);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toMatchObject({ state: "finalized" });
    const commands = readFileSync(commandLog, "utf8");
    expect(commands).toContain("activation finalize");
    expect(commands).not.toContain("rollback-begin");
  });

  test("rolls back instead of finalizing when the candidate is not serving health", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory, {
      failHealth: true,
    });
    const result = spawnSync(
      assistantPath,
      ["execute", "--manifest", manifestPath, "--path", composeDirectory, "--yes"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          COMMAND_LOG: commandLog,
          DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
          TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
          UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
          FORMBRICKS_UPGRADE_POLL_INTERVAL_SECONDS: "0",
        },
      }
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      checks: [{ code: "candidate_failed_rolled_back", status: "blocked" }],
    });
    const commands = readFileSync(commandLog, "utf8");
    expect(commands).toContain("http://127.0.0.1:");
    expect(commands).toContain("rollback-begin");
    expect(commands).not.toContain("activation finalize");
  });

  test("rolls authority and runtime back to the bridge when candidate finalization fails", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory, {
      failFinalize: true,
    });
    const processResult = spawnSync(
      assistantPath,
      ["execute", "--manifest", manifestPath, "--path", composeDirectory, "--yes"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          COMMAND_LOG: commandLog,
          DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
          TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
          UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
        },
      }
    );

    expect(processResult.status).toBe(1);
    expect(JSON.parse(processResult.stdout)).toMatchObject({
      status: "blocked",
      checks: [{ code: "candidate_failed_rolled_back", status: "blocked" }],
    });
    expect(readFileSync(join(composeDirectory, ".env"), "utf8")).toContain(
      `FORMBRICKS_IMAGE_REF=ghcr.io/formbricks/formbricks@${bridgeDigest}`
    );
    expect(
      JSON.parse(readFileSync(join(composeDirectory, ".formbricks-v6-upgrade-state.json"), "utf8"))
    ).toMatchObject({ state: "rolled_back" });
    const commands = readFileSync(commandLog, "utf8");
    expect(commands.indexOf("activation rollback-begin")).toBeLessThan(
      commands.indexOf("activation rollback-complete")
    );
  });

  test("recovers an interrupted post-activation run to the recorded bridge before returning", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory, {
      authority: "spicedb",
      transition: "activating",
    });
    writeFileSync(
      join(composeDirectory, ".formbricks-v6-upgrade-state.json"),
      JSON.stringify({
        state: "activated",
        receipt: "00000000-0000-4000-8000-000000000001",
        bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        bridgeManifestDigest: bridgeRuntimeManifestDigest,
        targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
        targetManifestDigest: targetRuntimeManifestDigest,
      })
    );
    const processResult = spawnSync(
      assistantPath,
      ["execute", "--manifest", manifestPath, "--path", composeDirectory, "--yes"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          COMMAND_LOG: commandLog,
          DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
          TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
          UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
        },
      }
    );

    expect(processResult.status).toBe(1);
    expect(JSON.parse(processResult.stdout)).toMatchObject({
      checks: [{ code: "interrupted_upgrade_rolled_back", status: "blocked" }],
    });
    expect(readFileSync(join(composeDirectory, ".env"), "utf8")).toContain(
      `FORMBRICKS_IMAGE_REF=ghcr.io/formbricks/formbricks@${bridgeDigest}`
    );
    expect(
      JSON.parse(readFileSync(join(composeDirectory, ".formbricks-v6-upgrade-state.json"), "utf8"))
    ).toMatchObject({ state: "rolled_back" });
  });

  test("consults the recovery journal when an interrupted bridge or candidate reports v6", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory, {
      authority: "spicedb",
      transition: "activating",
    });
    writeFileSync(
      join(composeDirectory, ".formbricks-v6-upgrade-state.json"),
      JSON.stringify({
        state: "activated",
        receipt: "00000000-0000-4000-8000-000000000001",
        bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        bridgeManifestDigest: bridgeRuntimeManifestDigest,
        targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
        targetManifestDigest: targetRuntimeManifestDigest,
      })
    );
    const processResult = spawnSync(
      assistantPath,
      [
        "execute",
        "--manifest",
        manifestPath,
        "--path",
        composeDirectory,
        "--current-version",
        "6.0.0",
        "--yes",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          COMMAND_LOG: commandLog,
          DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
          TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
          UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
        },
      }
    );

    expect(processResult.status).toBe(1);
    expect(JSON.parse(processResult.stdout)).toMatchObject({
      checks: [{ code: "interrupted_upgrade_rolled_back", status: "blocked" }],
    });
    expect(readFileSync(commandLog, "utf8")).toContain("activation rollback-begin");
  });

  test("keeps execute read-only when a v6 install has no matching recovery journal", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory);
    const processResult = spawnSync(
      assistantPath,
      ["execute", "--manifest", manifestPath, "--path", composeDirectory, "--current-version", "6.0.0"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          COMMAND_LOG: commandLog,
          DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
          TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
          UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
        },
      }
    );

    expect(processResult.status).toBe(0);
    expect(JSON.parse(processResult.stdout)).toMatchObject({ status: "not_required", mutating: false });
    expect(readFileSync(commandLog, "utf8")).not.toMatch(/\b(up|pull|run|stop)\b/);
    expect(() => statSync(join(composeDirectory, "formbricks-authzed-overlay.yml"))).toThrow();
  });

  test("aborts a recorded prepared receipt before creating a replacement", () => {
    const directory = createTempDirectory();
    const { binDirectory, commandLog, composeDirectory, manifestPath } = createUpgradeFixture(directory, {
      authority: "legacy",
      transition: "prepared",
    });
    writeFileSync(
      join(composeDirectory, ".formbricks-v6-upgrade-state.json"),
      JSON.stringify({
        state: "prepared",
        receipt: "00000000-0000-4000-8000-000000000001",
        bridgeImage: `ghcr.io/formbricks/formbricks@${bridgeDigest}`,
        bridgeManifestDigest: bridgeRuntimeManifestDigest,
        targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
        targetManifestDigest: targetRuntimeManifestDigest,
      })
    );
    const processResult = spawnSync(
      assistantPath,
      ["execute", "--manifest", manifestPath, "--path", composeDirectory, "--yes"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          COMMAND_LOG: commandLog,
          DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
          TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
          UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
        },
      }
    );

    expect(processResult.status).toBe(0);
    const commands = readFileSync(commandLog, "utf8");
    expect(commands.indexOf("activation abort")).toBeLessThan(commands.indexOf("activation prepare"));
    expect(
      JSON.parse(readFileSync(join(composeDirectory, ".formbricks-v6-upgrade-state.json"), "utf8"))
    ).toMatchObject({ state: "finalized" });
  });

  test("blocks external PostgreSQL even when a stale postgres service remains in Compose", () => {
    const directory = createTempDirectory();
    const bundleDirectory = join(directory, "bundle");
    const composeDirectory = join(directory, "formbricks");
    mkdirSync(bundleDirectory);
    mkdirSync(composeDirectory);
    const manifestPath = writeManifest(bundleDirectory);
    copyFileSync(dockerOverlayPath, join(bundleDirectory, "formbricks-authzed-overlay.yml"));
    copyFileSync(postgresBootstrapPath, join(bundleDirectory, "authzed-postgres-bootstrap.sh"));
    const composePath = join(composeDirectory, "docker-compose.yml");
    writeFileSync(composePath, "services:\n  customer-owned: {}\n");
    const originalCompose = readFileSync(composePath, "utf8");
    const { binDirectory, commandLog } = createFakeUpgradeDocker(directory, {
      services: {
        formbricks: {
          image: "ghcr.io/formbricks/formbricks:5.4.2",
          environment: { DATABASE_URL: "postgresql://formbricks:redacted@database.example/formbricks" },
        },
        postgres: { environment: { POSTGRES_PASSWORD: "unused-stale-password" } },
      },
    });
    const processResult = spawnSync(
      assistantPath,
      ["execute", "--manifest", manifestPath, "--path", composeDirectory, "--yes"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          COMMAND_LOG: commandLog,
          DOCKER_CONFIG_JSON: join(directory, "rendered-compose.json"),
          TARGET_IMAGE: `ghcr.io/formbricks/formbricks@${targetDigest}`,
          UPGRADE_ENV_FILE: join(composeDirectory, ".env"),
        },
      }
    );

    expect(processResult.status).toBe(2);
    expect(JSON.parse(processResult.stdout)).toMatchObject({
      checks: [{ code: "docker_external_database_not_supported", status: "blocked" }],
    });
    expect(readFileSync(composePath, "utf8")).toBe(originalCompose);
    expect(readFileSync(commandLog, "utf8")).not.toMatch(/\b(up|pull|run|stop)\b/);
    expect(() => statSync(join(composeDirectory, "formbricks-authzed-overlay.yml"))).toThrow();
  });
});
