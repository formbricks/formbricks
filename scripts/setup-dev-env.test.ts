import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
  test("generates and preserves AuthZed secrets", () => {
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

    expect(firstEnv.get("AUTHZED_ENABLED")).toBe("true");
    expect(firstEnv.get("AUTHZED_ENDPOINT")).toBe("localhost:50051");
    expect(firstEnv.get("AUTHZED_CONSISTENCY")).toBe("fully_consistent");
    expect(statSync(envPath).mode & 0o777).toBe(0o600);

    expect(firstEnv.get("AUTHZED_TOKEN")).toMatch(/^[a-f0-9]{64}$/);
    expect(firstEnv.get("AUTHZED_DATABASE_PASSWORD")).toMatch(/^[a-f0-9]{64}$/);

    execFileSync("bash", [setupDevEnvScriptPath], { env: commandEnv });
    const secondEnv = parseEnvFile(readFileSync(envPath, "utf8"));

    expect(secondEnv.get("AUTHZED_TOKEN")).toBe(firstEnv.get("AUTHZED_TOKEN"));
    expect(secondEnv.get("AUTHZED_DATABASE_PASSWORD")).toBe(firstEnv.get("AUTHZED_DATABASE_PASSWORD"));
  });

  test.each(["AUTHZED_ENABLED=false", "AUTHZED_CONSISTENCY=minimize_latency"])(
    "explains incompatible existing configuration without changing it: %s",
    (configuration) => {
      const directory = createTempDir();
      const template = join(directory, "template");
      const envPath = join(directory, ".env");
      writeFileSync(template, "");
      writeFileSync(envPath, `${configuration}\nAUTHZED_TOKEN=private-token\n`);
      expect(() =>
        execFileSync("bash", [setupDevEnvScriptPath], {
          env: { ...process.env, FORMBRICKS_ENV_PATH: envPath, FORMBRICKS_ENV_TEMPLATE_PATH: template },
          stdio: "pipe",
        })
      ).toThrow(/v6 requires AUTHZED_/);
      expect(readFileSync(envPath, "utf8")).toContain(configuration);
    }
  );

  test("preserves external credentials and defaults a custom endpoint to TLS", () => {
    const directory = createTempDir();
    const template = join(directory, "template");
    const envPath = join(directory, ".env");
    writeFileSync(template, "");
    writeFileSync(
      envPath,
      "AUTHZED_ENDPOINT=grpc.example.com:443\nAUTHZED_TOKEN=private-token\nAUTHZED_SYSTEM_KEY=custom_key\n"
    );
    const output = execFileSync("bash", [setupDevEnvScriptPath], {
      env: { ...process.env, FORMBRICKS_ENV_PATH: envPath, FORMBRICKS_ENV_TEMPLATE_PATH: template },
      encoding: "utf8",
    });
    const values = parseEnvFile(readFileSync(envPath, "utf8"));
    expect(values.get("AUTHZED_ENDPOINT")).toBe("grpc.example.com:443");
    expect(values.get("AUTHZED_TOKEN")).toBe("private-token");
    expect(values.get("AUTHZED_SYSTEM_KEY")).toBe("custom_key");
    expect(values.get("AUTHZED_INSECURE")).toBe("false");
    expect(output).not.toContain("private-token");
  });
});
