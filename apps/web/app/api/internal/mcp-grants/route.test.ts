import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isDashboardViewerOnly: vi.fn(),
  listMcpConnections: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/modules/ee/analysis/lib/dashboard-viewer-access", () => ({
  isDashboardViewerOnly: mocks.isDashboardViewerOnly,
}));
vi.mock("@/modules/mcp/connections", () => ({ listMcpConnections: mocks.listMcpConnections }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";

const list = () =>
  GET(new NextRequest("http://localhost/api/internal/mcp-grants", { headers: { "x-request-id": "req_1" } }), {
    params: Promise.resolve({}),
  } as never);

describe("GET /api/internal/mcp-grants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.isDashboardViewerOnly.mockResolvedValue(false);
    mocks.listMcpConnections.mockResolvedValue([
      {
        clientId: "client_a",
        clientName: "Claude",
        clientUri: "https://claude.ai",
        consentId: "consent_a",
        connectedAt: new Date("2030-01-01T00:00:00.000Z"),
        updatedAt: new Date("2030-02-01T00:00:00.000Z"),
        permissions: { surveys: "read" },
        cap: { surveys: "write" },
      },
    ]);
  });

  test("lists only the session user's connections, with each grant and the cap Edit is held to", async () => {
    const response = await list();

    expect(response.status).toBe(200);
    expect(mocks.listMcpConnections).toHaveBeenCalledWith(USER_ID, { isDashboardViewer: false });
    expect((await response.json()).data).toEqual({
      isDashboardViewer: false,
      connections: [
        {
          clientId: "client_a",
          clientName: "Claude",
          clientUri: "https://claude.ai",
          consentId: "consent_a",
          connectedAt: "2030-01-01T00:00:00.000Z",
          updatedAt: "2030-02-01T00:00:00.000Z",
          permissions: { surveys: "read" },
          cap: { surveys: "write" },
        },
      ],
    });
  });

  test("caps a Dashboard viewer's connections at what a viewer may give", async () => {
    mocks.isDashboardViewerOnly.mockResolvedValue(true);

    const response = await list();

    expect(mocks.listMcpConnections).toHaveBeenCalledWith(USER_ID, { isDashboardViewer: true });
    expect((await response.json()).data.isDashboardViewer).toBe(true);
  });

  test("returns 401 without a session and reads nothing", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await list()).status).toBe(401);
    expect(mocks.listMcpConnections).not.toHaveBeenCalled();
  });
});
