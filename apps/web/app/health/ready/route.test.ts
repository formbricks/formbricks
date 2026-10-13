import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET } from "./route";

const fixtures = vi.hoisted(() => ({ read: vi.fn(), mode: "online", workers: true }));
vi.mock("@formbricks/database", () => ({ prisma: { onlineUpgradeState: { findUnique: fixtures.read } } }));
vi.mock("@/lib/env", () => ({
  env: {
    get FORMBRICKS_UPGRADE_MODE() {
      return fixtures.mode;
    },
  },
}));
vi.mock("@/lib/jobs/config", () => ({ getJobsWorkerBootstrapConfig: () => ({ enabled: fixtures.workers }) }));
beforeEach(() => {
  fixtures.mode = "online";
  fixtures.workers = true;
  fixtures.read.mockReset().mockResolvedValue({ completedPhases: ["prepare"] });
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
  fixtures.read.mockResolvedValueOnce(null);
  expect((await GET()).status).toBe(503);
  vi.stubGlobal("formbricksServerLifecycle", { draining: true });
  expect((await GET()).status).toBe(503);
});
