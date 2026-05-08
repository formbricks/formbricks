import { EnvironmentType } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { authenticateApiKey } from "@/app/api/v1/auth";
import { getEnvironment } from "@/lib/environment/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { GET } from "./route";

const { mockHeaders, mockPrisma } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@formbricks/database", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/app/api/v1/auth", () => ({
  authenticateApiKey: vi.fn(),
}));

vi.mock("@/app/api/v1/management/me/lib/utils", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/environment/service", () => ({
  getEnvironment: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));

describe("GET /api/v1/management/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers({ "x-api-key": "read-only-org-api-key" }));
  });

  test("accepts a read-only organization API key without environment permissions", async () => {
    vi.mocked(authenticateApiKey).mockResolvedValue({
      type: "apiKey",
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
      environmentPermissions: [],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      environmentPermissions: [],
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
    });
    expect(authenticateApiKey).toHaveBeenCalledWith("read-only-org-api-key", {
      allowOrganizationOnlyApiKey: true,
    });
    expect(applyRateLimit).toHaveBeenCalledWith(expect.any(Object), "api-key-id");
  });

  test("preserves the legacy environment response for single-environment API keys", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");

    vi.mocked(authenticateApiKey).mockResolvedValue({
      type: "apiKey",
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {
          read: false,
          write: false,
        },
      },
      environmentPermissions: [
        {
          environmentId: "env-id",
          environmentType: EnvironmentType.development,
          permission: "read",
          projectId: "project-id",
          projectName: "Project Name",
        },
      ],
    });
    vi.mocked(getEnvironment).mockResolvedValue({
      id: "env-id",
      type: EnvironmentType.development,
      createdAt,
      updatedAt,
      projectId: "project-id",
      appSetupCompleted: true,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "env-id",
      type: EnvironmentType.development,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      appSetupCompleted: true,
      project: {
        id: "project-id",
        name: "Project Name",
      },
    });
  });
});
