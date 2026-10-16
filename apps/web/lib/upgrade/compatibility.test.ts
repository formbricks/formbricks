import { beforeEach, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { assertNewReleaseWorkEnabled, isNewReleaseWorkEnabled } from "./compatibility";

vi.mock("@formbricks/database", () => ({ prisma: { onlineUpgradeState: { findUnique: vi.fn() } } }));
const mockEnv = vi.hoisted(() => ({ FORMBRICKS_UPGRADE_MODE: "online" }));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.FORMBRICKS_UPGRADE_MODE = "online";
});

test("missing or unactivated state cannot enable an incompatible producer", async () => {
  vi.mocked(prisma.onlineUpgradeState.findUnique).mockResolvedValue(null);
  await expect(isNewReleaseWorkEnabled()).resolves.toBe(false);
  vi.mocked(prisma.onlineUpgradeState.findUnique).mockResolvedValue({ activatedAt: null } as never);
  await expect(assertNewReleaseWorkEnabled()).rejects.toThrow("until the online upgrade completes");
});

test("already running processes observe durable activation without a redeployment", async () => {
  vi.mocked(prisma.onlineUpgradeState.findUnique).mockResolvedValueOnce({ activatedAt: null } as never);
  await expect(isNewReleaseWorkEnabled()).resolves.toBe(false);
  vi.mocked(prisma.onlineUpgradeState.findUnique).mockResolvedValueOnce({ activatedAt: new Date() } as never);
  await expect(isNewReleaseWorkEnabled()).resolves.toBe(true);
});

test("a failed state read cannot activate producers", async () => {
  vi.mocked(prisma.onlineUpgradeState.findUnique).mockRejectedValue(new Error("unavailable"));
  await expect(isNewReleaseWorkEnabled()).rejects.toThrow("unavailable");
});

test("the existing maintenance path does not need an online checkpoint", async () => {
  mockEnv.FORMBRICKS_UPGRADE_MODE = "maintenance";
  await expect(isNewReleaseWorkEnabled()).resolves.toBe(true);
  expect(prisma.onlineUpgradeState.findUnique).not.toHaveBeenCalled();
});
