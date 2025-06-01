import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { deleteUser } from "@/lib/user/service";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { deleteUserAction } from "./actions";

// Mock all dependencies
vi.mock("@/lib/user/service", () => ({
  deleteUser: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationsWhereUserIsSingleOwner: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
}));

// add a mock to authenticatedActionClient.action
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    action: (fn: any) => {
      return fn;
    },
  },
}));

describe("deleteUserAction", () => {
  test("deletes user successfully when multi-org is enabled", async () => {
    const ctx = { user: { id: "test-user" }, auditLoggingCtx: {} } as any;
    vi.mocked(deleteUser).mockResolvedValueOnce({ id: "test-user" } as TUser);
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValueOnce([]);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValueOnce(true);

    const result = await deleteUserAction({ ctx } as any);

    expect(result).toStrictEqual({ id: "test-user" } as TUser);
    expect(deleteUser).toHaveBeenCalledWith("test-user");
    expect(getOrganizationsWhereUserIsSingleOwner).toHaveBeenCalledWith("test-user");
    expect(getIsMultiOrgEnabled).toHaveBeenCalledTimes(1);
  });

  test("deletes user successfully when multi-org is disabled but user is not sole owner of any org", async () => {
    const ctx = { user: { id: "another-user" }, auditLoggingCtx: {} } as any;
    vi.mocked(deleteUser).mockResolvedValueOnce({ id: "another-user" } as TUser);
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValueOnce([]);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValueOnce(false);

    const result = await deleteUserAction({ ctx } as any);

    expect(result).toStrictEqual({ id: "another-user" } as TUser);
    expect(deleteUser).toHaveBeenCalledWith("another-user");
    expect(getOrganizationsWhereUserIsSingleOwner).toHaveBeenCalledWith("another-user");
    expect(getIsMultiOrgEnabled).toHaveBeenCalledTimes(1);
  });

  test("throws OperationNotAllowedError when user is sole owner in at least one org and multi-org is disabled", async () => {
    const ctx = { user: { id: "sole-owner-user" }, auditLoggingCtx: {} } as any;
    vi.mocked(deleteUser).mockResolvedValueOnce({ id: "test-user" } as TUser);
    vi.mocked(getOrganizationsWhereUserIsSingleOwner).mockResolvedValueOnce([
      { id: "org-1" } as TOrganization,
    ]);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValueOnce(false);

    await expect(() => deleteUserAction({ ctx } as any)).rejects.toThrow(OperationNotAllowedError);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(getOrganizationsWhereUserIsSingleOwner).toHaveBeenCalledWith("sole-owner-user");
    expect(getIsMultiOrgEnabled).toHaveBeenCalledTimes(1);
  });
});
