import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isDashboardViewerOnly: vi.fn(),
  listAuthorizedMcpClients: vi.fn(),
  listMcpGrantAccessOptions: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/modules/ee/analysis/lib/dashboard-viewer-access", () => ({
  isDashboardViewerOnly: mocks.isDashboardViewerOnly,
}));
vi.mock("@/modules/mcp/authorized-clients", () => ({
  listAuthorizedMcpClients: mocks.listAuthorizedMcpClients,
}));
vi.mock("@/modules/mcp/access-options", () => ({
  listMcpGrantAccessOptions: mocks.listMcpGrantAccessOptions,
}));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ACCESS_OPTIONS = {
  organizations: [{ id: "org_1", name: "Acme" }],
  workspaces: [{ id: "ws_1", name: "Web", organizationId: "org_1", organizationName: "Acme" }],
};

const list = () =>
  GET(new NextRequest("http://localhost/api/internal/mcp-grants", { headers: { "x-request-id": "req_1" } }), {
    params: Promise.resolve({}),
  } as never);

describe("GET /api/internal/mcp-grants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.isDashboardViewerOnly.mockResolvedValue(false);
    mocks.listAuthorizedMcpClients.mockResolvedValue([
      {
        clientId: "client_a",
        clientName: "Claude",
        clientUri: "https://claude.ai",
        connectedAt: new Date("2030-01-01T00:00:00.000Z"),
        updatedAt: new Date("2030-02-01T00:00:00.000Z"),
        permissions: { surveys: "read" },
        access: { access: "workspaces", workspaceIds: ["ws_1"] },
        cap: { surveys: "write" },
      },
    ]);
    mocks.listMcpGrantAccessOptions.mockResolvedValue(ACCESS_OPTIONS);
  });

  test("lists only the session user's MCP clients, with each grant, the cap Edit is held to and what access it can pick", async () => {
    const response = await list();

    expect(response.status).toBe(200);
    // What the summary counts and Edit opens with is held to the options it lists (spec story 36).
    expect(mocks.listAuthorizedMcpClients).toHaveBeenCalledWith(USER_ID, {
      isDashboardViewer: false,
      accessOptions: ACCESS_OPTIONS,
    });
    expect(mocks.listMcpGrantAccessOptions).toHaveBeenCalledWith(USER_ID);
    expect((await response.json()).data).toEqual({
      isDashboardViewer: false,
      accessOptions: ACCESS_OPTIONS,
      clients: [
        {
          clientId: "client_a",
          clientName: "Claude",
          clientUri: "https://claude.ai",
          connectedAt: "2030-01-01T00:00:00.000Z",
          updatedAt: "2030-02-01T00:00:00.000Z",
          permissions: { surveys: "read" },
          access: { access: "workspaces", workspaceIds: ["ws_1"] },
          cap: { surveys: "write" },
        },
      ],
    });
  });

  test("caps a Dashboard viewer's MCP clients at what a viewer may give", async () => {
    mocks.isDashboardViewerOnly.mockResolvedValue(true);

    const response = await list();

    expect(mocks.listAuthorizedMcpClients).toHaveBeenCalledWith(USER_ID, {
      isDashboardViewer: true,
      accessOptions: ACCESS_OPTIONS,
    });
    expect((await response.json()).data.isDashboardViewer).toBe(true);
  });

  test("returns 401 without a session and reads nothing", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await list()).status).toBe(401);
    expect(mocks.listAuthorizedMcpClients).not.toHaveBeenCalled();
  });
});
