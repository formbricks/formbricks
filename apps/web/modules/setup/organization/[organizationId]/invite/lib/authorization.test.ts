import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
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

describe("checkSetupInviteAuthorization", () => {
  test("requires the owner-only organization write capability", async () => {
    vi.mocked(assertCan).mockResolvedValue(undefined);

    await expect(checkSetupInviteAuthorization(userId, organizationId)).resolves.toBeUndefined();

    expect(assertCan).toHaveBeenCalledExactlyOnceWith(actor, "organization.write", resource);
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

    expect(can).toHaveBeenCalledExactlyOnceWith(actor, "organization.write", resource);
  });

  test("propagates an operational evaluator failure", async () => {
    const failure = new Error("authorization unavailable");
    vi.mocked(can).mockRejectedValue(failure);

    await expect(hasSetupInviteAccess(userId, organizationId)).rejects.toBe(failure);
  });
});
