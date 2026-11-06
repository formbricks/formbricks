import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const { mockCan, mockGetSession, mockGetIntegrationByType, mockGetOrganizationId } = vi.hoisted(() => ({
  mockCan: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetIntegrationByType: vi.fn(),
  mockGetOrganizationId: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mockCan }));
vi.mock("@/lib/integration/service", () => ({ getIntegrationByType: mockGetIntegrationByType }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: mockGetOrganizationId }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({ action, targetType })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const WORKSPACE_ID = "clws111111111111111111111";
const USER_ID = "user_1";

const integration = {
  id: "int_1",
  type: "googleSheets",
  workspaceId: WORKSPACE_ID,
  config: {
    email: "sheets@example.com",
    key: { access_token: "secret-access", refresh_token: "secret-refresh", expiry_date: 1 },
    data: [{ spreadsheetName: "Responses", createdAt: new Date("2026-01-01T00:00:00.000Z") }],
  },
};

const get = (type = "googleSheets", workspaceId = WORKSPACE_ID) =>
  GET(new NextRequest(`http://localhost/api/workspaces/${workspaceId}/integrations/${type}`), {
    params: Promise.resolve({ workspaceId, type }),
  } as never);

describe("GET /api/workspaces/[workspaceId]/integrations/[type]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
    mockCan.mockResolvedValue(true);
    mockGetIntegrationByType.mockResolvedValue(integration);
    mockGetOrganizationId.mockResolvedValue("org_1");
  });

  test("returns the workspace's integration of that type with its credentials redacted", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(mockCan).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "workspace.write", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    expect(mockGetIntegrationByType).toHaveBeenCalledWith(WORKSPACE_ID, "googleSheets");
    const { data } = await response.json();
    expect(data.config.data[0].spreadsheetName).toBe("Responses");
    expect(data.config.key.expiry_date).toBe(1);
    expect(JSON.stringify(data)).not.toContain("secret-");
  });

  test("returns null when the workspace has no integration of that type", async () => {
    mockGetIntegrationByType.mockResolvedValue(null);

    const response = await get("notion");

    expect(response.status).toBe(200);
    expect((await response.json()).data).toBeNull();
  });

  test("forbids a member without write access to the workspace, before reading anything", async () => {
    mockCan.mockResolvedValue(false);

    const response = await get();

    expect(response.status).toBe(403);
    expect(mockGetIntegrationByType).not.toHaveBeenCalled();
  });

  test("rejects an unknown integration type", async () => {
    const response = await get("salesforce");

    expect(response.status).toBe(400);
    expect(mockGetIntegrationByType).not.toHaveBeenCalled();
  });

  test("rejects n8n, which no integration settings page stores", async () => {
    const response = await get("n8n");

    expect(response.status).toBe(400);
    expect(mockGetIntegrationByType).not.toHaveBeenCalled();
  });
});
