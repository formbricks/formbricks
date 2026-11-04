import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessControlPermission, getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { requireV3WorkspaceAccess } from "./auth";
import { refuseUnlessFeedbackDatasetAccess, requireDashboardsAccess } from "./dashboards-access";
import { problemForbidden } from "./response";
import type { TV3Authentication } from "./types";
import { resolveV3WorkspaceContext } from "./workspace-context";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsDashboardsEnabled: vi.fn(),
  getAccessControlPermission: vi.fn(),
}));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
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
  const asRole = (role: string | null) =>
    vi
      .mocked(getMembershipByUserIdOrganizationId)
      .mockResolvedValue(
        role ? ({ role } as Awaited<ReturnType<typeof getMembershipByUserIdOrganizationId>>) : null
      );

  test("asks a member `read` alone, never `dashboard_read`, so the previous schema keeps serving them (S2)", async () => {
    asRole("member");
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getIsDashboardsEnabled).mockResolvedValue(true);

    await expect(requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow)).resolves.toEqual(
      context
    );
    expect(can).toHaveBeenCalledTimes(1);
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "workspace.read", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    expect(getAccessControlPermission).not.toHaveBeenCalled();
  });

  test("answers a member SpiceDB refuses with the plain 403, never asking dashboard_read (S2)", async () => {
    asRole("member");
    vi.mocked(can).mockResolvedValue(false);

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow);

    expect((result as Response).status).toBe(403);
    expect(can).toHaveBeenCalledTimes(1);
    expect(vi.mocked(can).mock.calls[0][1]).toBe("workspace.read");
  });

  test("asks a Dashboard viewer `dashboard_read` once, and reads each entitlement once (C11)", async () => {
    asRole("dashboard_viewer");
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getAccessControlPermission).mockResolvedValue(true);
    vi.mocked(getIsDashboardsEnabled).mockResolvedValue(true);

    await expect(requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow)).resolves.toEqual(
      {
        ...context,
        asDashboardViewer: true,
      }
    );
    expect(can).toHaveBeenCalledTimes(1);
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "workspace.dashboard_read", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    expect(getAccessControlPermission).toHaveBeenCalledTimes(1);
    expect(getIsDashboardsEnabled).toHaveBeenCalledTimes(1);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("refuses a viewer SpiceDB allows when the organization lost the role's entitlement", async () => {
    asRole("dashboard_viewer");
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);
    vi.mocked(getIsDashboardsEnabled).mockResolvedValue(true);

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow);

    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toMatchObject({ code: "forbidden" });
  });

  test("refuses a viewer SpiceDB denies the workspace", async () => {
    asRole("dashboard_viewer");
    vi.mocked(can).mockResolvedValue(false);

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow);

    expect((result as Response).status).toBe(403);
    expect(getAccessControlPermission).not.toHaveBeenCalled();
  });

  test("refuses a workspace that does not exist with the same 403", async () => {
    vi.mocked(resolveV3WorkspaceContext).mockRejectedValueOnce(new ResourceNotFoundError("workspace", "x"));

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, "read", "req", "/i", allow);

    expect((result as Response).status).toBe(403);
    expect(can).not.toHaveBeenCalled();
  });

  test.each([
    ["the operation does not opt in", "read", undefined],
    ["the operation is a write", "readWrite", allow],
    ["the operation needs manage", "manage", allow],
  ] as const)("keeps the plain workspace check when %s", async (_label, permission, options) => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden("req"));

    const result = await requireDashboardsAccess(session, WORKSPACE_ID, permission, "req", "/i", options);

    expect((result as Response).status).toBe(403);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledTimes(1);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(session, WORKSPACE_ID, permission, "req", "/i");
    expect(getMembershipByUserIdOrganizationId).not.toHaveBeenCalled();
  });

  test("keeps the plain workspace check for an API key, whose dashboard read is its read", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden("req"));

    const result = await requireDashboardsAccess(apiKey, WORKSPACE_ID, "read", "req", "/i", allow);

    expect((result as Response).status).toBe(403);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(apiKey, WORKSPACE_ID, "read", "req", "/i");
    expect(getMembershipByUserIdOrganizationId).not.toHaveBeenCalled();
  });

  test("asks the dashboard-bound dataset read only for a context admitted as a Dashboard viewer (S2)", async () => {
    vi.mocked(can).mockResolvedValue(true);
    const resource = {
      type: "feedbackDirectoryAssignment",
      feedbackDirectoryId: DATASET_ID,
      workspaceId: WORKSPACE_ID,
    };
    const viewerContext = { ...context, asDashboardViewer: true as const };

    await refuseUnlessFeedbackDatasetAccess(session, viewerContext, DATASET_ID, "read", "req", "/i", allow);
    expect(can).toHaveBeenLastCalledWith(
      { type: "user", id: "user_1" },
      "feedbackDirectoryAssignment.dashboard_read",
      resource
    );

    // A member's dashboard-bound read is its plain read: `dashboard_read` is never asked of it.
    await refuseUnlessFeedbackDatasetAccess(session, context, DATASET_ID, "read", "req", "/i", allow);
    expect(can).toHaveBeenLastCalledWith(
      { type: "user", id: "user_1" },
      "feedbackDirectoryAssignment.read",
      resource
    );

    // Without the opt-in, a viewer context is still only asked `read`, which it never holds.
    await refuseUnlessFeedbackDatasetAccess(session, viewerContext, DATASET_ID, "read", "req");
    expect(can).toHaveBeenLastCalledWith(
      { type: "user", id: "user_1" },
      "feedbackDirectoryAssignment.read",
      resource
    );

    await refuseUnlessFeedbackDatasetAccess(
      session,
      viewerContext,
      DATASET_ID,
      "readWrite",
      "req",
      "/i",
      allow
    );
    expect(can).toHaveBeenLastCalledWith(
      { type: "user", id: "user_1" },
      "feedbackDirectoryAssignment.write",
      resource
    );
  });
});
