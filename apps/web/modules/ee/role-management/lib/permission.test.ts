import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganization } from "@/lib/organization/service";
import {
  getAccessControlPermission,
  getIsDashboardViewerRoleEnabled,
} from "@/modules/ee/license-check/lib/utils";
import {
  assertDashboardViewerRoleAvailable,
  canManagerAssignRole,
  checkRoleManagementPermission,
} from "./permission";

vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));
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

describe("assertDashboardViewerRoleAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not read the entitlement when no viewer is being given", async () => {
    await expect(assertDashboardViewerRoleAvailable("org-1", ["member", "owner"])).resolves.toBeUndefined();
    expect(getIsDashboardViewerRoleEnabled).not.toHaveBeenCalled();
  });

  test("refuses a viewer without Access Control and Dashboards", async () => {
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(false);

    await expect(assertDashboardViewerRoleAvailable("org-1", ["member", "dashboard_viewer"])).rejects.toThrow(
      new OperationNotAllowedError("The Dashboard viewer role is not available on this plan")
    );
    expect(getIsDashboardViewerRoleEnabled).toHaveBeenCalledWith("org-1");
  });

  test("allows a viewer with both entitled", async () => {
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);

    await expect(assertDashboardViewerRoleAvailable("org-1", ["dashboard_viewer"])).resolves.toBeUndefined();
  });
});

describe("canManagerAssignRole", () => {
  test.each([
    ["member", true],
    ["dashboard_viewer", true],
    ["manager", false],
    ["owner", false],
    ["billing", false],
  ] as const)("%s → %s", (role, expected) => {
    expect(canManagerAssignRole(role)).toBe(expected);
  });
});
