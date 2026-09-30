import { beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { assertCanGrantOrganizationAccess, canGrantOrganizationWriteAccess } from "./organization-access";

vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));

const userId = "user-1";
const organizationId = "org-1";

const access = (read: boolean, write: boolean): TOrganizationAccess => ({ accessControl: { read, write } });

/**
 * `{ read: false, write: true }` is the shape the modal never produces but the action accepts, so it
 * is the one a direct call would use. Covering only `{ read: true, write: true }` lets a guard written
 * as `read && write` pass while leaving that call open.
 */
const WRITE_ACCESS = [
  ["read and write", access(true, true)],
  ["write without read", access(false, true)],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canGrantOrganizationWriteAccess", () => {
  test("asks organization.manage_access, the floor's central-vocabulary name", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(canGrantOrganizationWriteAccess(userId, organizationId)).resolves.toBe(true);
    expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, "organization.manage_access", {
      type: "organization",
      id: organizationId,
    });
  });

  test("reports the denial rather than swallowing it", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(canGrantOrganizationWriteAccess(userId, organizationId)).resolves.toBe(false);
  });
});

describe("assertCanGrantOrganizationAccess", () => {
  test.each(WRITE_ACCESS)("refuses %s when the creator does not clear the floor", async (_label, granted) => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(assertCanGrantOrganizationAccess(userId, organizationId, granted)).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  test.each(WRITE_ACCESS)("allows %s when the creator clears the floor", async (_label, granted) => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(assertCanGrantOrganizationAccess(userId, organizationId, granted)).resolves.toBeUndefined();
  });

  // Read-only org access is not floor-gated: the v2 GET routes ask only for `organizationAccess.read`,
  // so requiring the floor here would refuse keys the API would happily serve.
  test.each([
    ["read-only", access(true, false)],
    ["no organization access", access(false, false)],
  ])("does not consult the floor for %s", async (_label, granted) => {
    await expect(assertCanGrantOrganizationAccess(userId, organizationId, granted)).resolves.toBeUndefined();
    expect(can).not.toHaveBeenCalled();
  });
});
