import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { isOrganizationManagerRole, requireV3OrganizationManager } from "./access";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));

const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const person = { user: { id: "user_1" }, expires: "2099-01-01" } as never;
const apiKey = { apiKeyId: "key_1", organizationId, workspacePermissions: [] } as never;

const run = (authentication: unknown) =>
  requireV3OrganizationManager(authentication as never, organizationId, "req_1", "/api/mcp");

describe("isOrganizationManagerRole", () => {
  test("owner and manager only", () => {
    expect(["owner", "manager"].map((role) => isOrganizationManagerRole(role as never))).toEqual([
      true,
      true,
    ]);
    for (const role of ["member", "billing", null, undefined]) {
      expect(isOrganizationManagerRole(role as never)).toBe(false);
    }
  });
});

describe("requireV3OrganizationManager", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "manager" } as never);
  });

  test("returns the user id and the role the person holds", async () => {
    expect(await run(person)).toEqual({ userId: "user_1", role: "manager" });
    expect(getMembershipByUserIdOrganizationId).toHaveBeenCalledExactlyOnceWith("user_1", organizationId);
  });

  test("no authentication is 401; an API key is 403 before any lookup", async () => {
    expect((await run(null)) as Response).toMatchObject({ status: 401 });
    expect((await run(apiKey)) as Response).toMatchObject({ status: 403 });
    expect(can).not.toHaveBeenCalled();
  });

  test("a graph refusal is 403 and the role is not even read", async () => {
    vi.mocked(can).mockResolvedValue(false);

    expect((await run(person)) as Response).toMatchObject({ status: 403 });
    expect(getMembershipByUserIdOrganizationId).not.toHaveBeenCalled();
  });

  test("fails closed when the graph says yes but the membership is not owner or manager, or is missing", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "member" } as never);
    expect((await run(person)) as Response).toMatchObject({ status: 403 });

    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);
    expect((await run(person)) as Response).toMatchObject({ status: 403 });
  });
});
