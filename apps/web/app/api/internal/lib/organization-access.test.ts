import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  USER_MANAGEMENT_NOT_ALLOWED_DETAIL,
  requireOrgActionAccess,
  requireUserManagementAccess,
} from "./organization-access";

const { mockCan } = vi.hoisted(() => ({ mockCan: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: mockCan }));

const USER_ID = "user_1";
const session = { user: { id: USER_ID }, expires: "2099-01-01" } as never;

describe("requireOrgActionAccess", () => {
  const checkWithoutLicence = (authentication = session) =>
    requireOrgActionAccess({
      authentication,
      organizationId: "org_1",
      action: "organization.manage_access",
      requestId: "req_1",
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockResolvedValue(true);
  });

  test("authorizes a caller who may take the action on the organization", async () => {
    await expect(checkWithoutLicence()).resolves.toEqual({ organizationId: "org_1", userId: USER_ID });
    expect(mockCan).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage_access", {
      type: "organization",
      id: "org_1",
    });
  });

  test("still refuses a caller without the action, and one without a session", async () => {
    mockCan.mockResolvedValue(false);
    expect(((await checkWithoutLicence()) as Response).status).toBe(403);
    expect(((await checkWithoutLicence(null as never)) as Response).status).toBe(401);
  });
});

describe("requireUserManagementAccess", () => {
  const check = (authentication = session) =>
    requireUserManagementAccess({ authentication, organizationId: "org_1", requestId: "req_1" });
  const asked = () => mockCan.mock.calls.map(([, action]) => action);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockResolvedValue(true);
  });

  test("asks the user-management floor, then organization.manage", async () => {
    await expect(check()).resolves.toEqual({ organizationId: "org_1", userId: USER_ID });
    expect(asked()).toEqual(["organization.manage_access", "organization.manage"]);
  });

  test("refuses below the floor with its reason, without asking organization.manage", async () => {
    mockCan.mockResolvedValueOnce(false);

    const response = (await check()) as Response;

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe(USER_MANAGEMENT_NOT_ALLOWED_DETAIL);
    expect(asked()).toEqual(["organization.manage_access"]);
  });

  test("refuses without organization.manage with the uniform 403, and without a session with 401", async () => {
    mockCan.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const refused = (await check()) as Response;
    expect(refused.status).toBe(403);
    expect((await refused.json()).detail).not.toBe(USER_MANAGEMENT_NOT_ALLOWED_DETAIL);

    expect(((await check(null as never)) as Response).status).toBe(401);
  });
});
