import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const setupDevEnvScriptPath = fileURLToPath(new URL("./setup-dev-env.sh", import.meta.url));
const tempDirs: string[] = [];

const createTempDir = (): string => {
  const tempDir = mkdtempSync(join(tmpdir(), "formbricks-authzed-dev-"));
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

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("scripts/setup-dev-env.sh AuthZed setup", () => {
  test("configures bundled AuthZed and preserves generated secrets", () => {
    const tempDir = createTempDir();
    const templatePath = join(tempDir, ".env.example");
    const envPath = join(tempDir, ".env");

    writeFileSync(
      templatePath,
      [
        "ENCRYPTION_KEY=",
        "NEXTAUTH_SECRET=",
        "CRON_SECRET=",
        "CUBEJS_API_SECRET=",
        "AUTHZED_TOKEN=",
        "AUTHZED_DATABASE_PASSWORD=",
        "",
      ].join("\n")
    );

    const commandEnv = {
      ...process.env,
      FORMBRICKS_ENV_PATH: envPath,
      FORMBRICKS_ENV_TEMPLATE_PATH: templatePath,
    };

    execFileSync("bash", [setupDevEnvScriptPath], { env: commandEnv });
    const firstEnv = parseEnvFile(readFileSync(envPath, "utf8"));

    expect(firstEnv.get("AUTHZED_TOKEN")).toMatch(/^[a-f0-9]{64}$/);
    expect(firstEnv.get("AUTHZED_DATABASE_PASSWORD")).toMatch(/^[a-f0-9]{64}$/);
    expect(firstEnv.get("FORMBRICKS_DEV_AUTHZED_MODE")).toBe("bundled");
    expect(firstEnv.get("AUTHZED_ENABLED")).toBe("true");
    expect(firstEnv.get("AUTHZED_ENDPOINT")).toBe("localhost:50051");
    expect(firstEnv.get("AUTHZED_SYSTEM_KEY")).toBe("formbricks");
    expect(firstEnv.get("AUTHZED_INSECURE")).toBe("true");
    expect(firstEnv.get("AUTHZED_CONSISTENCY")).toBe("fully_consistent");

    execFileSync("bash", [setupDevEnvScriptPath], { env: commandEnv });
    const secondEnv = parseEnvFile(readFileSync(envPath, "utf8"));

    expect(secondEnv.get("AUTHZED_TOKEN")).toBe(firstEnv.get("AUTHZED_TOKEN"));
    expect(secondEnv.get("AUTHZED_DATABASE_PASSWORD")).toBe(firstEnv.get("AUTHZED_DATABASE_PASSWORD"));
  });

  test("repairs managed bundled settings while respecting the configured localhost port", () => {
    const tempDir = createTempDir();
    const templatePath = join(tempDir, ".env.example");
    const envPath = join(tempDir, ".env");

    writeFileSync(
      templatePath,
      [
        "ENCRYPTION_KEY=00000000000000000000000000000000",
        "NEXTAUTH_SECRET=nextauth-secret",
        "CRON_SECRET=cron-secret",
        "CUBEJS_API_SECRET=cube-secret",
        "AUTHZED_ENABLED=1",
        "AUTHZED_ENDPOINT=localhost:50051",
        "AUTHZED_TOKEN=external-secret-that-must-be-preserved",
        "AUTHZED_SYSTEM_KEY=old_system",
        "AUTHZED_INSECURE=false",
        "AUTHZED_CONSISTENCY=minimize_latency",
        "AUTHZED_DATABASE_PASSWORD=database-secret-that-must-be-preserved",
        "SPICEDB_GRPC_PORT=50123",
        "",
      ].join("\n")
    );

    execFileSync("bash", [setupDevEnvScriptPath], {
      env: {
        ...process.env,
        FORMBRICKS_ENV_PATH: envPath,
        FORMBRICKS_ENV_TEMPLATE_PATH: templatePath,
      },
    });

    const env = parseEnvFile(readFileSync(envPath, "utf8"));
    expect(env.get("AUTHZED_ENDPOINT")).toBe("localhost:50123");
    expect(env.get("AUTHZED_SYSTEM_KEY")).toBe("formbricks");
    expect(env.get("AUTHZED_INSECURE")).toBe("true");
    expect(env.get("AUTHZED_CONSISTENCY")).toBe("fully_consistent");
    expect(env.get("AUTHZED_TOKEN")).toBe("external-secret-that-must-be-preserved");
    expect(env.get("AUTHZED_DATABASE_PASSWORD")).toBe("database-secret-that-must-be-preserved");
  });

  test("preserves an external AuthZed configuration exactly", () => {
    const tempDir = createTempDir();
    const templatePath = join(tempDir, ".env.example");
    const envPath = join(tempDir, ".env");
    const externalSettings = [
      "AUTHZED_ENABLED=1",
      "AUTHZED_ENDPOINT=grpc.authzed.com:443",
      "AUTHZED_TOKEN=external-token",
      "AUTHZED_SYSTEM_KEY=custom_system",
      "AUTHZED_INSECURE=0",
      "AUTHZED_CONSISTENCY=fully_consistent",
    ];

    writeFileSync(
      templatePath,
      [
        "ENCRYPTION_KEY=00000000000000000000000000000000",
        "NEXTAUTH_SECRET=nextauth-secret",
        "CRON_SECRET=cron-secret",
        "CUBEJS_API_SECRET=cube-secret",
        ...externalSettings,
        "AUTHZED_DATABASE_PASSWORD=",
        "",
      ].join("\n")
    );

    execFileSync("bash", [setupDevEnvScriptPath], {
      env: {
        ...process.env,
        FORMBRICKS_DEV_AUTHZED_MODE: "external",
        FORMBRICKS_ENV_PATH: envPath,
        FORMBRICKS_ENV_TEMPLATE_PATH: templatePath,
      },
    });

    const env = parseEnvFile(readFileSync(envPath, "utf8"));
    expect(env.get("FORMBRICKS_DEV_AUTHZED_MODE")).toBe("external");
    for (const setting of externalSettings) {
      const separatorIndex = setting.indexOf("=");
      expect(env.get(setting.slice(0, separatorIndex))).toBe(setting.slice(separatorIndex + 1));
    }
    expect(env.get("AUTHZED_DATABASE_PASSWORD")).toBe("");
  });

  test.each(["false", "0"])("rejects explicitly disabled AuthZed (%s)", (enabled) => {
    const tempDir = createTempDir();
    const templatePath = join(tempDir, ".env.example");
    const envPath = join(tempDir, ".env");

    writeFileSync(
      templatePath,
      [
        "ENCRYPTION_KEY=00000000000000000000000000000000",
        "NEXTAUTH_SECRET=nextauth-secret",
        "CRON_SECRET=cron-secret",
        "CUBEJS_API_SECRET=cube-secret",
        `AUTHZED_ENABLED=${enabled}`,
        "AUTHZED_TOKEN=authzed-token",
        "AUTHZED_DATABASE_PASSWORD=authzed-database-password",
        "",
      ].join("\n")
    );

    const result = spawnSync("bash", [setupDevEnvScriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        FORMBRICKS_ENV_PATH: envPath,
        FORMBRICKS_ENV_TEMPLATE_PATH: templatePath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("AUTHZED_ENABLED cannot be disabled");
    expect(result.stdout).not.toContain("authzed-token");
    expect(result.stderr).not.toContain("authzed-token");
  });

  test("rejects an incomplete external configuration without rewriting it", () => {
    const tempDir = createTempDir();
    const templatePath = join(tempDir, ".env.example");
    const envPath = join(tempDir, ".env");

    writeFileSync(
      templatePath,
      [
        "ENCRYPTION_KEY=00000000000000000000000000000000",
        "NEXTAUTH_SECRET=nextauth-secret",
        "CRON_SECRET=cron-secret",
        "CUBEJS_API_SECRET=cube-secret",
        "AUTHZED_ENABLED=true",
        "AUTHZED_ENDPOINT=grpc.authzed.com:443",
        "AUTHZED_TOKEN=",
        "AUTHZED_SYSTEM_KEY=custom_system",
        "AUTHZED_INSECURE=false",
        "AUTHZED_CONSISTENCY=fully_consistent",
        "",
      ].join("\n")
    );

    const result = spawnSync("bash", [setupDevEnvScriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        FORMBRICKS_DEV_AUTHZED_MODE: "external",
        FORMBRICKS_ENV_PATH: envPath,
        FORMBRICKS_ENV_TEMPLATE_PATH: templatePath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("AUTHZED_TOKEN is required");
    expect(parseEnvFile(readFileSync(envPath, "utf8")).get("AUTHZED_TOKEN")).toBe("");
  });

  test("rejects an unknown development AuthZed mode", () => {
    const tempDir = createTempDir();
    const templatePath = join(tempDir, ".env.example");
    const envPath = join(tempDir, ".env");
    writeFileSync(templatePath, "AUTHZED_ENABLED=true\n");

    const result = spawnSync("bash", [setupDevEnvScriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        FORMBRICKS_DEV_AUTHZED_MODE: "disabled",
        FORMBRICKS_ENV_PATH: envPath,
        FORMBRICKS_ENV_TEMPLATE_PATH: templatePath,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("FORMBRICKS_DEV_AUTHZED_MODE must be either bundled or external");
  });
});
