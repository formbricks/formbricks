import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = process.env;

const setTestEnv = (overrides: Record<string, string | undefined> = {}) => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
    DATABASE_URL: "https://example.com/db",
    ENCRYPTION_KEY: "12345678901234567890123456789012",
    HUB_API_URL: "https://hub.formbricks.local",
    HUB_API_KEY: "test-hub-api-key",
    CUBEJS_API_URL: "https://cube.formbricks.local",
    CUBEJS_API_SECRET: "cube-secret",
    AUTHZED_CONSISTENCY: undefined,
    AUTHZED_ENABLED: undefined,
    AUTHZED_ENDPOINT: undefined,
    AUTHZED_INSECURE: undefined,
    AUTHZED_SYSTEM_KEY: undefined,
    AUTHZED_TOKEN: undefined,
    ...overrides,
  };
};

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test("allows ambient DEBUG values from external tooling", async () => {
    setTestEnv({
      DEBUG: "pnpm:*",
    });

    const { env } = await import("./env");

    expect(env.DEBUG).toBe("pnpm:*");
  });

  test("uses the default password reset token lifetime when env var is not set", async () => {
    setTestEnv({
      PASSWORD_RESET_TOKEN_LIFETIME_MINUTES: undefined,
    });

    const { env } = await import("./env");
    expect(env.PASSWORD_RESET_TOKEN_LIFETIME_MINUTES).toBe(30);
  });

  test("uses the configured password reset token lifetime", async () => {
    setTestEnv({
      PASSWORD_RESET_TOKEN_LIFETIME_MINUTES: "45",
    });

    const { env } = await import("./env");

    expect(env.PASSWORD_RESET_TOKEN_LIFETIME_MINUTES).toBe(45);
  });

  test("includes the failing field name and validation message in thrown errors", async () => {
    setTestEnv({
      ENCRYPTION_KEY: undefined,
    });

    await expect(import("./env")).rejects.toThrow(/ENCRYPTION_KEY[\s\S]*expected string/);
  });

  test("fails to load when the password reset token lifetime is not an integer", async () => {
    setTestEnv({
      PASSWORD_RESET_TOKEN_LIFETIME_MINUTES: "30minutes",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the password reset token lifetime is out of range", async () => {
    setTestEnv({
      PASSWORD_RESET_TOKEN_LIFETIME_MINUTES: "121",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("allows enabling DEBUG_SHOW_RESET_LINK", async () => {
    setTestEnv({
      DEBUG_SHOW_RESET_LINK: "1",
    });

    const { env } = await import("./env");

    expect(env.DEBUG_SHOW_RESET_LINK).toBe("1");
  });

  test.each(["true", "1"])("accepts enabled AuthZed boolean value %s", async (enabled) => {
    setTestEnv({
      AUTHZED_CONSISTENCY: "minimize_latency",
      AUTHZED_ENABLED: enabled,
      AUTHZED_ENDPOINT: "localhost:50051",
      AUTHZED_INSECURE: enabled,
      AUTHZED_SYSTEM_KEY: "formbricks",
      AUTHZED_TOKEN: "test-authzed-token",
    });

    const { env } = await import("./env");

    expect(env.AUTHZED_ENABLED).toBe(enabled);
    expect(env.AUTHZED_INSECURE).toBe(enabled);
    expect(env.AUTHZED_TOKEN).toBe("test-authzed-token");
  });

  test.each(["false", "0"])("accepts disabled AuthZed boolean value %s", async (enabled) => {
    setTestEnv({
      AUTHZED_ENABLED: enabled,
      AUTHZED_INSECURE: enabled,
    });

    const { env } = await import("./env");

    expect(env.AUTHZED_ENABLED).toBe(enabled);
    expect(env.AUTHZED_INSECURE).toBe(enabled);
  });

  test("allows AuthZed to be disabled without credentials", async () => {
    setTestEnv();

    const { env } = await import("./env");

    expect(env.AUTHZED_ENABLED).toBeUndefined();
    expect(env.AUTHZED_ENDPOINT).toBeUndefined();
    expect(env.AUTHZED_TOKEN).toBeUndefined();
    expect(env.AUTHZED_SYSTEM_KEY).toBeUndefined();
  });

  test("allows valid AuthZed credentials to be prepared while disabled", async () => {
    setTestEnv({
      AUTHZED_ENABLED: "false",
      AUTHZED_ENDPOINT: "spicedb:50051",
      AUTHZED_SYSTEM_KEY: "formbricks",
      AUTHZED_TOKEN: "prepared-token",
    });

    const { env } = await import("./env");

    expect(env.AUTHZED_ENDPOINT).toBe("spicedb:50051");
    expect(env.AUTHZED_SYSTEM_KEY).toBe("formbricks");
    expect(env.AUTHZED_TOKEN).toBe("prepared-token");
  });

  test.each([
    ["AUTHZED_ENDPOINT", " "],
    ["AUTHZED_TOKEN", " "],
    ["AUTHZED_SYSTEM_KEY", ""],
    ["AUTHZED_CONSISTENCY", ""],
  ])("rejects invalid supplied %s while AuthZed is disabled", async (variable, value) => {
    setTestEnv({ [variable]: value });

    await expect(import("./env")).rejects.toThrow(variable);
  });

  test.each(["AUTHZED_ENDPOINT", "AUTHZED_TOKEN", "AUTHZED_SYSTEM_KEY"])(
    "requires %s when AuthZed is enabled",
    async (missingVariable) => {
      const authzedEnv: Record<string, string | undefined> = {
        AUTHZED_ENABLED: "true",
        AUTHZED_ENDPOINT: "spicedb:50051",
        AUTHZED_SYSTEM_KEY: "formbricks",
        AUTHZED_TOKEN: "test-authzed-token",
      };
      authzedEnv[missingVariable] = undefined;
      setTestEnv(authzedEnv);

      await expect(import("./env")).rejects.toThrow(missingVariable);
    }
  );

  test.each([
    "localhost:50051",
    "spicedb:50051",
    "spicedb.authzed.svc.cluster.local:50051",
    "grpc.authzed.com:443",
    "127.0.0.1:1",
    "10.20.30.40:65535",
    "example.com:80",
    "[::1]:50051",
    "[2001:db8::1]:443",
  ])("accepts valid AuthZed endpoint %s", async (endpoint) => {
    setTestEnv({ AUTHZED_ENDPOINT: endpoint });

    const { env } = await import("./env");

    expect(env.AUTHZED_ENDPOINT).toBe(endpoint);
  });

  test.each([
    "http://localhost:50051",
    "https://grpc.authzed.com:443",
    "spicedb",
    "spicedb:0",
    "spicedb:65536",
    "spicedb:abc",
    "spicedb:50051/path",
    "spicedb:50051?query=true",
    "spicedb:50051#fragment",
    "user@spicedb:50051",
    " spicedb:50051",
    "spicedb:50051 ",
    "::1:50051",
  ])("rejects invalid AuthZed endpoint %s", async (endpoint) => {
    setTestEnv({ AUTHZED_ENDPOINT: endpoint });

    await expect(import("./env")).rejects.toThrow("AUTHZED_ENDPOINT");
  });

  test.each(["minimize_latency", "fully_consistent"])(
    "accepts AuthZed consistency value %s",
    async (consistency) => {
      setTestEnv({ AUTHZED_CONSISTENCY: consistency });

      const { env } = await import("./env");

      expect(env.AUTHZED_CONSISTENCY).toBe(consistency);
    }
  );

  test("rejects an unsupported AuthZed consistency value", async () => {
    setTestEnv({ AUTHZED_CONSISTENCY: "at_least_as_fresh" });

    await expect(import("./env")).rejects.toThrow("AUTHZED_CONSISTENCY");
  });

  test.each(["abc", "_a1", `a${"b".repeat(62)}1`])(
    "accepts valid AuthZed system key %s",
    async (systemKey) => {
      setTestEnv({ AUTHZED_SYSTEM_KEY: systemKey });

      const { env } = await import("./env");

      expect(env.AUTHZED_SYSTEM_KEY).toBe(systemKey);
    }
  );

  test.each([
    "ab",
    `a${"b".repeat(63)}1`,
    "Formbricks",
    "form-bricks",
    "form/bricks",
    "form bricks",
    "formbricks_",
    "1formbricks",
    " formbricks",
    "formbricks ",
  ])("rejects invalid AuthZed system key %s", async (systemKey) => {
    setTestEnv({ AUTHZED_SYSTEM_KEY: systemKey });

    await expect(import("./env")).rejects.toThrow("AUTHZED_SYSTEM_KEY");
  });

  test("does not expose the AuthZed token in validation errors", async () => {
    const token = "never-log-this-authzed-token";
    setTestEnv({
      AUTHZED_ENABLED: "true",
      AUTHZED_ENDPOINT: "https://invalid.example.com:443",
      AUTHZED_SYSTEM_KEY: "formbricks",
      AUTHZED_TOKEN: token,
    });

    const error = await import("./env").catch((caughtError: unknown) => caughtError);

    expect(String(error)).toContain("AUTHZED_ENDPOINT");
    expect(String(error)).not.toContain(token);
  });

  test("rejects unsupported AuthZed boolean values", async () => {
    setTestEnv({
      AUTHZED_ENABLED: "yes",
    });

    await expect(import("./env")).rejects.toThrow("AUTHZED_ENABLED");
  });

  test("allows Google Cloud AI configuration to rely on ADC credentials", async () => {
    setTestEnv({
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: "us-central1",
      AI_GOOGLE_CLOUD_CREDENTIALS_JSON: undefined,
      AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS: undefined,
    });

    const { env } = await import("./env");

    expect(env.AI_PROVIDER).toBe("google");
    expect(env.AI_GOOGLE_CLOUD_PROJECT).toBe("test-project");
    expect(env.AI_GOOGLE_CLOUD_LOCATION).toBe("us-central1");
  });

  test("fails to load when Google Cloud credentials JSON is invalid", async () => {
    setTestEnv({
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: "us-central1",
      AI_GOOGLE_CLOUD_CREDENTIALS_JSON: "{not-json}",
    });

    await expect(import("./env")).rejects.toThrow("AI_GOOGLE_CLOUD_CREDENTIALS_JSON");
  });

  test("loads OpenAI-compatible AI configuration with the base URL and model", async () => {
    setTestEnv({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
    });

    const { env } = await import("./env");

    expect(env.AI_PROVIDER).toBe("openai-compatible");
    expect(env.AI_OPENAI_COMPATIBLE_BASE_URL).toBe("http://vllm:8000/v1");
  });

  test("loads OpenAI-compatible AI configuration with string-valued headers and query params", async () => {
    setTestEnv({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
      AI_OPENAI_COMPATIBLE_HEADERS_JSON: JSON.stringify({ "X-Tenant": "acme" }),
      AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON: JSON.stringify({ "api-version": "2024-01" }),
    });

    const { env } = await import("./env");

    expect(env.AI_OPENAI_COMPATIBLE_HEADERS_JSON).toBe(JSON.stringify({ "X-Tenant": "acme" }));
    expect(env.AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON).toBe(JSON.stringify({ "api-version": "2024-01" }));
  });

  test("fails to load when the OpenAI-compatible base URL is missing", async () => {
    setTestEnv({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: undefined,
    });

    await expect(import("./env")).rejects.toThrow("AI_OPENAI_COMPATIBLE_BASE_URL");
  });

  test("fails to load when the OpenAI-compatible base URL is not a valid URL", async () => {
    setTestEnv({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "not-a-url",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the OpenAI-compatible base URL is not an HTTP URL", async () => {
    setTestEnv({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "ftp://example.com/v1",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the OpenAI-compatible headers JSON is malformed", async () => {
    setTestEnv({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
      AI_OPENAI_COMPATIBLE_HEADERS_JSON: "{not-json}",
    });

    await expect(import("./env")).rejects.toThrow("AI_OPENAI_COMPATIBLE_HEADERS_JSON");
  });

  test("fails to load when the OpenAI-compatible headers JSON has non-string values", async () => {
    setTestEnv({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
      AI_OPENAI_COMPATIBLE_HEADERS_JSON: JSON.stringify({ "X-Tenant": 1 }),
    });

    await expect(import("./env")).rejects.toThrow("AI_OPENAI_COMPATIBLE_HEADERS_JSON");
  });

  test("fails to load when the OpenAI-compatible query params JSON has non-string values", async () => {
    setTestEnv({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
      AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON: JSON.stringify({ "api-version": ["2024-01"] }),
    });

    await expect(import("./env")).rejects.toThrow("AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON");
  });

  test("uses the configured Cube environment variables", async () => {
    setTestEnv();
    const { env } = await import("./env");

    expect(env.CUBEJS_API_URL).toBe("https://cube.formbricks.local");
    expect(env.CUBEJS_API_SECRET).toBe("cube-secret");
  });

  test("accepts Cube JWT issuer and audience configuration", async () => {
    setTestEnv({
      CUBEJS_JWT_AUDIENCE: "formbricks-cube",
      CUBEJS_JWT_ISSUER: "formbricks-web",
    });

    const { env } = await import("./env");

    expect(env.CUBEJS_JWT_AUDIENCE).toBe("formbricks-cube");
    expect(env.CUBEJS_JWT_ISSUER).toBe("formbricks-web");
  });

  test("fails to load when the Cube API secret is missing", async () => {
    setTestEnv({
      CUBEJS_API_SECRET: undefined,
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the Cube API secret is empty", async () => {
    setTestEnv({
      CUBEJS_API_SECRET: "",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the Cube API URL is missing", async () => {
    setTestEnv({
      CUBEJS_API_URL: undefined,
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the Cube API URL is empty", async () => {
    setTestEnv({
      CUBEJS_API_URL: "",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the Cube API URL is invalid", async () => {
    setTestEnv({
      CUBEJS_API_URL: "not-a-url",
      CUBEJS_API_SECRET: "cube-secret",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("uses the default survey scheduling configuration when env vars are not set", async () => {
    setTestEnv({
      NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_HOUR: undefined,
      NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_MINUTE: undefined,
      NEXT_PUBLIC_SURVEY_SCHEDULING_TIME_ZONE: undefined,
    });

    const { env } = await import("./env");

    expect(env.NEXT_PUBLIC_SURVEY_SCHEDULING_TIME_ZONE).toBe("Europe/Berlin");
    expect(env.NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_HOUR).toBe(0);
    expect(env.NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_MINUTE).toBe(0);
  });

  test("uses the configured survey scheduling configuration", async () => {
    setTestEnv({
      NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_HOUR: "18",
      NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_MINUTE: "45",
      NEXT_PUBLIC_SURVEY_SCHEDULING_TIME_ZONE: "America/New_York",
    });

    const { env } = await import("./env");

    expect(env.NEXT_PUBLIC_SURVEY_SCHEDULING_TIME_ZONE).toBe("America/New_York");
    expect(env.NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_HOUR).toBe(18);
    expect(env.NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_MINUTE).toBe(45);
  });

  test("fails to load when the survey scheduling timezone is invalid", async () => {
    setTestEnv({
      NEXT_PUBLIC_SURVEY_SCHEDULING_TIME_ZONE: "Mars/OlympusMons",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the survey scheduling hour is out of range", async () => {
    setTestEnv({
      NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_HOUR: "24",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the survey scheduling minute is out of range", async () => {
    setTestEnv({
      NEXT_PUBLIC_SURVEY_SCHEDULING_LOCAL_MINUTE: "60",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when DEBUG_SHOW_RESET_LINK is invalid", async () => {
    setTestEnv({
      DEBUG_SHOW_RESET_LINK: "true",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });
});
