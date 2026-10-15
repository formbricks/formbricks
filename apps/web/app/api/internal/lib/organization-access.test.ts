import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireOrgActionAccess } from "./organization-access";

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
