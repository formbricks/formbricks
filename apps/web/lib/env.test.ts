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
    BETTER_AUTH_SECRET: undefined,
    NEXTAUTH_SECRET: undefined,
    AUTHZED_CONSISTENCY: undefined,
    AUTHZED_ENABLED: undefined,
    AUTHZED_ENDPOINT: undefined,
    AUTHZED_INSECURE: undefined,
    AUTHZED_SYSTEM_KEY: undefined,
    AUTHZED_TOKEN: undefined,
    MCP_OAUTH_JWKS_URL: undefined,
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

  test("uses the default invite rate limit when env var is not set", async () => {
    setTestEnv({
      INVITE_RATE_LIMIT_PER_24_HOURS: undefined,
    });

    const { env } = await import("./env");

    expect(env.INVITE_RATE_LIMIT_PER_24_HOURS).toBe(50);
  });

  test("uses the configured invite rate limit", async () => {
    setTestEnv({
      INVITE_RATE_LIMIT_PER_24_HOURS: "250",
    });

    const { env } = await import("./env");

    expect(env.INVITE_RATE_LIMIT_PER_24_HOURS).toBe(250);
  });

  test.each(["0", "1.5", "invalid"])("rejects invalid invite rate limit %s", async (limit) => {
    setTestEnv({
      INVITE_RATE_LIMIT_PER_24_HOURS: limit,
    });

    await expect(import("./env")).rejects.toThrow("INVITE_RATE_LIMIT_PER_24_HOURS");
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

  test.each(["http://formbricks:3000/api/auth/jwks", "https://auth.example.com/internal/jwks?version=1"])(
    "accepts MCP OAuth JWKS URL %s",
    async (jwksUrl) => {
      setTestEnv({ MCP_OAUTH_JWKS_URL: jwksUrl });

      const { env } = await import("./env");

      expect(env.MCP_OAUTH_JWKS_URL).toBe(jwksUrl);
    }
  );

  test.each([
    "ftp://formbricks/api/auth/jwks",
    "http://user:password@formbricks:3000/api/auth/jwks",
    "http://formbricks:3000/api/auth/jwks#key",
  ])("rejects unsafe MCP OAuth JWKS URL %s", async (jwksUrl) => {
    setTestEnv({ MCP_OAUTH_JWKS_URL: jwksUrl });

    await expect(import("./env")).rejects.toThrow("MCP_OAUTH_JWKS_URL");
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

  test("parses disabled AuthZed without credentials for builds and diagnostic commands", async () => {
    setTestEnv();

    const { env } = await import("./env");

    expect(env.AUTHZED_ENABLED).toBeUndefined();
    expect(env.AUTHZED_ENDPOINT).toBeUndefined();
    expect(env.AUTHZED_TOKEN).toBeUndefined();
    expect(env.AUTHZED_SYSTEM_KEY).toBeUndefined();
  });

  test.each([undefined, "false", "0"])(
    "refuses server startup when AuthZed enablement is %s",
    async (enabled) => {
      setTestEnv({ AUTHZED_ENABLED: enabled });
      const { assertAuthzedRuntimeConfiguration } = await import("./env");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(assertAuthzedRuntimeConfiguration).toThrow("Formbricks v6 requires AUTHZED_ENABLED=true");
        expect(log.mock.calls[0][0]).toContain("AUTHZED_ENDPOINT");
        expect(log.mock.calls[0][0]).toContain("AUTHZED_TOKEN");
        expect(log.mock.calls[0][0]).toContain("AUTHZED_SYSTEM_KEY");
        expect(log.mock.calls[0][0]).toContain("AUTHZED_CONSISTENCY");
      } finally {
        log.mockRestore();
      }
    }
  );

  test.each([undefined, "minimize_latency"])(
    "requires fully consistent server configuration, not %s",
    async (consistency) => {
      const token = "private-runtime-token";
      setTestEnv({
        AUTHZED_ENABLED: "true",
        AUTHZED_ENDPOINT: "localhost:50051",
        AUTHZED_SYSTEM_KEY: "formbricks",
        AUTHZED_TOKEN: token,
        AUTHZED_CONSISTENCY: consistency,
      });
      const { assertAuthzedRuntimeConfiguration } = await import("./env");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(assertAuthzedRuntimeConfiguration).toThrow("AUTHZED_CONSISTENCY=fully_consistent");
        expect(JSON.stringify(log.mock.calls)).not.toContain(token);
      } finally {
        log.mockRestore();
      }
    }
  );

  test.each(["true", "1"])(
    "accepts complete server configuration with enablement %s without connecting",
    async (enabled) => {
      setTestEnv({
        AUTHZED_ENABLED: enabled,
        AUTHZED_ENDPOINT: "127.0.0.1:1",
        AUTHZED_SYSTEM_KEY: "formbricks",
        AUTHZED_TOKEN: "test-authzed-token",
        AUTHZED_CONSISTENCY: "fully_consistent",
      });
      const { assertAuthzedRuntimeConfiguration, env } = await import("./env");
      expect(assertAuthzedRuntimeConfiguration).not.toThrow();
      expect(env.AUTHZED_INSECURE).toBeUndefined();
    }
  );

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

  test("fails to load when the AI provider is invalid", async () => {
    setTestEnv({
      AI_PROVIDER: "unsupported-provider",
    });

    await expect(import("./env")).rejects.toThrow("AI_PROVIDER");
  });

  test("fails to load when an AI provider is set without a model", async () => {
    setTestEnv({
      AI_PROVIDER: "google",
      AI_MODEL: undefined,
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: "us-central1",
    });

    await expect(import("./env")).rejects.toThrow("AI_MODEL is required when AI_PROVIDER is set");
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

  test("fails to load when the Azure base URL is invalid", async () => {
    setTestEnv({
      AI_PROVIDER: "azure",
      AI_MODEL: "gpt-4o-mini",
      AI_AZURE_API_KEY: "test-api-key",
      AI_AZURE_BASE_URL: "not-a-url",
    });

    await expect(import("./env")).rejects.toThrow("AI_AZURE_BASE_URL");
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
      SURVEY_SCHEDULING_LOCAL_HOUR: undefined,
      SURVEY_SCHEDULING_LOCAL_MINUTE: undefined,
      SURVEY_SCHEDULING_TIME_ZONE: undefined,
    });

    const { env } = await import("./env");

    expect(env.SURVEY_SCHEDULING_TIME_ZONE).toBe("Europe/Berlin");
    expect(env.SURVEY_SCHEDULING_LOCAL_HOUR).toBe(0);
    expect(env.SURVEY_SCHEDULING_LOCAL_MINUTE).toBe(0);
  });

  test("uses the configured survey scheduling configuration", async () => {
    setTestEnv({
      SURVEY_SCHEDULING_LOCAL_HOUR: "18",
      SURVEY_SCHEDULING_LOCAL_MINUTE: "45",
      SURVEY_SCHEDULING_TIME_ZONE: "America/New_York",
    });

    const { env } = await import("./env");

    expect(env.SURVEY_SCHEDULING_TIME_ZONE).toBe("America/New_York");
    expect(env.SURVEY_SCHEDULING_LOCAL_HOUR).toBe(18);
    expect(env.SURVEY_SCHEDULING_LOCAL_MINUTE).toBe(45);
  });

  test("fails to load when the survey scheduling timezone is invalid", async () => {
    setTestEnv({
      SURVEY_SCHEDULING_TIME_ZONE: "Mars/OlympusMons",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the survey scheduling hour is out of range", async () => {
    setTestEnv({
      SURVEY_SCHEDULING_LOCAL_HOUR: "24",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when the survey scheduling minute is out of range", async () => {
    setTestEnv({
      SURVEY_SCHEDULING_LOCAL_MINUTE: "60",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  test("fails to load when DEBUG_SHOW_RESET_LINK is invalid", async () => {
    setTestEnv({
      DEBUG_SHOW_RESET_LINK: "true",
    });

    await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  });

  describe("auth secret", () => {
    const BETTER_AUTH_SECRET = "better-auth-secret-at-least-32-chars!";
    const NEXTAUTH_SECRET = "nextauth-secret-at-least-32-characters";

    test.each([
      ["BETTER_AUTH_SECRET only", { BETTER_AUTH_SECRET }],
      ["NEXTAUTH_SECRET only", { NEXTAUTH_SECRET }],
      ["both", { BETTER_AUTH_SECRET, NEXTAUTH_SECRET }],
    ])("starts the server with %s set", async (_label, overrides) => {
      setTestEnv(overrides);
      const { assertAuthRuntimeConfiguration } = await import("./env");

      expect(assertAuthRuntimeConfiguration).not.toThrow();
    });

    test("refuses server startup when neither secret is set", async () => {
      setTestEnv();
      const { assertAuthRuntimeConfiguration } = await import("./env");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(assertAuthRuntimeConfiguration).toThrow("BETTER_AUTH_SECRET is required");
        // Names the legacy alias too: it is undocumented, but an operator hitting this has to know
        // their existing NEXTAUTH_SECRET would satisfy it.
        expect(log.mock.calls[0][0]).toContain("NEXTAUTH_SECRET");
      } finally {
        log.mockRestore();
      }
    });

    test.each(["", "   "])(
      "treats a blank secret as unset rather than as a secret of length zero (%j)",
      async (blank) => {
        // A blank value is falsy, and Better Auth replaces a falsy secret with its own hardcoded
        // default — so it must normalize to undefined and fall through, not reach `betterAuth()`.
        setTestEnv({ BETTER_AUTH_SECRET: blank, NEXTAUTH_SECRET });
        const { env } = await import("./env");

        expect(env.BETTER_AUTH_SECRET).toBeUndefined();
        expect(env.NEXTAUTH_SECRET).toBe(NEXTAUTH_SECRET);
      }
    );

    test("refuses server startup when the only secret set is blank", async () => {
      setTestEnv({ BETTER_AUTH_SECRET: "" });
      const { assertAuthRuntimeConfiguration } = await import("./env");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(assertAuthRuntimeConfiguration).toThrow("BETTER_AUTH_SECRET is required");
      } finally {
        log.mockRestore();
      }
    });

    test.each([
      ["a trailing newline", "legacy-secret-value\n"],
      ["a trailing space", "legacy-secret-value "],
      ["a leading space", " legacy-secret-value"],
    ])("keeps a secret carrying %s byte-for-byte", async (_label, secret) => {
      // `.trim()` is a zod TRANSFORM, so trimming here would silently re-key the instance: a value
      // stored by `kubectl create secret --from-file` carries a trailing newline, the chart round-trips
      // it through b64dec, and the instance has been signing with it. Rewriting it on upgrade
      // invalidates every session and every outstanding invite and verification link.
      setTestEnv({ BETTER_AUTH_SECRET: secret });
      const { env } = await import("./env");

      expect(env.BETTER_AUTH_SECRET).toBe(secret);
    });

    test("parses a short secret — the floor is a runtime gate, not a schema rule", async () => {
      // Kept out of the schema so `next build` and CLI imports still work with no secrets in scope.
      setTestEnv({ BETTER_AUTH_SECRET: "short-secret" });
      const { env } = await import("./env");

      expect(env.BETTER_AUTH_SECRET).toBe("short-secret");
    });

    describe("length floor", () => {
      const SHORT = "short-secret";

      test("refuses a short secret on a fresh install (BETTER_AUTH_SECRET alone)", async () => {
        // No migration constraint to protect here, and Better Auth's own sub-32 check is only a warning,
        // so this is the last hard guard before those characters become the HMAC key for everything.
        setTestEnv({ BETTER_AUTH_SECRET: SHORT });
        const { assertAuthRuntimeConfiguration } = await import("./env");
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          expect(assertAuthRuntimeConfiguration).toThrow("must be at least 32 characters");
          // Points at the escape hatch rather than just refusing.
          expect(log.mock.calls[0][0]).toContain("NEXTAUTH_SECRET");
        } finally {
          log.mockRestore();
        }
      });

      test("accepts a short secret mid-rename (NEXTAUTH_SECRET also set)", async () => {
        // The shape this ticket exists to support: the legacy value copied onto the new name. Forcing a
        // change here would sign everyone out and void outstanding invite and verification links.
        setTestEnv({ BETTER_AUTH_SECRET: SHORT, NEXTAUTH_SECRET: SHORT });
        const { assertAuthRuntimeConfiguration } = await import("./env");

        expect(assertAuthRuntimeConfiguration).not.toThrow();
      });

      test("accepts a short legacy-only secret, which boots today with no floor", async () => {
        setTestEnv({ NEXTAUTH_SECRET: SHORT });
        const { assertAuthRuntimeConfiguration } = await import("./env");

        expect(assertAuthRuntimeConfiguration).not.toThrow();
      });

      test("accepts a 32-character secret on a fresh install", async () => {
        setTestEnv({ BETTER_AUTH_SECRET: "a".repeat(32) });
        const { assertAuthRuntimeConfiguration } = await import("./env");

        expect(assertAuthRuntimeConfiguration).not.toThrow();
      });
    });

    describe("warnOnAuthSecretRisks", () => {
      const loadAndWarn = async () => {
        const { warnOnAuthSecretRisks } = await import("./env");
        const { logger } = await import("@formbricks/logger");
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
        try {
          warnOnAuthSecretRisks();
          return warn.mock.calls.map((call) => String(call[0]));
        } finally {
          warn.mockRestore();
        }
      };

      test("warns when the two secrets differ only in trailing whitespace", async () => {
        // They are different secrets, and this is the pair most likely to have been created by accident.
        setTestEnv({ BETTER_AUTH_SECRET: `${NEXTAUTH_SECRET}\n`, NEXTAUTH_SECRET });

        const warnings = await loadAndWarn();

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("both set to different values");
      });

      test("warns when both secrets are set to different values", async () => {
        setTestEnv({ BETTER_AUTH_SECRET, NEXTAUTH_SECRET });

        const warnings = await loadAndWarn();

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("both set to different values");
        // Never the values themselves: these go to pino and on to SigNoz.
        expect(warnings[0]).not.toContain(BETTER_AUTH_SECRET);
        expect(warnings[0]).not.toContain(NEXTAUTH_SECRET);
      });

      test("stays silent when both secrets hold the same value", async () => {
        // The correct way to migrate: copy the value across rather than mint a new one.
        setTestEnv({ BETTER_AUTH_SECRET: NEXTAUTH_SECRET, NEXTAUTH_SECRET });

        expect(await loadAndWarn()).toStrictEqual([]);
      });

      test("warns when the resolved secret is shorter than 32 characters", async () => {
        setTestEnv({ NEXTAUTH_SECRET: "short-secret" });

        const warnings = await loadAndWarn();

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("shorter than the recommended 32 characters");
        expect(warnings[0]).not.toContain("short-secret");
      });

      test("stays silent on a single secret of adequate length", async () => {
        setTestEnv({ BETTER_AUTH_SECRET });

        expect(await loadAndWarn()).toStrictEqual([]);
      });
    });
  });
});
