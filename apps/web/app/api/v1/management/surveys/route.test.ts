import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getEnvironmentIdsByOrganizationId } from "@/lib/environment/organization";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { getSurveys } from "./lib/surveys";
import { GET } from "./route";

vi.mock("@/modules/organization/settings/api-keys/lib/api-key", () => ({
  getApiKeyWithPermissions: vi.fn(),
}));

vi.mock("@/lib/environment/organization", () => ({
  getEnvironmentIdsByOrganizationId: vi.fn(),
}));

vi.mock("./lib/surveys", () => ({
  getSurveys: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
  applyIPRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/lib/api/api-error-reporter", () => ({
  reportApiError: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return { ...actual, AUDIT_LOG_ENABLED: false };
});

describe("GET /api/v1/management/surveys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnvironmentIdsByOrganizationId).mockResolvedValue(["env-1", "env-2"]);
    vi.mocked(getSurveys).mockResolvedValue([]);
  });

  test("accepts a read-only organization API key without environment permissions", async () => {
    vi.mocked(getApiKeyWithPermissions).mockResolvedValue({
      id: "api-key-id",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
      apiKeyEnvironments: [],
    } as any);

    const request = new NextRequest("http://localhost/api/v1/management/surveys", {
      headers: { "x-api-key": "read-only-org-api-key" },
    });

    const response = await GET(request, {} as any);

    expect(response.status).toBe(200);
    expect(getEnvironmentIdsByOrganizationId).toHaveBeenCalledWith("org-id");
    expect(getSurveys).toHaveBeenCalledWith(["env-1", "env-2"], undefined, undefined);
  });

  test("uses explicit readable environment permissions without organization read access", async () => {
    vi.mocked(getApiKeyWithPermissions).mockResolvedValue({
      id: "api-key-id",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {
          read: false,
          write: false,
        },
      },
      apiKeyEnvironments: [
        {
          environmentId: "env-1",
          permission: "read",
          environment: {
            id: "env-1",
            type: "development",
            projectId: "project-1",
            project: { id: "project-1", name: "Project 1" },
          },
        },
      ],
    } as any);

    const request = new NextRequest("http://localhost/api/v1/management/surveys?limit=10&offset=5", {
      headers: { "x-api-key": "environment-read-api-key" },
    });

    const response = await GET(request, {} as any);

    expect(response.status).toBe(200);
    expect(getEnvironmentIdsByOrganizationId).not.toHaveBeenCalled();
    expect(getSurveys).toHaveBeenCalledWith(["env-1"], 10, 5);
  });
});
