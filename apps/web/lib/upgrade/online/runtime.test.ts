import { beforeEach, expect, test, vi } from "vitest";
import { openUpgradeSession, readOnlineUpgradeCheckpoint } from "@formbricks/database/upgrade-session";
import { type OnlinePlatform, runOnlineCommand } from "./runtime";

vi.mock("@formbricks/jobs", () => ({ openJobsUpgradeQueue: vi.fn() }));
vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@formbricks/database/upgrade-session", () => ({
  openUpgradeSession: vi.fn(),
  readOnlineUpgradeCheckpoint: vi.fn(),
  applyOnlineSchemaMigrations: vi.fn(),
}));
vi.mock("@/lib/authzed/client", () => ({ closeAuthzedClient: vi.fn() }));
vi.mock("@/lib/authzed/schema", () => ({
  applyCanonicalAuthzedSchema: vi.fn(),
  checkCanonicalAuthzedSchema: vi.fn(),
}));
vi.mock("@/lib/authzed/scope-readiness", () => ({ setProjectionScopeReady: vi.fn() }));
vi.mock("./projection", () => ({ backfillOnlineSurveys: vi.fn(), verifyOnlineProjection: vi.fn() }));
vi.mock("@/lib/env", () => ({
  env: { MIGRATE_DATABASE_URL: "postgresql://fixture@localhost/test", FORMBRICKS_UPGRADE_MODE: "online" },
}));
const platform: OnlinePlatform = {
  targetImage: "app@sha256:target",
  sourceVersion: "6.0.2",
  sessionAffinity: true,
  preflight: vi.fn(),
  retireSourceConsumers: vi.fn(),
  jobDrainTimeoutSeconds: 180,
  verifySourceConsumersAbsent: vi.fn(),
  verifyConsumers: vi.fn(),
};
const root = new URL("file:///fixture/");
beforeEach(() => {
  vi.clearAllMocks();
});

test("unknown checkpoint state never advertises safe rollback or leaks connection errors", async () => {
  vi.mocked(readOnlineUpgradeCheckpoint).mockRejectedValue(new Error("credential=must-not-appear"));
  const result = await runOnlineCommand("status", platform, root);
  expect(result).toMatchObject({
    status: "blocked",
    blockerCode: "online_upgrade_failed",
    rollbackTo60Allowed: false,
  });
  expect(JSON.stringify(result)).not.toContain("must-not-appear");
});

test("a known absent checkpoint allows rollback without acquiring the coordinator lock", async () => {
  vi.mocked(readOnlineUpgradeCheckpoint).mockResolvedValue(null);
  expect(await runOnlineCommand("status", platform, root)).toMatchObject({
    status: "not_started",
    rollbackTo60Allowed: true,
  });
  expect(openUpgradeSession).not.toHaveBeenCalled();
});

test("status preserves the durable forward-only boundary", async () => {
  vi.mocked(readOnlineUpgradeCheckpoint).mockResolvedValue({
    phase: "finalizing",
    completedPhases: ["prepare"],
    forwardOnlyAt: new Date(),
    surveyCount: 23n,
  });
  expect(await runOnlineCommand("status", platform, root)).toMatchObject({
    status: "in_progress",
    progress: { surveys: "23" },
    rollbackTo60Allowed: false,
  });
});

test("non-affine configuration fails before opening a connection", async () => {
  expect(await runOnlineCommand("prepare", { ...platform, sessionAffinity: false }, root)).toMatchObject({
    status: "blocked",
    blockerCode: "session_affine_migration_connection_required",
    rollbackTo60Allowed: false,
  });
  expect(openUpgradeSession).not.toHaveBeenCalled();
});
