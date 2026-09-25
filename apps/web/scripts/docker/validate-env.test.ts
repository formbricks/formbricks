import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));
const tsxExecutable = fileURLToPath(new URL("../../../../node_modules/.bin/tsx", import.meta.url));

const validate = (overrides: Record<string, string | undefined> = {}, args = ["--server"]) =>
  spawnSync(tsxExecutable, ["scripts/docker/validate-env.ts", ...args], {
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
      BETTER_AUTH_SECRET: "test-placeholder-auth-secret-32ch",
      ...overrides,
    },
  });

describe("container environment preflight", () => {
  test("allows migration-only validation without AuthZed credentials", () => {
    const result = validate({}, []);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("Environment variables validated successfully\n");
    expect(result.stderr).toBe("");
  });

  test("still rejects malformed migration environment without leaking values", () => {
    const result = validate({ AI_PROVIDER: "private-invalid-provider" }, []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("AI_PROVIDER");
    expect(result.stdout + result.stderr).not.toContain("private-invalid-provider");
  });

  test("fails before reporting success when all AuthZed variables are absent", () => {
    const result = validate();
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("validated successfully");
    expect(result.stderr).toContain("Formbricks v6 requires AUTHZED_ENABLED=true");
    expect(result.stderr).toContain("AUTHZED_ENDPOINT is required");
    expect(result.stderr).toContain("AUTHZED_TOKEN is required");
  });

  test("fails before reporting success when no auth secret is set", () => {
    // The container entrypoint (scripts/docker/next-start.sh) runs this before migrations and before
    // the server, so a fresh install that set neither BETTER_AUTH_SECRET nor the legacy NEXTAUTH_SECRET
    // stops here rather than signing in and then failing to mint invites and verification links.
    const result = validate({
      AUTHZED_ENABLED: "true",
      AUTHZED_ENDPOINT: "127.0.0.1:1",
      AUTHZED_TOKEN: "private-test-token",
      AUTHZED_SYSTEM_KEY: "formbricks",
      AUTHZED_CONSISTENCY: "fully_consistent",
      BETTER_AUTH_SECRET: undefined,
    });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("validated successfully");
    expect(result.stderr).toContain("BETTER_AUTH_SECRET is required");
    // Names the legacy alias, which an existing instance may be relying on.
    expect(result.stderr).toContain("NEXTAUTH_SECRET");
  });

  test("accepts the legacy NEXTAUTH_SECRET alias in place of BETTER_AUTH_SECRET", () => {
    const result = validate({
      AUTHZED_ENABLED: "true",
      AUTHZED_ENDPOINT: "127.0.0.1:1",
      AUTHZED_TOKEN: "private-test-token",
      AUTHZED_SYSTEM_KEY: "formbricks",
      AUTHZED_CONSISTENCY: "fully_consistent",
      BETTER_AUTH_SECRET: undefined,
      NEXTAUTH_SECRET: "test-placeholder-legacy-secret-32",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("validated successfully");
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
