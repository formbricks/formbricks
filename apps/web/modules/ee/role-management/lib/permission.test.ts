import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import {
  getAccessControlPermission,
  getIsDashboardViewerRoleEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { assertCanAssignRole, checkRoleManagementPermission } from "./permission";

vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));
const cloud = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return cloud.value;
  },
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: vi.fn(),
  getIsDashboardViewerRoleEnabled: vi.fn(),
}));

describe("checkRoleManagementPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws when the organization does not exist", async () => {
    vi.mocked(getOrganization).mockResolvedValue(null);

    await expect(checkRoleManagementPermission("org-1")).rejects.toThrow(ResourceNotFoundError);
    expect(getAccessControlPermission).not.toHaveBeenCalled();
  });

  test("throws when the license does not include the feature", async () => {
    vi.mocked(getOrganization).mockResolvedValue({ id: "org-1" } as Awaited<
      ReturnType<typeof getOrganization>
    >);
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);

    await expect(checkRoleManagementPermission("org-1")).rejects.toThrow(
      new OperationNotAllowedError("Role management is not allowed for this organization")
    );
  });

  test("resolves when the organization exists and the feature is licensed", async () => {
    vi.mocked(getOrganization).mockResolvedValue({ id: "org-1" } as Awaited<
      ReturnType<typeof getOrganization>
    >);
    vi.mocked(getAccessControlPermission).mockResolvedValue(true);

    await expect(checkRoleManagementPermission("org-1")).resolves.toBeUndefined();
    expect(getAccessControlPermission).toHaveBeenCalledWith("org-1");
  });
});

describe("assertCanAssignRole (C10: the one rule every role-giving path runs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cloud.value = false;
  });

  const assign = (assignerRole: string | null, roles: string[], targetCurrentRole?: string | null) =>
    assertCanAssignRole({
      organizationId: "org-1",
      assignerRole: assignerRole as never,
      roles: roles as never,
      targetCurrentRole: targetCurrentRole as never,
    });

  test("does not read the entitlement when no viewer is being given", async () => {
    await expect(assign("owner", ["member", "owner"])).resolves.toBeUndefined();
    expect(getIsDashboardViewerRoleEnabled).not.toHaveBeenCalled();
  });

  test("refuses a viewer without Access Control and Dashboards, reading the entitlement once", async () => {
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(false);

    await expect(assign("owner", ["member", "dashboard_viewer", "dashboard_viewer"])).rejects.toThrow(
      new OperationNotAllowedError("The Dashboard viewer role is not available on this plan")
    );
    expect(getIsDashboardViewerRoleEnabled).toHaveBeenCalledTimes(1);
    expect(getIsDashboardViewerRoleEnabled).toHaveBeenCalledWith("org-1");
  });

  test.each([
    ["owner", "dashboard_viewer"],
    ["manager", "dashboard_viewer"],
    ["manager", "member"],
    ["owner", "manager"],
    ["owner", "owner"],
  ])("a %s may give %s", async (assignerRole, role) => {
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
    await expect(assign(assignerRole, [role])).resolves.toBeUndefined();
  });

  test.each([
    ["manager", "manager"],
    ["manager", "owner"],
    ["member", "member"],
    ["dashboard_viewer", "member"],
    [null, "member"],
  ])("a %s may not give %s", async (assignerRole, role) => {
    await expect(assign(assignerRole, [role])).rejects.toThrow(OperationNotAllowedError);
  });

  test("a Manager may not change an Owner's role, an Owner may", async () => {
    await expect(assign("manager", ["member"], "owner")).rejects.toThrow(OperationNotAllowedError);
    await expect(assign("owner", ["member"], "owner")).resolves.toBeUndefined();
  });

  test("Billing only on Formbricks Cloud, and only from an Owner", async () => {
    await expect(assign("owner", ["billing"])).rejects.toThrow(
      new ValidationError("Billing role is not allowed")
    );
    cloud.value = true;
    await expect(assign("owner", ["billing"])).resolves.toBeUndefined();
    await expect(assign("manager", ["billing"])).rejects.toThrow(OperationNotAllowedError);
  });

  test("the management API path never gives a viewer, whatever the entitlement", async () => {
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
    await expect(
      assertCanAssignRole({
        organizationId: "org-1",
        assignerRole: "owner",
        roles: ["dashboard_viewer"],
        channel: "managementApi",
      })
    ).rejects.toThrow(OperationNotAllowedError);
  });
});
