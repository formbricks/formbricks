import { type Mock, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { OrganizationRole } from "@formbricks/database/prisma";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { checkAuthenticationAndAccess } from "../utils";

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...actual, cache: vi.fn((fn: unknown) => fn) };
});

vi.mock("@/lib/constants", () => ({
  USER_MANAGEMENT_MINIMUM_ROLE: "manager",
}));

vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  pickCommonFilter: vi.fn(),
  buildCommonFilterQuery: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    apiKey: { findUnique: vi.fn() },
    membership: { findUnique: vi.fn() },
    organization: { findFirst: vi.fn() },
  },
}));

const apiKeyFindUnique = prisma.apiKey.findUnique as unknown as Mock;
const membershipFindUnique = prisma.membership.findUnique as unknown as Mock;
const organizationFindFirst = prisma.organization.findFirst as unknown as Mock;

// An org-scoped key that already clears every check the write routes made before this guard existed:
// the organization id matches and `accessControl.write` is granted. So every case below turns on the
// creator's current role alone, which is the whole point of the clamp.
const authentication: TAuthenticationApiKey = {
  type: "apiKey",
  apiKeyId: "apiKey123",
  organizationId: "org123",
  workspacePermissions: [],
  organizationAccess: { accessControl: { read: true, write: true } },
};

const mockCreatorRole = (role: OrganizationRole | null) => {
  apiKeyFindUnique.mockResolvedValue({ createdBy: "user123" });
  membershipFindUnique.mockResolvedValue(role ? { role } : null);
};

describe("checkAuthenticationAndAccess", () => {
  beforeEach(() => {
    apiKeyFindUnique.mockReset();
    membershipFindUnique.mockReset();
    organizationFindFirst.mockReset();
    organizationFindFirst.mockResolvedValue({ id: "org123" });
  });

  test.each([OrganizationRole.owner, OrganizationRole.manager])(
    "allows the write when the key creator is still an %s",
    async (role) => {
      mockCreatorRole(role);

      const result = await checkAuthenticationAndAccess("team123", "workspace123", authentication);

      expect(result.ok).toBe(true);
      expect(organizationFindFirst).toHaveBeenCalled();
    }
  );

  test.each([OrganizationRole.member, OrganizationRole.billing])(
    "refuses the write when the key creator has been demoted to %s",
    async (role) => {
      mockCreatorRole(role);

      const result = await checkAuthenticationAndAccess("team123", "workspace123", authentication);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("forbidden");
        expect(result.error.details?.[0].field).toBe("apiKey");
      }
    }
  );

  test("refuses the write when the key creator is no longer a member of the organization", async () => {
    mockCreatorRole(null);

    const result = await checkAuthenticationAndAccess("team123", "workspace123", authentication);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("forbidden");
    }
  });

  test("refuses the write for a legacy key that records no creator", async () => {
    apiKeyFindUnique.mockResolvedValue({ createdBy: null });

    const result = await checkAuthenticationAndAccess("team123", "workspace123", authentication);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("forbidden");
    }
  });

  // A refused caller must not learn which ids exist: running the lookup first would answer with
  // not_found for a made-up team and forbidden for a real one, turning the error into an id oracle.
  test("does not look up the team or workspace when the creator role check fails", async () => {
    mockCreatorRole(OrganizationRole.member);

    await checkAuthenticationAndAccess("team123", "workspace123", authentication);

    expect(organizationFindFirst).not.toHaveBeenCalled();
  });

  test("still refuses a team or workspace outside the organization once the role check passes", async () => {
    mockCreatorRole(OrganizationRole.owner);
    organizationFindFirst.mockResolvedValue(null);

    const result = await checkAuthenticationAndAccess("team123", "workspace123", authentication);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("not_found");
    }
  });
});
