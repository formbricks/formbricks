import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, expect, test, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/env", () => ({ env: { FORMBRICKS_UPGRADE_MODE: "online" } }));
vi.mock("@/lib/jobs/config", () => ({ getJobsWorkerBootstrapConfig: () => ({ enabled: false }) }));
vi.mock("@/lib/upgrade/compatibility", () => ({ ONLINE_UPGRADE_RELEASE: "6.1" }));

beforeEach(() => {
  vi.resetAllMocks();
  prisma.onlineUpgradeState.findUnique.mockResolvedValue({ completedPhases: ["prepare"] } as never);
  prisma.$queryRaw.mockResolvedValue([{ ready: true }]);
});

test("requires a valid unique bootstrap index even with a preparation checkpoint", async () => {
  prisma.$queryRaw.mockResolvedValue([{ ready: false }]);
  expect((await GET()).status).toBe(503);
});
test("becomes ready after preparation and bootstrap constraint validation", async () => {
  expect((await GET()).status).toBe(200);
});
test("fails closed on catalog errors", async () => {
  prisma.$queryRaw.mockRejectedValue(new Error("connection lost"));
  expect((await GET()).status).toBe(503);
});
