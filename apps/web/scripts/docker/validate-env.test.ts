import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const tsxExecutable = fileURLToPath(new URL("../../../../node_modules/.bin/tsx", import.meta.url));

const validate = (authzed: Record<string, string> = {}) =>
  spawnSync(tsxExecutable, ["scripts/docker/validate-env.ts"], {
    cwd: webRoot,
    encoding: "utf8",
    timeout: 10_000,
    // Deliberately do not inherit the developer's credentials/configuration.
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      NODE_OPTIONS: "--conditions=react-server",
      DATABASE_URL: "postgresql://test:test@127.0.0.1:1/formbricks",
      REDIS_URL: "redis://127.0.0.1:1",
      ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
      HUB_API_URL: "http://127.0.0.1:1",
      HUB_API_KEY: "test-placeholder",
      CUBEJS_API_URL: "http://127.0.0.1:1",
      CUBEJS_API_SECRET: "test-placeholder",
      ...authzed,
    },
  });

describe("container environment preflight", () => {
  test("fails before reporting success when all AuthZed variables are absent", () => {
    const result = validate();
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("validated successfully");
    expect(result.stderr).toContain("Formbricks v6 requires AUTHZED_ENABLED=true");
    expect(result.stderr).toContain("AUTHZED_ENDPOINT is required");
    expect(result.stderr).toContain("AUTHZED_TOKEN is required");
  });

  test("validates configuration with unreachable dependencies without making RPCs", () => {
    const result = validate({
      AUTHZED_ENABLED: "true",
      AUTHZED_ENDPOINT: "127.0.0.1:1",
      AUTHZED_TOKEN: "private-test-token",
      AUTHZED_SYSTEM_KEY: "formbricks",
      AUTHZED_CONSISTENCY: "fully_consistent",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("Environment variables validated successfully\n");
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain("private-test-token");
  });
});
