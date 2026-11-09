import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { assertCan, can } from "@/lib/authorization";
import { checkSetupInviteAuthorization, hasSetupInviteAccess } from "./authorization";

vi.mock("@/lib/authorization", () => ({
  assertCan: vi.fn(),
  can: vi.fn(),
}));

const userId = "test-user-id";
const organizationId = "test-organization-id";
const actor = { id: userId, type: "user" } as const;
const resource = { id: organizationId, type: "organization" } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

/** `organization.manage_access` is the user-management floor; everything else is granted. */
const floorAllows = (allowed: boolean) =>
  vi
    .mocked(can)
    .mockImplementation(async (_actor, action) => action !== "organization.manage_access" || allowed);

describe("checkSetupInviteAuthorization", () => {
  test("requires the owner-only organization write capability", async () => {
    vi.mocked(assertCan).mockResolvedValue(undefined);
    floorAllows(true);

    await expect(checkSetupInviteAuthorization(userId, organizationId)).resolves.toBeUndefined();

    expect(assertCan).toHaveBeenCalledExactlyOnceWith(actor, "organization.write", resource);
  });

  // ENG-6812: the onboarding invite (always an owner invite) skipped the floor, so it still worked under
  // USER_MANAGEMENT_MINIMUM_ROLE=disabled.
  test("refuses an owner below the user-management floor", async () => {
    vi.mocked(assertCan).mockResolvedValue(undefined);
    floorAllows(false);

    await expect(checkSetupInviteAuthorization(userId, organizationId)).rejects.toBeInstanceOf(
      OperationNotAllowedError
    );
    expect(can).toHaveBeenCalledWith(actor, "organization.manage_access", resource);
  });

  test("preserves the central denial contract", async () => {
    vi.mocked(assertCan).mockRejectedValue(new AuthorizationError("Not authorized"));

    await expect(checkSetupInviteAuthorization(userId, organizationId)).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });
});

describe("hasSetupInviteAccess", () => {
  test.each([true, false])("returns the central decision (%s)", async (decision) => {
    vi.mocked(can).mockResolvedValue(decision);

    await expect(hasSetupInviteAccess(userId, organizationId)).resolves.toBe(decision);

    expect(can).toHaveBeenCalledWith(actor, "organization.write", resource);
  });

  test("is false for an owner below the user-management floor", async () => {
    floorAllows(false);

    await expect(hasSetupInviteAccess(userId, organizationId)).resolves.toBe(false);
  });

  test("propagates an operational evaluator failure", async () => {
    const failure = new Error("authorization unavailable");
    vi.mocked(can).mockRejectedValue(failure);

    await expect(hasSetupInviteAccess(userId, organizationId)).rejects.toBe(failure);
  });
});
