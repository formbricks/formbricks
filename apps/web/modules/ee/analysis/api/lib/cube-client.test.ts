import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockLoad, mockLoggerError, mockQueueAuditEventWithoutRequest, mockTablePivot } = vi.hoisted(() => ({
  mockLoad: vi.fn(),
  mockLoggerError: vi.fn(),
  mockQueueAuditEventWithoutRequest: vi.fn(),
  mockTablePivot: vi.fn(),
}));

vi.mock("@cubejs-client/core", () => ({
  default: vi.fn(() => ({
    load: mockLoad,
  })),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockLoggerError,
    warn: vi.fn(),
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventWithoutRequest: mockQueueAuditEventWithoutRequest,
}));

const scopedInput = {
  query: { measures: ["FeedbackRecords.count"] },
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  userId: "user-1",
  source: "charts.executeQueryAction" as const,
};

type TCubeJsMock = {
  mock: { calls: [string, { apiUrl: string }][] };
  (...args: [string, { apiUrl: string }]): unknown;
};

const getCubeJsMock = async (): Promise<TCubeJsMock> => {
  const cubeModule = (await vi.importMock("@cubejs-client/core")) as { default: TCubeJsMock };
  return cubeModule.default;
};

describe("executeTenantScopedQuery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/formbricks?schema=public");
    vi.stubEnv("ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubEnv("HUB_API_URL", "https://hub.formbricks.local");
    vi.stubEnv("CUBEJS_API_URL", "https://cube.example.com");
    vi.stubEnv("CUBEJS_API_SECRET", "cube-secret");
    vi.stubEnv("CUBEJS_JWT_AUDIENCE", "formbricks-cube-test");
    vi.stubEnv("CUBEJS_JWT_ISSUER", "formbricks-web-test");
    mockLoad.mockResolvedValue({ tablePivot: mockTablePivot });
    mockQueueAuditEventWithoutRequest.mockResolvedValue(undefined);
    mockTablePivot.mockReturnValue([{ id: "1", count: 42 }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("loads query with a per-request tenant scoped token and returns tablePivot result", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");
    const result = await executeTenantScopedQuery(scopedInput);

    expect(mockLoad).toHaveBeenCalledWith(scopedInput.query);
    expect(mockTablePivot).toHaveBeenCalled();
    expect(result).toEqual([{ id: "1", count: 42 }]);

    const cubejs = await getCubeJsMock();
    const token = cubejs.mock.calls[0][0] as string;
    const payload = jwt.verify(token, "cube-secret", {
      audience: "formbricks-cube-test",
      issuer: "formbricks-web-test",
    }) as jwt.JwtPayload;

    expect(cubejs).toHaveBeenCalledWith(expect.any(String), {
      apiUrl: "https://cube.example.com/cubejs-api/v1",
    });
    expect(payload).toMatchObject({
      tenantId: "workspace-1",
      workspaceId: "workspace-1",
      organizationId: "organization-1",
      userId: "user-1",
      scope: "xm:cube:query",
      source: "charts.executeQueryAction",
    });
    expect(typeof payload.jti).toBe("string");
  });

  test("does not cache tenant-bearing Cube clients or tokens", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");

    await executeTenantScopedQuery(scopedInput);
    await executeTenantScopedQuery({ ...scopedInput, workspaceId: "workspace-2" });

    const cubejs = await getCubeJsMock();
    expect(cubejs).toHaveBeenCalledTimes(2);
    expect(cubejs.mock.calls[0][0]).not.toBe(cubejs.mock.calls[1][0]);
  });

  test("rejects caller-supplied tenant filters before creating a Cube client", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");

    await expect(
      executeTenantScopedQuery({
        ...scopedInput,
        query: {
          measures: ["FeedbackRecords.count"],
          filters: [{ member: "FeedbackRecords.tenantId", operator: "equals", values: ["workspace-2"] }],
        },
      })
    ).rejects.toThrow(/Tenant filters are enforced by Cube/);

    const cubejs = await getCubeJsMock();
    expect(cubejs).not.toHaveBeenCalled();
  });

  test("preserves API URL when it already contains /cubejs-api/v1", async () => {
    const fullUrl = "https://cube.example.com/cubejs-api/v1";
    vi.stubEnv("CUBEJS_API_URL", fullUrl);
    const { executeTenantScopedQuery } = await import("./cube-client");

    await executeTenantScopedQuery(scopedInput);

    const cubejs = await getCubeJsMock();
    expect(cubejs).toHaveBeenCalledWith(expect.any(String), { apiUrl: fullUrl });
  });

  test("throws a configuration error when Cube env is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/formbricks?schema=public");
    vi.stubEnv("ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubEnv("HUB_API_URL", "https://hub.formbricks.local");
    const { CUBE_CONFIGURATION_ERROR_MESSAGE } = await import("./cube-config");
    const { executeTenantScopedQuery } = await import("./cube-client");

    await expect(executeTenantScopedQuery(scopedInput)).rejects.toThrow(CUBE_CONFIGURATION_ERROR_MESSAGE);
  });

  test("logs Cube runtime failures and returns a generic query execution error", async () => {
    mockLoad.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const { executeTenantScopedQuery } = await import("./cube-client");

    await expect(executeTenantScopedQuery(scopedInput)).rejects.toThrow(
      "Cube query failed. Verify CUBEJS_API_URL and CUBEJS_API_SECRET, and ensure the Cube service is running."
    );
    expect(mockLoggerError).toHaveBeenCalledWith(expect.any(Error), "Cube query failed");
  });

  test("records sanitized audit metadata without raw filter values", async () => {
    const { executeTenantScopedQuery } = await import("./cube-client");

    await executeTenantScopedQuery({
      ...scopedInput,
      query: {
        measures: ["FeedbackRecords.count"],
        filters: [{ member: "FeedbackRecords.sentiment", operator: "equals", values: ["secret-value"] }],
      },
    });

    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "queried",
        targetType: "cubeQuery",
        newObject: expect.objectContaining({
          query: expect.objectContaining({
            filterMembers: ["FeedbackRecords.sentiment"],
            filterCount: 1,
          }),
        }),
      })
    );
    expect(JSON.stringify(mockQueueAuditEventWithoutRequest.mock.calls[0][0])).not.toContain("secret-value");
  });

  test("handles audit logging failures without failing the Cube query", async () => {
    mockQueueAuditEventWithoutRequest.mockRejectedValueOnce(new Error("audit unavailable"));
    const { executeTenantScopedQuery } = await import("./cube-client");

    await expect(executeTenantScopedQuery(scopedInput)).resolves.toEqual([{ id: "1", count: 42 }]);

    await vi.waitFor(() => {
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.any(Error),
        "Failed to queue Cube query audit event"
      );
    });
  });
});
