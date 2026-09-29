import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { GET } from "./route";

const { mockGetSession, mockCheckWorkspaceAccess, mockCheckDirectoryAccess, mockDashboardsEnabled, mockGet } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockCheckWorkspaceAccess: vi.fn(),
    mockCheckDirectoryAccess: vi.fn(),
    mockDashboardsEnabled: vi.fn(),
    mockGet: vi.fn(),
  }));

vi.mock("@/modules/ee/analysis/lib/access", () => ({
  checkWorkspaceAccess: mockCheckWorkspaceAccess,
  checkFeedbackDirectoryAccess: mockCheckDirectoryAccess,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDashboardsEnabled: mockDashboardsEnabled }));
vi.mock("@/modules/ee/analysis/charts/lib/matrix-questions", () => ({ getMatrixQuestions: mockGet }));
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
const DIRECTORY_ID = "cldir11111111111111111111";
const USER_ID = "user_1";

const get = (query = `?feedbackDirectoryId=${DIRECTORY_ID}`) =>
  GET(new NextRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/matrix-questions${query}`), {
    params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
  } as never);

describe("GET /api/workspaces/[workspaceId]/matrix-questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
    mockCheckWorkspaceAccess.mockResolvedValue({ organizationId: "org_1", workspaceId: WORKSPACE_ID });
    mockDashboardsEnabled.mockResolvedValue(true);
    mockCheckDirectoryAccess.mockResolvedValue({ feedbackDirectoryId: DIRECTORY_ID });
    mockGet.mockResolvedValue([{ label: "Rate us", rowCount: 3, columnCount: 5, surveyNames: ["S"] }]);
  });

  test("returns the directory's matrix questions after checking workspace and directory access", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      { label: "Rate us", rowCount: 3, columnCount: 5, surveyNames: ["S"] },
    ]);
    expect(mockCheckWorkspaceAccess).toHaveBeenCalledWith(USER_ID, WORKSPACE_ID, "read");
    expect(mockCheckDirectoryAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        feedbackDirectoryId: DIRECTORY_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
      })
    );
    expect(mockGet).toHaveBeenCalledWith(WORKSPACE_ID, DIRECTORY_ID);
  });

  test.each([
    ["the workspace", () => mockCheckWorkspaceAccess.mockRejectedValue(new AuthorizationError("no"))],
    ["the directory", () => mockCheckDirectoryAccess.mockRejectedValue(new AuthorizationError("no"))],
    ["dashboards", () => mockDashboardsEnabled.mockResolvedValue(false)],
  ])("refuses with 403 without access to %s", async (_label, deny) => {
    deny();

    const response = await get();

    expect(response.status).toBe(403);
    expect(mockGet).not.toHaveBeenCalled();
  });

  test("rejects an unauthenticated request", async () => {
    mockGetSession.mockResolvedValue(null);

    expect((await get()).status).toBe(401);
    expect(mockGet).not.toHaveBeenCalled();
  });

  test("rejects a missing directory with 400", async () => {
    expect((await get("")).status).toBe(400);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
