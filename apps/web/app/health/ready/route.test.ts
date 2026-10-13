import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET } from "./route";

const fixtures = vi.hoisted(() => ({ mode: "online", workers: true }));
vi.mock("@/lib/env", () => ({
  env: {
    get FORMBRICKS_UPGRADE_MODE() {
      return fixtures.mode;
    },
  },
}));
vi.mock("@/lib/jobs/config", () => ({ getJobsWorkerBootstrapConfig: () => ({ enabled: fixtures.workers }) }));
beforeEach(() => {
  prisma.$queryRaw.mockResolvedValue([{ ready: true }]);
  fixtures.mode = "online";
  fixtures.workers = true;
  prisma.onlineUpgradeState.findUnique.mockResolvedValue({ completedPhases: ["prepare"] } as never);
  vi.stubGlobal("formbricksJobsRuntime", {});
  vi.stubGlobal("formbricksOnlinePauseDelivery", {});
  vi.stubGlobal("formbricksServerLifecycle", { draining: false });
});
afterEach(() => vi.unstubAllGlobals());

test("prepared replicas serve before feature activation", async () => {
  expect((await GET()).status).toBe(200);
});
test("required workers and independent revocation delivery must both be started", async () => {
  vi.stubGlobal("formbricksJobsRuntime", undefined);
  expect((await GET()).status).toBe(503);
  vi.stubGlobal("formbricksJobsRuntime", {});
  vi.stubGlobal("formbricksOnlinePauseDelivery", undefined);
  expect((await GET()).status).toBe(503);
});
test("missing preparation and draining replicas stay outside endpoints", async () => {
  prisma.onlineUpgradeState.findUnique.mockResolvedValueOnce(null);
  expect((await GET()).status).toBe(503);
  vi.stubGlobal("formbricksServerLifecycle", { draining: true });
  expect((await GET()).status).toBe(503);
});

test("requires a valid unique bootstrap index even with a preparation checkpoint", async () => {
  prisma.$queryRaw.mockResolvedValue([{ ready: false }]);
  expect((await GET()).status).toBe(503);
});
test("fails closed on catalog errors", async () => {
  prisma.$queryRaw.mockRejectedValue(new Error("connection lost"));
  expect((await GET()).status).toBe(503);
});
