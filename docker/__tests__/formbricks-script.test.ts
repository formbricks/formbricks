import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const formbricksScriptPath = fileURLToPath(new URL("../formbricks.sh", import.meta.url));
const dockerComposeTemplatePath = fileURLToPath(new URL("../docker-compose.yml", import.meta.url));

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const tempDir = mkdtempSync(join(tmpdir(), "formbricks-script-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const parseEnvFile = (contents: string): Map<string, string> =>
  new Map(
    contents
      .trim()
      .split("\n")
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      })
  );

const addFormbricksTraefikLabels = (
  composePath: string,
  hstsEnabled: "y" | "n",
  httpsSetup: "y" | "n"
): void => {
  execFileSync(
    "bash",
    [
      "-lc",
      'source "$1"; add_formbricks_traefik_labels "$2" "example.com" "$3" "$4"',
      "bash",
      formbricksScriptPath,
      composePath,
      hstsEnabled,
      httpsSetup,
    ],
    { encoding: "utf8" }
  );
};

const writeDockerComposeTemplate = (): string => {
  const tempDir = createTempDir();
  const composePath = join(tempDir, "docker-compose.yml");

  writeFileSync(composePath, readFileSync(dockerComposeTemplatePath, "utf8"));

  return composePath;
};

const getServiceBlock = (composeContents: string, serviceName: string): string => {
  const lines = composeContents.split("\n");
  const startIndex = lines.findIndex((line) => line === `  ${serviceName}:`);

  expect(startIndex).toBeGreaterThanOrEqual(0);

  const endIndex = lines.findIndex((line, index) => index > startIndex && /^ {2}[A-Za-z0-9_-]+:/.test(line));

  return lines.slice(startIndex, endIndex === -1 ? undefined : endIndex).join("\n");
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("docker/docker-compose.yml Cube configuration", () => {
  test("disables external pre-aggregations by default while allowing an operator override", () => {
    const composeContents = readFileSync(dockerComposeTemplatePath, "utf8");
    const cubeBlock = getServiceBlock(composeContents, "cube");

    expect(cubeBlock).toContain("      CUBEJS_EXTERNAL_DEFAULT: ${CUBEJS_EXTERNAL_DEFAULT:-false}");
  });
});

describe("docker/formbricks.sh AuthZed setup", () => {
  test("writes AuthZed secrets without printing them", () => {
    const envPath = join(createTempDir(), ".env");
    const authzedToken = "authzed-token-value";
    const authzedDatabasePassword = "authzed-database-password";

    const output = execFileSync(
      "bash",
      [
        "-lc",
        'source "$1"; write_base_env_file "$2" hub-key cube-secret "$3" "$4"',
        "bash",
        formbricksScriptPath,
        envPath,
        authzedToken,
        authzedDatabasePassword,
      ],
      { encoding: "utf8" }
    );

    const env = parseEnvFile(readFileSync(envPath, "utf8"));

    expect(output).toBe("");
    expect(output).not.toContain(authzedToken);
    expect(output).not.toContain(authzedDatabasePassword);
    expect(env.get("AUTHZED_TOKEN")).toBe(authzedToken);
    expect(env.get("AUTHZED_DATABASE_PASSWORD")).toBe(authzedDatabasePassword);
    expect(env.get("AUTHZED_ENABLED")).toBe("true");
    expect(env.get("AUTHZED_CONSISTENCY")).toBe("fully_consistent");
    expect(env.get("FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED")).toBe("true");
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
  });

  test("blocks customized updates until the AuthZed v6 contract is present and acknowledged", () => {
    const script = readFileSync(formbricksScriptPath, "utf8");
    const updateFunction = script.slice(
      script.indexOf("update_formbricks()"),
      script.indexOf("restart_formbricks()")
    );

    expect(updateFunction).toContain(
      "This installation does not yet contain the AuthZed v6 Compose services"
    );
    expect(updateFunction).toContain("FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true");
    expect(updateFunction).toContain("authzed-ops upgrade prepare");
    expect(updateFunction).toContain("authzed-ops upgrade check");
    expect(updateFunction.indexOf("upgrade check")).toBeLessThan(updateFunction.indexOf("compose down"));
  });

  test("runs the upgrade gates before stopping an existing installation", () => {
    const tempDir = createTempDir();
    const installationDir = join(tempDir, "formbricks");
    const binDir = join(tempDir, "bin");
    const commandLog = join(tempDir, "commands.log");
    mkdirSync(installationDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(installationDir, "docker-compose.yml"), "services:\n  authzed-ops:\n  spicedb:\n");
    writeFileSync(join(installationDir, ".env"), "FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true\n");
    writeFileSync(join(binDir, "sudo"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\n', {
      mode: 0o700,
    });

    const result = spawnSync("bash", ["-c", 'source "$1"; update_formbricks', "bash", formbricksScriptPath], {
      cwd: tempDir,
      encoding: "utf8",
      env: { ...process.env, COMMAND_LOG: commandLog, PATH: `${binDir}:${process.env.PATH ?? ""}` },
    });

    expect(result.status).toBe(0);
    const commands = readFileSync(commandLog, "utf8").trim().split("\n");
    expect(commands).toEqual([
      "docker compose pull",
      "docker compose run --rm formbricks-migrate",
      "docker compose --profile authzed-ops run --rm authzed-ops upgrade prepare",
      "docker compose --profile authzed-ops run --rm authzed-ops upgrade check",
      "docker compose down",
      "docker compose up -d",
    ]);
  });

  test("waits for the source migration before preparing a fresh AuthZed graph", () => {
    const script = readFileSync(formbricksScriptPath, "utf8");
    const setupStart = script.indexOf(
      "docker compose up -d postgres authzed-db-bootstrap spicedb-migrate spicedb formbricks-migrate"
    );
    const migrationWait = script.indexOf("docker compose wait formbricks-migrate", setupStart);
    const upgradePrepare = script.indexOf("authzed-ops upgrade prepare", setupStart);

    expect(setupStart).toBeGreaterThanOrEqual(0);
    expect(migrationWait).toBeGreaterThan(setupStart);
    expect(upgradePrepare).toBeGreaterThan(migrationWait);
  });

  test("pins and verifies the downloaded bootstrap helper before making it executable", () => {
    const script = readFileSync(formbricksScriptPath, "utf8");
    const downloadStart = script.indexOf(
      'authzed_bootstrap_commit="10d5ad908491a8a818aef3c6ada91fa4fdc30b03"'
    );
    const checksumStart = script.indexOf("sha256sum --check --status -", downloadStart);
    const chmodStart = script.indexOf("chmod 700 authzed-postgres-bootstrap.sh", checksumStart);

    expect(downloadStart).toBeGreaterThanOrEqual(0);
    expect(script.slice(downloadStart, checksumStart)).not.toContain(
      "formbricks/stable/docker/authzed-postgres-bootstrap.sh"
    );
    expect(script.slice(downloadStart, checksumStart)).toContain(
      "70975701cdf0dcffef5d3573a7514360e87428bb07cc4bfb4dbf47ae0c2e93a5"
    );
    expect(checksumStart).toBeGreaterThan(downloadStart);
    expect(chmodStart).toBeGreaterThan(checksumStart);
  });
});

describe("docker/formbricks.sh Traefik label injection", () => {
  test("adds HTTPS Traefik labels to the formbricks service only", () => {
    const composePath = writeDockerComposeTemplate();

    addFormbricksTraefikLabels(composePath, "y", "y");

    const composeContents = readFileSync(composePath, "utf8");
    const formbricksMigrateBlock = getServiceBlock(composeContents, "formbricks-migrate");
    const formbricksBlock = getServiceBlock(composeContents, "formbricks");
    const authzedBootstrapBlock = getServiceBlock(composeContents, "authzed-db-bootstrap");
    const authzedOpsBlock = getServiceBlock(composeContents, "authzed-ops");
    const authzedInitializeBlock = getServiceBlock(composeContents, "authzed-initialize");
    const spicedbBlock = getServiceBlock(composeContents, "spicedb");

    expect(formbricksMigrateBlock).not.toContain("    labels:");
    expect(formbricksMigrateBlock).not.toContain("traefik.enable=true");
    expect(authzedBootstrapBlock).toContain("authzed-postgres-bootstrap.sh");
    expect(authzedBootstrapBlock).not.toContain("traefik.enable=true");
    expect(spicedbBlock).toContain("authzed/spicedb:v1.52.0");
    expect(spicedbBlock).not.toContain("traefik.enable=true");
    expect(authzedOpsBlock).toContain('profiles: ["authzed-ops"]');
    expect(authzedOpsBlock).not.toContain("traefik.enable=true");
    expect(authzedInitializeBlock).toContain('command: ["upgrade", "prepare"]');
    expect(authzedInitializeBlock).not.toContain("traefik.enable=true");
    expect(formbricksBlock).toContain("    labels:");
    expect(formbricksBlock.indexOf("    labels:")).toBeLessThan(formbricksBlock.indexOf("    environment:"));
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.rule=Host(`example.com`)");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.entrypoints=websecure");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.tls.certresolver=default");
    expect(formbricksBlock).toContain("traefik.http.services.formbricks.loadbalancer.server.port=3000");
    expect(formbricksBlock).toContain(
      "traefik.http.routers.feedback-records-token.rule=Host(`example.com`) && Path(`/api/v3/feedbackRecords/token`)"
    );
    expect(formbricksBlock).toContain("traefik.http.routers.feedback-records-token.tls.certresolver=default");
    expect(formbricksBlock).toContain("traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000");
    expect(formbricksBlock).not.toContain("traefik.http.routers.formbricks_http.entrypoints=web");
  });

  test("omits ACME certresolver labels when HTTPS setup is disabled", () => {
    const composePath = writeDockerComposeTemplate();

    addFormbricksTraefikLabels(composePath, "y", "n");

    const composeContents = readFileSync(composePath, "utf8");
    const formbricksBlock = getServiceBlock(composeContents, "formbricks");

    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.entrypoints=websecure");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.tls=true");
    expect(formbricksBlock).toContain("traefik.http.routers.feedback-records-token.tls=true");
    expect(formbricksBlock).toContain("traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000");
    expect(formbricksBlock).not.toContain("tls.certresolver=default");
  });

  test("adds HTTP fallback labels when HSTS is disabled", () => {
    const composePath = writeDockerComposeTemplate();

    addFormbricksTraefikLabels(composePath, "n", "n");

    const composeContents = readFileSync(composePath, "utf8");
    const formbricksMigrateBlock = getServiceBlock(composeContents, "formbricks-migrate");
    const formbricksBlock = getServiceBlock(composeContents, "formbricks");

    expect(formbricksMigrateBlock).not.toContain("    labels:");
    expect(formbricksBlock).toContain("    labels:");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks_http.entrypoints=web");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks_http.rule=Host(`example.com`)");
    expect(formbricksBlock).toContain(
      "traefik.http.routers.feedback-records-token-http.rule=Host(`example.com`) && Path(`/api/v3/feedbackRecords/token`)"
    );
    expect(formbricksBlock).not.toContain("tls.certresolver=default");
    expect(formbricksBlock).not.toContain("traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000");
  });

  test("fails when the formbricks service insertion point is missing", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");

    writeFileSync(
      composePath,
      `services:
  formbricks:
    image: ghcr.io/formbricks/formbricks:latest
`
    );

    expect(() => {
      addFormbricksTraefikLabels(composePath, "y", "y");
    }).toThrow();
    expect(existsSync(`${composePath}.tmp`)).toBe(false);
  });
});
