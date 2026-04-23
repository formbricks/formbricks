import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { publicUserSelect } from "@/lib/user/public-user";
import { GET } from "./route";

const expectedPublicUserSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  twoFactorEnabled: true,
  identityProvider: true,
  notificationSettings: true,
  locale: true,
  lastLoginAt: true,
  isActive: true,
} as const;

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSessionUser: vi.fn(),
  parseApiKeyV2: vi.fn(),
  hashSha256: vi.fn(),
  verifySecret: vi.fn(),
  applyRateLimit: vi.fn(),
  notAuthenticatedResponse: vi.fn(
    () => new Response(JSON.stringify({ message: "Not authenticated" }), { status: 401 })
  ),
  tooManyRequestsResponse: vi.fn(
    (message: string) => new Response(JSON.stringify({ message }), { status: 429 })
  ),
  badRequestResponse: vi.fn((message: string) => new Response(JSON.stringify({ message }), { status: 400 })),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/app/api/v1/management/me/lib/utils", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    notAuthenticatedResponse: mocks.notAuthenticatedResponse,
    tooManyRequestsResponse: mocks.tooManyRequestsResponse,
    badRequestResponse: mocks.badRequestResponse,
  },
}));

vi.mock("@/lib/crypto", () => ({
  hashSha256: mocks.hashSha256,
  parseApiKeyV2: mocks.parseApiKeyV2,
  verifySecret: mocks.verifySecret,
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    api: {
      v1: { windowMs: 60_000, max: 1000 },
    },
  },
}));

const getMockHeaders = (apiKey: string | null) => ({
  get: (headerName: string) => (headerName === "x-api-key" ? apiKey : null),
});

describe("v1 management me route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(getMockHeaders(null));
    mocks.getSessionUser.mockResolvedValue(undefined);
    mocks.parseApiKeyV2.mockReturnValue(null);
    mocks.hashSha256.mockReturnValue("hashed-api-key");
    mocks.verifySecret.mockResolvedValue(false);
    mocks.applyRateLimit.mockResolvedValue(undefined);
  });

  test("returns a sanitized authenticated user for session-based requests", async () => {
    const publicUser = {
      id: "user_123",
      name: "Test User",
      email: "test@example.com",
      emailVerified: new Date("2025-04-17T20:11:54.947Z"),
      createdAt: new Date("2025-04-17T20:09:14.021Z"),
      updatedAt: new Date("2026-04-22T22:12:39.104Z"),
      twoFactorEnabled: false,
      identityProvider: "email" as const,
      notificationSettings: {
        alert: {},
        unsubscribedOrganizationIds: [],
      },
      locale: "en-US" as const,
      lastLoginAt: new Date("2026-04-22T22:12:39.104Z"),
      isActive: true,
    };

    mocks.getSessionUser.mockResolvedValue({ id: publicUser.id });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(publicUser as never);

    const response = await GET();
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toStrictEqual(JSON.parse(JSON.stringify(publicUser)));
    expect(responseBody).not.toHaveProperty("password");
    expect(responseBody).not.toHaveProperty("twoFactorSecret");
    expect(responseBody).not.toHaveProperty("backupCodes");
    expect(responseBody).not.toHaveProperty("identityProviderAccountId");
    expect(publicUserSelect).toStrictEqual(expectedPublicUserSelect);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: publicUser.id },
      select: expectedPublicUserSelect,
    });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(expect.any(Object), publicUser.id);
  });

  test("returns the existing unauthenticated response when no session is present", async () => {
    const response = await GET();
    const responseBody = await response.json();

    expect(response.status).toBe(401);
    expect(responseBody).toEqual({ message: "Not authenticated" });
    expect(mocks.notAuthenticatedResponse).toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("preserves the API key response path", async () => {
    const apiKeyData = {
      id: "api_key_123",
      organizationId: "org_123",
      hashedKey: "stored-hash",
      lastUsedAt: new Date(),
      apiKeyEnvironments: [
        {
          permission: "manage",
          environment: {
            id: "env_123",
            type: "development",
            createdAt: new Date("2025-01-01T00:00:00.000Z"),
            updatedAt: new Date("2025-01-02T00:00:00.000Z"),
            projectId: "project_123",
            appSetupCompleted: true,
            project: {
              id: "project_123",
              name: "My Project",
            },
          },
        },
      ],
    };

    mocks.headers.mockResolvedValue(getMockHeaders("api-key"));
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(apiKeyData as never);

    const response = await GET();
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toStrictEqual({
      id: "env_123",
      type: "development",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-02T00:00:00.000Z",
      appSetupCompleted: true,
      project: {
        id: "project_123",
        name: "My Project",
      },
    });
    expect(mocks.getSessionUser).not.toHaveBeenCalled();
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(expect.any(Object), apiKeyData.id);
  });
});
