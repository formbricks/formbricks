export const ONLINE_PHASES = ["prepare", "finalize", "activate"] as const;
export type OnlinePhase = (typeof ONLINE_PHASES)[number];

export type OnlineState = {
  targetImage: string;
  completedPhases: string[];
  phase: string;
  surveyCursor: string | null;
  surveyCount: bigint;
  baselineCompletedAt: Date | null;
  forwardOnlyAt: Date | null;
  activatedAt: Date | null;
  queuePausedAt: Date | null;
  queuePauseDeadlineAt: Date | null;
  queueResumedAt: Date | null;
};

export class OnlineUpgradeBlocked extends Error {
  constructor(
    readonly code: string,
    readonly retryable = false
  ) {
    super(code);
  }
}

export type OnlineStatus = {
  status: "blocked" | "prepared" | "complete" | "not_started" | "in_progress";
  phase: string;
  progress: { surveys: string; baselineComplete: boolean };
  rollbackTo60Allowed: boolean;
  jobs: { paused: boolean; pausedAt: string | null; deadlineAt: string | null; resumedAt: string | null };
  retryable: boolean;
  blockerCode: string | null;
};

export const summarizeOnlineState = (
  state: OnlineState | null,
  blocker?: OnlineUpgradeBlocked
): OnlineStatus => ({
  status: blocker
    ? "blocked"
    : state?.activatedAt && state.phase === "complete"
      ? "complete"
      : state?.completedPhases.includes("prepare") && !state.forwardOnlyAt
        ? "prepared"
        : state
          ? "in_progress"
          : "not_started",
  phase: state?.phase ?? "preflight",
  progress: { surveys: state?.surveyCount.toString() ?? "0", baselineComplete: !!state?.baselineCompletedAt },
  rollbackTo60Allowed: !state?.forwardOnlyAt,
  jobs: {
    paused: !!state?.queuePausedAt && !state.queueResumedAt,
    pausedAt: state?.queuePausedAt?.toISOString() ?? null,
    deadlineAt: state?.queuePauseDeadlineAt?.toISOString() ?? null,
    resumedAt: state?.queueResumedAt?.toISOString() ?? null,
  },
  retryable: blocker?.retryable ?? false,
  blockerCode: blocker?.code ?? null,
});

export type OnlineDependencies = {
  targetImage: string;
  assertLock: () => Promise<void>;
  read: () => Promise<OnlineState | null>;
  save: (patch: Partial<OnlineState>) => Promise<void>;
  preflight: () => Promise<void>;
  prepare: () => Promise<void>;
  verifyPrepared: () => Promise<void>;
  verifyConsumers: () => Promise<void>;
  finalizeMigrations: () => Promise<void>;
  /** Persist checkpoints after each successful bounded page, not after the entire scan. */
  backfill: () => Promise<void>;
  verifyProjection: () => Promise<void>;
  activate: () => Promise<void>;
  cleanup?: () => Promise<void>;
};

/** Each recorded phase is a verified postcondition. All retries also verify prerequisites again. */
export const runOnlineUpgrade = async (
  command: "prepare" | "finalize",
  deps: OnlineDependencies
): Promise<OnlineStatus> => {
  await deps.assertLock();
  let state = await deps.read();
  if (state && state.targetImage !== deps.targetImage)
    throw new OnlineUpgradeBlocked("target_identity_changed");
  await deps.preflight();
  if (!state?.completedPhases.includes("prepare")) {
    if (command !== "prepare") throw new OnlineUpgradeBlocked("preparation_required");
    await deps.prepare();
    await deps.assertLock();
    await deps.verifyPrepared();
    await deps.save({ targetImage: deps.targetImage, phase: "prepared", completedPhases: ["prepare"] });
    state = await deps.read();
  }
  if (!state?.completedPhases.includes("prepare")) throw new OnlineUpgradeBlocked("preparation_incomplete");
  await deps.verifyPrepared();
  if (command === "prepare") return summarizeOnlineState(state);

  // Includes terminating pods and Jobs. This must be rechecked on every resume, even after the
  // boundary, so an operator cannot accidentally reintroduce a 6.0 consumer and then activate.
  await deps.verifyConsumers();
  await deps.assertLock();
  if (state.activatedAt) {
    if (state.phase !== "complete") {
      await deps.cleanup?.();
      await deps.assertLock();
      await deps.save({ phase: "complete" });
    }
    return summarizeOnlineState(await deps.read());
  }
  if (!state.forwardOnlyAt) await deps.save({ phase: "finalizing", forwardOnlyAt: new Date() });
  await deps.finalizeMigrations();
  await deps.assertLock();
  await deps.backfill();
  await deps.verifyProjection();
  await deps.assertLock();
  await deps.save({
    phase: "activating",
    completedPhases: [...new Set([...state.completedPhases, "finalize"])],
  });
  await deps.verifyConsumers();
  await deps.activate();
  await deps.assertLock();
  await deps.save({
    phase: "cleanup",
    completedPhases: [...new Set([...state.completedPhases, ...ONLINE_PHASES])],
    activatedAt: state.activatedAt ?? new Date(),
  });
  await deps.cleanup?.();
  await deps.assertLock();
  await deps.save({ phase: "complete" });
  return summarizeOnlineState(await deps.read());
};
