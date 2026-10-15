import { expect, test, vi } from "vitest";
import {
  type OnlineDependencies,
  type OnlineState,
  OnlineUpgradeBlocked,
  describeOnlineFailure,
  runOnlineUpgrade,
  summarizeOnlineState,
  toOnlineBlocker,
} from "./coordinator";

const setup = () => {
  let state: OnlineState | null = null;
  const noop = () => vi.fn(async () => {});
  const deps: OnlineDependencies = {
    targetImage: "app@sha256:target",
    assertLock: noop(),
    read: async () => state,
    save: async (patch) => {
      state = {
        targetImage: "app@sha256:target",
        phase: "preflight",
        completedPhases: [],
        surveyCursor: null,
        surveyCount: 0n,
        baselineCompletedAt: null,
        forwardOnlyAt: null,
        activatedAt: null,
        queuePausedAt: null,
        queuePauseDeadlineAt: null,
        queueResumedAt: null,
        ...state,
        ...patch,
      };
    },
    preflight: noop(),
    prepare: noop(),
    verifyPrepared: noop(),
    verifyConsumers: noop(),
    finalizeMigrations: noop(),
    backfill: noop(),
    verifyProjection: noop(),
    activate: noop(),
  };
  return deps;
};

test("preparation keeps rollback possible; finalization activates only after all postconditions", async () => {
  const deps = setup();
  expect((await runOnlineUpgrade("prepare", deps)).rollbackTo60Allowed).toBe(true);
  const result = await runOnlineUpgrade("finalize", deps);
  expect(result).toMatchObject({ status: "complete", rollbackTo60Allowed: false });
  expect(deps.verifyConsumers).toHaveBeenCalledTimes(2);
  expect(deps.activate).toHaveBeenCalledOnce();
});

test("an old consumer blocks before crossing the rollback boundary", async () => {
  const deps = setup();
  await runOnlineUpgrade("prepare", deps);
  deps.verifyConsumers = vi.fn(async () => {
    throw new OnlineUpgradeBlocked("old_consumer_present", true);
  });
  await expect(runOnlineUpgrade("finalize", deps)).rejects.toThrow("old_consumer_present");
  expect((await deps.read())?.forwardOnlyAt).toBeNull();
  expect(deps.finalizeMigrations).not.toHaveBeenCalled();
});

test("an interrupted backfill is forward-only and retries without premature activation", async () => {
  const deps = setup();
  await runOnlineUpgrade("prepare", deps);
  deps.backfill = vi.fn().mockRejectedValueOnce(new Error("interrupted")).mockResolvedValue(undefined);
  await expect(runOnlineUpgrade("finalize", deps)).rejects.toThrow("interrupted");
  expect(summarizeOnlineState(await deps.read())).toMatchObject({
    rollbackTo60Allowed: false,
    phase: "finalizing",
  });
  expect(deps.activate).not.toHaveBeenCalled();
  expect((await runOnlineUpgrade("finalize", deps)).status).toBe("complete");
});

test("lock loss prevents the next mutation and target changes cannot reuse checkpoints", async () => {
  const deps = setup();
  deps.assertLock = vi.fn(async () => {
    throw new Error("lock_lost");
  });
  await expect(runOnlineUpgrade("prepare", deps)).rejects.toThrow("lock_lost");
  expect(deps.prepare).not.toHaveBeenCalled();
  deps.assertLock = vi.fn(async () => {});
  await runOnlineUpgrade("prepare", deps);
  deps.targetImage = "app@sha256:other";
  await expect(runOnlineUpgrade("finalize", deps)).rejects.toThrow("target_identity_changed");
});

test("failed surge cleanup retains activation but does not report completion", async () => {
  const deps = setup();
  await runOnlineUpgrade("prepare", deps);
  deps.cleanup = vi.fn(async () => {
    throw new OnlineUpgradeBlocked("handoff_pending", true);
  });
  await expect(runOnlineUpgrade("finalize", deps)).rejects.toThrow("handoff_pending");
  expect(summarizeOnlineState(await deps.read())).toMatchObject({
    status: "in_progress",
    phase: "cleanup",
    rollbackTo60Allowed: false,
  });
});

test("resuming activated cleanup does not repeat finalization or activation", async () => {
  const deps = setup();
  await runOnlineUpgrade("prepare", deps);
  deps.cleanup = vi.fn().mockRejectedValueOnce(new Error("interrupted")).mockResolvedValue(undefined);
  await expect(runOnlineUpgrade("finalize", deps)).rejects.toThrow("interrupted");
  expect((await runOnlineUpgrade("finalize", deps)).status).toBe("complete");
  expect(deps.cleanup).toHaveBeenCalledTimes(2);
  expect(deps.activate).toHaveBeenCalledOnce();
  expect(deps.finalizeMigrations).toHaveBeenCalledOnce();
  expect((await runOnlineUpgrade("prepare", deps)).status).toBe("complete");
  expect((await runOnlineUpgrade("finalize", deps)).status).toBe("complete");
  expect(deps.cleanup).toHaveBeenCalledTimes(2);
});

test("an unexpected failure is described by its class and code, never its message", () => {
  const secret = "postgresql://formbricks:password@db/formbricks";
  class PrismaClientInitializationError extends Error {
    name = "PrismaClientInitializationError";
    code = "P1001";
  }
  expect(describeOnlineFailure(new PrismaClientInitializationError(secret))).toEqual({
    name: "PrismaClientInitializationError",
    code: "P1001",
  });
  expect(describeOnlineFailure(Object.assign(new Error(secret), { code: 403 }))).toEqual({
    name: "Error",
    code: "403",
  });
  // Anything but a short identifier could be a payload, so it is dropped rather than copied.
  for (const code of [secret, "A".repeat(65), 1.5])
    expect(describeOnlineFailure(Object.assign(new Error(secret), { code }))).toEqual({
      name: "Error",
      code: null,
    });
  expect(describeOnlineFailure(Object.assign(new Error(secret), { name: secret }))).toEqual({
    name: "Error",
    code: null,
  });
  expect(describeOnlineFailure(secret)).toEqual({ name: "string", code: null });

  const reported = summarizeOnlineState(
    null,
    toOnlineBlocker(new Error(secret), "online_upgrade_failed", true)
  );
  expect(reported).toMatchObject({
    blockerCode: "online_upgrade_failed",
    cause: { name: "Error", code: null },
  });
  expect(JSON.stringify(reported)).not.toContain("password");
});

test("a deliberate blocker is reported as raised, without a cause", () => {
  const blocker = new OnlineUpgradeBlocked("unknown_source_schema");
  expect(toOnlineBlocker(blocker, "online_upgrade_failed", true)).toBe(blocker);
  expect(summarizeOnlineState(null, blocker)).not.toHaveProperty("cause");
});
