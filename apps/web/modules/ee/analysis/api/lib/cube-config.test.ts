import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockCubeEnv = (overrides: { CUBEJS_API_URL?: string; CUBEJS_API_SECRET?: string } = {}) => {
  vi.doMock("@/lib/env", () => ({
    env: {
      CUBEJS_API_URL: "https://cube.formbricks.local",
      CUBEJS_API_SECRET: "cube-secret",
      ...overrides,
    },
  }));
};

describe("cube-config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("normalizes the Cube API URL and signs a JWT from CUBEJS_API_SECRET", async () => {
    mockCubeEnv();

    const { getCubeApiConfig } = await import("./cube-config");

    const config = getCubeApiConfig();

    expect(config.apiUrl).toBe("https://cube.formbricks.local/cubejs-api/v1");
    expect(config.tokenExpiresAtMs).toBeGreaterThan(Date.now());
    expect(jwt.verify(config.token, "cube-secret")).toEqual({
      exp: expect.any(Number),
      iat: expect.any(Number),
    });
  });

  test("preserves a full Cube API URL when it already contains /cubejs-api/v1", async () => {
    mockCubeEnv({
      CUBEJS_API_URL: "https://cube.formbricks.local/cubejs-api/v1",
    });

    const { getCubeApiConfig } = await import("./cube-config");

    expect(getCubeApiConfig().apiUrl).toBe("https://cube.formbricks.local/cubejs-api/v1");
  });

  test("throws a configuration error when CUBEJS_API_URL is missing", async () => {
    mockCubeEnv({
      CUBEJS_API_URL: undefined,
    });

    const { CUBE_CONFIGURATION_ERROR_MESSAGE, getCubeApiConfig } = await import("./cube-config");

    expect(() => getCubeApiConfig()).toThrow(CUBE_CONFIGURATION_ERROR_MESSAGE);
  });

  test("throws a configuration error when CUBEJS_API_SECRET is missing", async () => {
    mockCubeEnv({
      CUBEJS_API_SECRET: undefined,
    });

    const { CUBE_CONFIGURATION_ERROR_MESSAGE, getCubeApiConfig } = await import("./cube-config");

    expect(() => getCubeApiConfig()).toThrow(CUBE_CONFIGURATION_ERROR_MESSAGE);
  });
});
