import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { isOrganizationMemberEmail, resolveEmailActorUserId } from "./email-actor";

vi.mock("@formbricks/database", () => ({ prisma: { membership: { findFirst: vi.fn() } } }));

describe("resolveEmailActorUserId", () => {
  beforeEach(() => vi.mocked(prisma.membership.findFirst).mockReset());

  test("uses the owner the server set, without a lookup", async () => {
    await expect(resolveEmailActorUserId("owner-1", "org-1")).resolves.toBe("owner-1");
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
  });

  // Charging nobody would let one account reset its budget with fresh organizations and API keys.
  test("charges the same owner of the organization every time when there is no owner", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({ userId: "org-owner" } as never);

    await expect(resolveEmailActorUserId(null, "org-1")).resolves.toBe("org-owner");
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-1", role: "owner" },
      orderBy: { userId: "asc" },
      select: { userId: true },
    });
  });

  test("leaves only the organization's cap when the organization has no owner", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

    await expect(resolveEmailActorUserId(null, "org-1")).resolves.toBeNull();
  });
});

describe("isOrganizationMemberEmail", () => {
  beforeEach(() => vi.mocked(prisma.membership.findFirst).mockReset());

  test("matches the address the way accounts store it", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({ userId: "u1" } as never);

    await expect(isOrganizationMemberEmail("org-1", " Team@Example.com ")).resolves.toBe(true);
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-1", user: { email: "team@example.com" } },
      select: { userId: true },
    });
  });

  test("is false for an address outside the organization", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

    await expect(isOrganizationMemberEmail("org-1", "stranger@example.com")).resolves.toBe(false);
  });
});
