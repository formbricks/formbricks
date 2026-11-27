import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { requireV3OrganizationAccess } from "./organization-access";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })) },
}));

const organizationId = "clorg00000000000000000001";
const session = { user: { id: "cluser0000000000000000001" }, expires: "" };
const apiKey = (orgId: string) => ({
  type: "apiKey" as const,
  apiKeyId: "clkey00000000000000000001",
  organizationId: orgId,
  workspacePermissions: [],
  organizationAccess: { accessControl: { read: true, write: false } },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("requireV3OrganizationAccess", () => {
  test("asks owner-or-manager (organization.manage) of a session read, and manage_access of a write", async () => {
    vi.mocked(can).mockResolvedValue(true);
    await requireV3OrganizationAccess(session, organizationId, "read", "req");
    await requireV3OrganizationAccess(session, organizationId, "write", "req");
    expect(vi.mocked(can).mock.calls.map(([, action]) => action)).toEqual([
      "organization.manage",
      "organization.manage_access",
    ]);
  });

  test("asks Access Control read of an API key read, and write of a write", async () => {
    vi.mocked(can).mockResolvedValue(true);
    await requireV3OrganizationAccess(apiKey(organizationId), organizationId, "read", "req");
    await requireV3OrganizationAccess(apiKey(organizationId), organizationId, "write", "req");
    expect(vi.mocked(can).mock.calls.map(([actor, action]) => [actor.type, action])).toEqual([
      ["apiKey", "organization.read_access"],
      ["apiKey", "organization.manage_access"],
    ]);
  });

  test("refuses an API key of another organization without asking", async () => {
    vi.mocked(can).mockResolvedValue(true);
    const result = await requireV3OrganizationAccess(
      apiKey("clother000000000000000001"),
      organizationId,
      "read",
      "req"
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(can).not.toHaveBeenCalled();
  });

  test("answers 403 when refused and when the organization does not exist", async () => {
    vi.mocked(can).mockResolvedValueOnce(false);
    expect(
      ((await requireV3OrganizationAccess(session, organizationId, "read", "req")) as Response).status
    ).toBe(403);
    vi.mocked(can).mockRejectedValueOnce(new ResourceNotFoundError("Organization", organizationId));
    expect(
      ((await requireV3OrganizationAccess(session, organizationId, "read", "req")) as Response).status
    ).toBe(403);
  });

  test("answers 401 without authentication and returns the organization when allowed", async () => {
    expect(
      ((await requireV3OrganizationAccess(null, organizationId, "read", "req")) as Response).status
    ).toBe(401);
    vi.mocked(can).mockResolvedValue(true);
    expect(await requireV3OrganizationAccess(session, organizationId, "read", "req")).toEqual({
      organizationId,
    });
  });
});
