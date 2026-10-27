import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getOrganizationMemberEmails, resolveEmailActorUserId } from "./email-actor";

vi.mock("@formbricks/database", () => ({
  prisma: { membership: { findFirst: vi.fn(), findMany: vi.fn() } },
}));

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

describe("getOrganizationMemberEmails", () => {
  beforeEach(() => vi.mocked(prisma.membership.findMany).mockReset());

  test("resolves every address in one query, matched the way accounts store them", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { user: { email: "team@example.com" } },
    ] as never);

    await expect(
      getOrganizationMemberEmails("org-1", [" Team@Example.com ", "team@example.com", "stranger@example.com"])
    ).resolves.toEqual(new Set(["team@example.com"]));
    expect(prisma.membership.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        user: { email: { in: ["team@example.com", "stranger@example.com"] } },
      },
      select: { user: { select: { email: true } } },
    });
  });

  test("does not query when no address names a literal recipient", async () => {
    await expect(getOrganizationMemberEmails("org-1", [])).resolves.toEqual(new Set());
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });
});
