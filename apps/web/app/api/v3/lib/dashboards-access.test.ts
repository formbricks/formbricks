import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import {
  getIsDashboardViewerRoleEnabled,
  getIsDashboardsEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { requireV3WorkspaceAccess } from "./auth";
import { refuseUnlessFeedbackDatasetAccess, requireDashboardsAccess } from "./dashboards-access";
import { problemForbidden } from "./response";
import type { TV3Authentication } from "./types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsDashboardsEnabled: vi.fn(),
  getIsDashboardViewerRoleEnabled: vi.fn(),
}));
vi.mock("./workspace-context", () => ({
  resolveV3WorkspaceContext: vi.fn(async (workspaceId: string) => ({
    workspaceId,
    organizationId: "clorg00000000000000000001",
  })),
}));
vi.mock("./auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth")>()),
  requireV3WorkspaceAccess: vi.fn(),
}));

const WORKSPACE_ID = "clws000000000000000000001";
const ORGANIZATION_ID = "clorg00000000000000000001";
const DATASET_ID = "clds000000000000000000001";
const context = { workspaceId: WORKSPACE_ID, organizationId: ORGANIZATION_ID };

const session = { user: { id: "user_1" }, expires: "2099-01-01" } as unknown as TV3Authentication;
const apiKey = { type: "apiKey", apiKeyId: "key_1" } as unknown as TV3Authentication;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("requireDashboardsAccess", () => {
  test("returns the workspace context when the caller has access and the plan includes Dashboards", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(context);
    vi.mocked(getIsDashboardsEnabled).mockResolvedValue(true);

    await expect(requireDashboardsAccess(session, WORKSPACE_ID, "readWrite", "req", "/i")).resolves.toEqual(
      context
    );
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(session, WORKSPACE_ID, "readWrite", "req", "/i");
    expect(getIsDashboardsEnabled).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  test("passes the workspace refusal through without revealing the organization's plan", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden("req"));

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, "read", "req");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toMatchObject({ code: "forbidden" });
    expect(getIsDashboardsEnabled).not.toHaveBeenCalled();
  });

  test("answers 403 dashboards_plan_required when the organization lacks the add-on", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(context);
    vi.mocked(getIsDashboardsEnabled).mockResolvedValue(false);

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/api/v3/charts");

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toMatchObject({
      code: "dashboards_plan_required",
      instance: "/api/v3/charts",
      requestId: "req",
    });
  });
});

describe("refuseUnlessFeedbackDatasetAccess", () => {
  test("allows a user who holds the permission on the dataset's assignment to this workspace", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(
      refuseUnlessFeedbackDatasetAccess(session, context, DATASET_ID, "read", "req")
    ).resolves.toBeNull();
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "feedbackDirectoryAssignment.read", {
      type: "feedbackDirectoryAssignment",
      feedbackDirectoryId: DATASET_ID,
      workspaceId: WORKSPACE_ID,
    });
  });

  test("checks an API key as itself, at the write action for readWrite", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(
      refuseUnlessFeedbackDatasetAccess(apiKey, context, DATASET_ID, "readWrite", "req")
    ).resolves.toBeNull();
    expect(can).toHaveBeenCalledWith(
      { type: "apiKey", id: "key_1" },
      "feedbackDirectoryAssignment.write",
      expect.objectContaining({ feedbackDirectoryId: DATASET_ID, workspaceId: WORKSPACE_ID })
    );
  });

  test("answers 403 when the caller may not use the dataset", async () => {
    vi.mocked(can).mockResolvedValue(false);

    const result = await refuseUnlessFeedbackDatasetAccess(session, context, DATASET_ID, "read", "req", "/i");

    expect(result?.status).toBe(403);
    expect(await result?.json()).toMatchObject({
      code: "forbidden",
      detail: "You are not authorized to use this Feedback Dataset",
      instance: "/i",
    });
  });

  test("answers 401 without asking the authorizer when there is no actor", async () => {
    const result = await refuseUnlessFeedbackDatasetAccess(null, context, DATASET_ID, "read", "req");

    expect(result?.status).toBe(401);
    expect(await result?.json()).toMatchObject({ code: "not_authenticated" });
    expect(can).not.toHaveBeenCalled();
  });
});

describe("dashboard-bound reads admit a Dashboard viewer through SpiceDB (ADR-0023)", () => {
  const allow = { allowDashboardViewer: true } as const;

  test("asks dashboardRead after a read refusal, and admits the viewer it allows", async () => {
    vi.mocked(requireV3WorkspaceAccess)
      .mockResolvedValueOnce(problemForbidden("req"))
      .mockResolvedValueOnce(context);
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
    vi.mocked(getIsDashboardsEnabled).mockResolvedValue(true);

    await expect(requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow)).resolves.toEqual(
      context
    );
    expect(requireV3WorkspaceAccess).toHaveBeenNthCalledWith(1, session, WORKSPACE_ID, "read", "req", "/i");
    expect(requireV3WorkspaceAccess).toHaveBeenNthCalledWith(
      2,
      session,
      WORKSPACE_ID,
      "dashboardRead",
      "req",
      "/i"
    );
    expect(getIsDashboardViewerRoleEnabled).toHaveBeenCalledWith(ORGANIZATION_ID);
  });

  test("costs everyone SpiceDB allows the one read check it always did", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(context);
    vi.mocked(getIsDashboardsEnabled).mockResolvedValue(true);

    await requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledTimes(1);
    expect(getIsDashboardViewerRoleEnabled).not.toHaveBeenCalled();
  });

  test.each([
    ["the operation does not opt in", "read", undefined],
    ["the operation is a write", "readWrite", allow],
    ["the operation needs manage", "manage", allow],
  ] as const)("never asks dashboardRead when %s", async (_label, permission, options) => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden("req"));

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, permission, "req", "/i", options);

    expect((result as Response).status).toBe(403);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledTimes(1);
  });

  test("never asks dashboardRead for an API key, whose dashboard read is its read", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden("req"));

    const result = await requireDashboardsAccess(apiKey, WORKSPACE_ID, "read", "req", "/i", allow);

    expect((result as Response).status).toBe(403);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledTimes(1);
  });

  test("keeps the read refusal when SpiceDB denies dashboardRead too", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden("req"));

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow);

    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toMatchObject({ code: "forbidden" });
    expect(getIsDashboardViewerRoleEnabled).not.toHaveBeenCalled();
  });

  test("refuses a viewer SpiceDB allows when the organization lost the role's entitlement", async () => {
    vi.mocked(requireV3WorkspaceAccess)
      .mockResolvedValueOnce(problemForbidden("req"))
      .mockResolvedValueOnce(context);
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(false);

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow);

    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toMatchObject({ code: "forbidden" });
    expect(getIsDashboardsEnabled).not.toHaveBeenCalled();
  });

  test("asks the dashboard-bound dataset read only on an opted-in read", async () => {
    vi.mocked(can).mockResolvedValue(true);
    const resource = {
      type: "feedbackDirectoryAssignment",
      feedbackDirectoryId: DATASET_ID,
      workspaceId: WORKSPACE_ID,
    };

    await refuseUnlessFeedbackDatasetAccess(session, context, DATASET_ID, "read", "req", "/i", allow);
    expect(can).toHaveBeenLastCalledWith(
      { type: "user", id: "user_1" },
      "feedbackDirectoryAssignment.dashboard_read",
      resource
    );

    await refuseUnlessFeedbackDatasetAccess(session, context, DATASET_ID, "read", "req");
    expect(can).toHaveBeenLastCalledWith(
      { type: "user", id: "user_1" },
      "feedbackDirectoryAssignment.read",
      resource
    );

    await refuseUnlessFeedbackDatasetAccess(session, context, DATASET_ID, "readWrite", "req", "/i", allow);
    expect(can).toHaveBeenLastCalledWith(
      { type: "user", id: "user_1" },
      "feedbackDirectoryAssignment.write",
      resource
    );
  });
});
