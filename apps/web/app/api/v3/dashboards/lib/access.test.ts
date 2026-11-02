import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { problemDashboardsPlanRequired } from "@/app/api/v3/lib/response";
import { authorizeLoadedDashboard } from "./access";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({ requireDashboardsAccess: vi.fn() }));

const context = {
  authentication: { apiKeyId: "key_1", workspacePermissions: [] } as never,
  requestId: "req_1",
  instance: "/api/v3/dashboards/dash_1",
};

const row = { id: "dash_1", workspaceId: "ws_of_row" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authorizeLoadedDashboard", () => {
  test("answers 403 for a dashboard that does not exist, without consulting workspace access", async () => {
    const result = await authorizeLoadedDashboard(null, "read", context);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "forbidden",
      requestId: "req_1",
      instance: "/api/v3/dashboards/dash_1",
    });
    expect(requireDashboardsAccess).not.toHaveBeenCalled();
  });

  test("authorizes against the workspace on the row, at the requested permission", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue({
      workspaceId: "ws_of_row",
      organizationId: "org_1",
    });

    const result = await authorizeLoadedDashboard(row, "readWrite", context);

    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      context.authentication,
      "ws_of_row",
      "readWrite",
      "req_1",
      "/api/v3/dashboards/dash_1"
    );
    expect(result).toEqual({ row, access: { workspaceId: "ws_of_row", organizationId: "org_1" } });
  });

  test("passes the access refusal through unchanged", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValue(
      problemDashboardsPlanRequired("req_1", context.instance)
    );

    const result = await authorizeLoadedDashboard(row, "read", context);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("dashboards_plan_required");
  });
});
