import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ORIGINAL_ENV = process.env;

const setTestEnv = (overrides: Record<string, string | undefined> = {}) => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
    DATABASE_URL: "https://example.com/db",
    ENCRYPTION_KEY: "12345678901234567890123456789012",
    HUB_API_URL: "https://hub.formbricks.local",
    CUBEJS_API_URL: "https://cube.formbricks.local",
    CUBEJS_API_SECRET: "cube-secret",
    ...overrides,
  };
};

describe("cube-config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllEnvs();
  });

  test("normalizes the Cube API URL and signs a JWT from CUBEJS_API_SECRET", async () => {
    setTestEnv();

    const { getCubeApiConfig } = await import("./cube-config");

    const config = getCubeApiConfig();

    expect(config.apiUrl).toBe("https://cube.formbricks.local/cubejs-api/v1");
    expect(jwt.verify(config.token, "cube-secret")).toEqual({
      iat: expect.any(Number),
    });
  });

  test("preserves a full Cube API URL when it already contains /cubejs-api/v1", async () => {
    setTestEnv({
      CUBEJS_API_URL: "https://cube.formbricks.local/cubejs-api/v1",
    });

    const { getCubeApiConfig } = await import("./cube-config");

    expect(getCubeApiConfig().apiUrl).toBe("https://cube.formbricks.local/cubejs-api/v1");
  });

  test("throws a configuration error when CUBEJS_API_URL is missing", async () => {
    setTestEnv({
      CUBEJS_API_URL: undefined,
    });

    const { CUBE_CONFIGURATION_ERROR_MESSAGE, getCubeApiConfig } = await import("./cube-config");

    expect(() => getCubeApiConfig()).toThrow(CUBE_CONFIGURATION_ERROR_MESSAGE);
  });

  test("throws a configuration error when CUBEJS_API_SECRET is missing", async () => {
    setTestEnv({
      CUBEJS_API_SECRET: undefined,
    });

    const { CUBE_CONFIGURATION_ERROR_MESSAGE, getCubeApiConfig } = await import("./cube-config");

    expect(() => getCubeApiConfig()).toThrow(CUBE_CONFIGURATION_ERROR_MESSAGE);
  });
});
