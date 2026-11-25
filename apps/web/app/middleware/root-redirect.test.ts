import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getUnauthenticatedRootRedirectPath } from "./root-redirect";

vi.mock("@formbricks/database", () => ({
  prisma: {
    instanceSetup: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    organization: { findFirst: vi.fn() },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.instanceSetup.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
});

describe("getUnauthenticatedRootRedirectPath", () => {
  test("sends a never-set-up instance to the setup intro", async () => {
    await expect(getUnauthenticatedRootRedirectPath()).resolves.toBe("/setup/intro");
  });

  test("sends a set-up instance with no users left to login, not the setup intro (ENG-7313)", async () => {
    vi.mocked(prisma.instanceSetup.findUnique).mockResolvedValue({ id: "instance" } as never);

    await expect(getUnauthenticatedRootRedirectPath()).resolves.toBe("/auth/login");
    expect(prisma.instanceSetup.findUnique).toHaveBeenCalledWith({
      where: { id: "instance" },
      select: { id: true },
    });
    // The marker answers alone: a set-up instance costs one lookup.
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  test("sends an instance with a user but no marker to login", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user_1" } as never);

    await expect(getUnauthenticatedRootRedirectPath()).resolves.toBe("/auth/login");
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  test("sends an instance with only an organization to login", async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: "org_1" } as never);

    await expect(getUnauthenticatedRootRedirectPath()).resolves.toBe("/auth/login");
  });
});
