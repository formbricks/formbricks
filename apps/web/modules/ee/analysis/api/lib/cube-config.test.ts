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
    CUBEJS_JWT_AUDIENCE: "formbricks-cube-test",
    CUBEJS_JWT_ISSUER: "formbricks-web-test",
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

  test("normalizes the Cube API URL and signs a tenant-scoped JWT", async () => {
    setTestEnv();

    const { CUBE_API_TOKEN_TTL_SECONDS, CUBE_QUERY_SCOPE, getCubeApiConfig } = await import("./cube-config");
    const config = getCubeApiConfig({
      feedbackDirectoryId: "frd-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      userId: "user-1",
      source: "charts.executeQueryAction",
    });

    const payload = jwt.verify(config.token, "cube-secret", {
      audience: "formbricks-cube-test",
      issuer: "formbricks-web-test",
    }) as jwt.JwtPayload;

    expect(config.apiUrl).toBe("https://cube.formbricks.local/cubejs-api/v1");
    expect(payload).toMatchObject({
      aud: "formbricks-cube-test",
      iss: "formbricks-web-test",
      tenantId: "frd-1",
      feedbackDirectoryId: "frd-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      userId: "user-1",
      scope: CUBE_QUERY_SCOPE,
      source: "charts.executeQueryAction",
      jti: config.requestId,
    });
    expect(payload.exp! - payload.iat!).toBe(CUBE_API_TOKEN_TTL_SECONDS);
  });

  test("uses feedbackDirectoryId as the Cube tenant ID without accepting a tenantId input", async () => {
    setTestEnv();

    const { getCubeApiConfig } = await import("./cube-config");
    const config = getCubeApiConfig({
      tenantId: "malicious-tenant",
      feedbackDirectoryId: "frd-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      userId: "user-1",
      source: "charts.executeQueryAction",
    } as unknown as Parameters<typeof getCubeApiConfig>[0]);

    const payload = jwt.verify(config.token, "cube-secret", {
      audience: "formbricks-cube-test",
      issuer: "formbricks-web-test",
    }) as jwt.JwtPayload;

    expect(payload.tenantId).toBe("frd-1");
    expect(payload.feedbackDirectoryId).toBe("frd-1");
    expect(payload.workspaceId).toBe("workspace-1");
  });

  test("preserves a full Cube API URL when it already contains /cubejs-api/v1", async () => {
    setTestEnv({
      CUBEJS_API_URL: "https://cube.formbricks.local/cubejs-api/v1/",
    });

    const { getCubeApiCredentials } = await import("./cube-config");

    expect(getCubeApiCredentials().apiUrl).toBe("https://cube.formbricks.local/cubejs-api/v1");
  });

  test("throws a configuration error when CUBEJS_API_URL is missing", async () => {
    setTestEnv({
      CUBEJS_API_URL: undefined,
    });

    const { CUBE_CONFIGURATION_ERROR_MESSAGE, getCubeApiCredentials } = await import("./cube-config");

    expect(() => getCubeApiCredentials()).toThrow(CUBE_CONFIGURATION_ERROR_MESSAGE);
  });

  test("throws a configuration error when CUBEJS_API_SECRET is missing", async () => {
    setTestEnv({
      CUBEJS_API_SECRET: undefined,
    });

    const { CUBE_CONFIGURATION_ERROR_MESSAGE, getCubeApiCredentials } = await import("./cube-config");

    expect(() => getCubeApiCredentials()).toThrow(CUBE_CONFIGURATION_ERROR_MESSAGE);
  });
});
