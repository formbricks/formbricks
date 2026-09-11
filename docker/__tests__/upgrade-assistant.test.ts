import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
        targetImage: `ghcr.io/formbricks/formbricks@${targetDigest}`,
        targetRuntimeManifestDigest,
        upgradeChart: "formbricks-upgrade-6.0.0.tgz",
      },
    });
    expect(readFileSync(join(outputDirectory, "formbricks-upgrade-checksums.txt"), "utf8")).toMatch(
      /^[0-9a-f]{64}  formbricks-upgrade-assistant\n[0-9a-f]{64}  formbricks-upgrade-manifest\.json\n$/
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
});
