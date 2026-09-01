import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { assertCanRecheckLicense } from "./recheck-authorization";

vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));

describe("assertCanRecheckLicense", () => {
  const userId = "user-1";
  const organizationId = "org-1";
  const actor = { type: "user", id: userId } as const;
  const organization = { type: "organization", id: organizationId } as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("allows a caller who can manage the organization", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await expect(assertCanRecheckLicense(userId, organizationId)).resolves.toBeUndefined();

    expect(can).toHaveBeenCalledWith(actor, "organization.read", organization);
    expect(can).toHaveBeenCalledWith(actor, "organization.manage", organization);
  });

  test("reports a non-member as a non-member, without asking about management", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await expect(assertCanRecheckLicense(userId, organizationId)).rejects.toThrow(AuthenticationError);

    expect(can).toHaveBeenCalledTimes(1);
  });

  // The ENG-1737 behavior change. `billing` and `member` both hold a membership and both fail
  // `organization.manage`; the old check named `member` and so let `billing` through.
  test("refuses a member who cannot manage the organization", async () => {
    vi.mocked(can).mockImplementation(async (_actor, action) => action === "organization.read");

    await expect(assertCanRecheckLicense(userId, organizationId)).rejects.toThrow(
      new OperationNotAllowedError("Only owners and managers can recheck license")
    );
  });

  test("propagates an evaluator failure instead of turning it into a denial", async () => {
    vi.mocked(can).mockRejectedValue(new Error("database unavailable"));

    await expect(assertCanRecheckLicense(userId, organizationId)).rejects.toThrow("database unavailable");
  });
});
