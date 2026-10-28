import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getFirstWorkspaceId, getOrganizationMemberCount } from "./license-counts";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: { membership: { count: vi.fn() }, workspace: { findFirst: vi.fn() } },
}));

const organizationId = "clh1234567890abcdefghijkl";

describe("license counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("counts memberships of the organization only", async () => {
    vi.mocked(prisma.membership.count).mockResolvedValue(7);

    expect(await getOrganizationMemberCount(organizationId)).toBe(7);
    expect(prisma.membership.count).toHaveBeenCalledWith({ where: { organizationId } });
  });

  test("returns the id of one workspace, or null when the organization has none", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValueOnce({ id: "ws-1" } as never);
    expect(await getFirstWorkspaceId(organizationId)).toBe("ws-1");

    vi.mocked(prisma.workspace.findFirst).mockResolvedValueOnce(null);
    expect(await getFirstWorkspaceId(`${organizationId}`)).toBeNull();
    expect(prisma.workspace.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId }, select: { id: true } })
    );
  });
});
