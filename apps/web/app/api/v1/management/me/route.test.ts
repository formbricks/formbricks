import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  apiKeyFindFirst: vi.fn(),
  apiKeyFindUnique: vi.fn(),
  apiKeyUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  getSessionUser: vi.fn(),
  parseApiKeyV2: vi.fn(),
  hashSha256: vi.fn(),
  verifySecret: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    apiKey: {
      findFirst: mocks.apiKeyFindFirst,
      findUnique: mocks.apiKeyFindUnique,
      update: mocks.apiKeyUpdate,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

vi.mock("@/app/api/v1/management/me/lib/utils", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/crypto", () => ({
  parseApiKeyV2: mocks.parseApiKeyV2,
  hashSha256: mocks.hashSha256,
  verifySecret: mocks.verifySecret,
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    api: {
      v1: { interval: 60, allowedPerInterval: 100, namespace: "api:v1" },
    },
  },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    CONTROL_HASH: "control-hash",
  };
});

describe("api/v1/management/me route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("skips app rate limiting for the api-key branch because Envoy covers the route", async () => {
    mocks.headers.mockResolvedValue({
      get: (key: string) => (key === "x-api-key" ? "fbk_test" : null),
    });
    mocks.parseApiKeyV2.mockReturnValue(null);
    mocks.hashSha256.mockReturnValue("hashed-api-key");
    mocks.apiKeyFindFirst.mockResolvedValue({
      id: "api-key-1",
      hashedKey: "hashed-api-key",
      organizationId: "org-1",
      lastUsedAt: new Date(),
      apiKeyEnvironments: [
        {
          permission: "manage",
          environment: {
            id: "env-1",
            type: "production",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
            projectId: "project-1",
            appSetupCompleted: true,
            project: {
              id: "project-1",
              name: "Project 1",
            },
          },
        },
      ],
    });
    mocks.applyRateLimit.mockRejectedValue(new Error("should not be called"));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.applyRateLimit).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      id: "env-1",
      type: "production",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      appSetupCompleted: true,
      project: {
        id: "project-1",
        name: "Project 1",
      },
    });
  });

  test("keeps app rate limiting for the session branch", async () => {
    mocks.headers.mockResolvedValue({
      get: () => null,
    });
    mocks.getSessionUser.mockResolvedValue({ id: "user-1" });
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", email: "user@test.com" });
    mocks.applyRateLimit.mockResolvedValue({ allowed: true });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v1" }),
      "user-1"
    );
    expect(await response.json()).toEqual({ id: "user-1", email: "user@test.com" });
  });
});
