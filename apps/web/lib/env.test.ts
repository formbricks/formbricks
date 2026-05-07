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
