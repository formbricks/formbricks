import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const devDbUpScriptPath = fileURLToPath(new URL("./dev-db-up.sh", import.meta.url));
const tempDirs: string[] = [];

const createFixture = (authzedMode: "bundled" | "external", composeProfiles: string) => {
  const tempDir = mkdtempSync(join(tmpdir(), "formbricks-dev-db-up-"));
  const binDir = join(tempDir, "bin");
  const envPath = join(tempDir, ".env");
  const templatePath = join(tempDir, ".env.example");
  const composePath = join(tempDir, "docker-compose.dev.yml");
  const invocationPath = join(tempDir, "docker-invocation.txt");
  const pnpmInvocationsPath = join(tempDir, "pnpm-invocations.txt");
  const profilesPath = join(tempDir, "docker-profiles.txt");
  tempDirs.push(tempDir);
  mkdirSync(binDir);

  writeFileSync(
    templatePath,
    [
      "ENCRYPTION_KEY=00000000000000000000000000000000",
      "NEXTAUTH_SECRET=nextauth-secret",
      "CRON_SECRET=cron-secret",
      "CUBEJS_API_SECRET=cube-secret",
      `FORMBRICKS_DEV_AUTHZED_MODE=${authzedMode}`,
      "AUTHZED_ENABLED=true",
      "AUTHZED_ENDPOINT=grpc.authzed.com:443",
      "AUTHZED_TOKEN=authzed-token",
      "AUTHZED_SYSTEM_KEY=custom_system",
      "AUTHZED_INSECURE=false",
      "AUTHZED_CONSISTENCY=fully_consistent",
      "AUTHZED_DATABASE_PASSWORD=authzed-database-password",
      `COMPOSE_PROFILES=${composeProfiles}`,
      "",
    ].join("\n")
  );
  writeFileSync(composePath, "services: {}\n");
  writeFileSync(
    join(binDir, "docker"),
    '#!/bin/sh\nprintf "%s\\n" "$*" > "$DOCKER_INVOCATION_PATH"\nprintf "%s\\n" "$COMPOSE_PROFILES" > "$DOCKER_PROFILES_PATH"\n'
  );
  chmodSync(join(binDir, "docker"), 0o700);
  writeFileSync(join(binDir, "pnpm"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$PNPM_INVOCATIONS_PATH"\n');
  chmodSync(join(binDir, "pnpm"), 0o700);

  return {
    binDir,
    composePath,
    envPath,
    invocationPath,
    pnpmInvocationsPath,
    profilesPath,
    templatePath,
  };
};

const runDevDbUp = (authzedMode: "bundled" | "external", composeProfiles: string) => {
  const fixture = createFixture(authzedMode, composeProfiles);
  const result = spawnSync("bash", [devDbUpScriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      DOCKER_INVOCATION_PATH: fixture.invocationPath,
      DOCKER_PROFILES_PATH: fixture.profilesPath,
      FORMBRICKS_DEV_COMPOSE_FILE: fixture.composePath,
      FORMBRICKS_ENV_PATH: fixture.envPath,
      FORMBRICKS_ENV_TEMPLATE_PATH: fixture.templatePath,
      PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
      PNPM_INVOCATIONS_PATH: fixture.pnpmInvocationsPath,
    },
  });

  expect(result.status, result.stderr).toBe(0);
  return fixture;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("scripts/dev-db-up.sh", () => {
  test("starts bundled SpiceDB alongside the developer's other Compose profiles", () => {
    const fixture = runDevDbUp("bundled", "qwen,taxonomy");

    expect(readFileSync(fixture.profilesPath, "utf8").trim()).toBe("qwen,taxonomy,authzed-bundled");
    expect(readFileSync(fixture.invocationPath, "utf8").trim()).toBe(
      `compose --env-file ${fixture.envPath} --file ${fixture.composePath} --project-directory ${fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "")} up --detach`
    );
    expect(readFileSync(fixture.pnpmInvocationsPath, "utf8").trim().split("\n")).toEqual([
      "db:migrate:dev",
      "authzed:activation:bootstrap",
    ]);
  });

  test("removes the bundled profile when external AuthZed is selected", () => {
    const fixture = runDevDbUp("external", "qwen,authzed-bundled");

    expect(readFileSync(fixture.profilesPath, "utf8").trim()).toBe("qwen");
    expect(readFileSync(fixture.envPath, "utf8")).toContain("AUTHZED_ENDPOINT=grpc.authzed.com:443");
    expect(readFileSync(fixture.envPath, "utf8")).toContain("AUTHZED_INSECURE=false");
    expect(readFileSync(fixture.pnpmInvocationsPath, "utf8").trim().split("\n")).toEqual([
      "db:migrate:dev",
      "authzed:activation:bootstrap",
    ]);
  });
});
