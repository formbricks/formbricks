import type { JobsUpgradeQueue } from "@formbricks/jobs";
import { type OnlineState, OnlineUpgradeBlocked } from "./coordinator";

export type QueueHandoffDependencies = {
  read: () => Promise<OnlineState>;
  save: (patch: Partial<OnlineState>) => Promise<void>;
  assertLock: () => Promise<void>;
  queue: JobsUpgradeQueue;
  /** Must verify serving target workers before scaling any source workload to zero. */
  retireSourceConsumers: (assertDrained: () => Promise<void>) => Promise<void>;
  verifySourceConsumersAbsent: () => Promise<void>;
  timeoutSeconds: number;
  now?: () => Date;
  wait?: () => Promise<void>;
};

/** Only entered after HTTP endpoint withdrawal and ingress drain have succeeded. */
export const handoffJobs = async (deps: QueueHandoffDependencies): Promise<void> => {
  const now = deps.now ?? (() => new Date());
  const wait = deps.wait ?? (() => new Promise((resolve) => setTimeout(resolve, 500)));
  await deps.assertLock();
  let state = await deps.read();
  if (state.completedPhases.includes("consumers-retired")) {
    // A controlled source restoration must not make a later retry terminate active legacy workers.
    await deps.verifySourceConsumersAbsent();
    // Resume itself is idempotent if the coordinator died before recording its postcondition.
    if (!state.queueResumedAt) {
      await deps.assertLock();
      await deps.queue.resume();
      await deps.save({ phase: "rollout", queueResumedAt: now() });
    }
    return;
  }
  if (!state.queuePausedAt || state.queueResumedAt) {
    if (await deps.queue.isPaused()) throw new OnlineUpgradeBlocked("queue_already_paused");
    const started = now();
    await deps.save({
      phase: "pausing_jobs",
      queuePausedAt: started,
      queuePauseDeadlineAt: new Date(started.getTime() + deps.timeoutSeconds * 1000),
      queueResumedAt: null,
    });
    state = await deps.read();
  }
  if (state.phase !== "retiring_consumers" && state.queuePausedAt && !state.queueResumedAt) {
    // A new lock holder gets a fresh, bounded drain attempt after a crash. The old deadline
    // must not make every late retry abort immediately. Retirement never auto-resumes the queue.
    await deps.save({ queuePauseDeadlineAt: new Date(now().getTime() + deps.timeoutSeconds * 1000) });
    state = await deps.read();
  }
  // The persisted intent precedes Redis pause so both sides of a crash can be retried safely.
  await deps.assertLock();
  if (!(await deps.queue.isPaused())) {
    if (state.phase === "retiring_consumers") throw new OnlineUpgradeBlocked("queue_pause_lost");
    await deps.queue.pause();
  }
  if (state.phase !== "retiring_consumers") {
    await deps.save({ phase: "draining_jobs" });
    while (true) {
      await deps.assertLock();
      if (!(await deps.queue.isPaused())) throw new OnlineUpgradeBlocked("queue_pause_lost");
      if (!state.queuePauseDeadlineAt || now() >= state.queuePauseDeadlineAt) {
        // No source termination is authorized yet. Abort the attempt and restore consumption.
        await deps.queue.resume();
        await deps.save({ phase: "job_drain_aborted", queueResumedAt: now() });
        throw new OnlineUpgradeBlocked("job_drain_timeout", true);
      }
      if ((await deps.queue.active()) === 0) break;
      await wait();
    }
    await deps.assertLock();
    await deps.save({ phase: "retiring_consumers" });
  }
  await deps.assertLock();
  if (!(await deps.queue.isPaused()) || (await deps.queue.active()) !== 0)
    throw new OnlineUpgradeBlocked("queue_not_drained");
  // A failed retirement keeps consumption paused: resuming with terminating old workers can lose work.
  // The serving surge is retained. A repeated prepare resumes this durable phase.
  await deps.retireSourceConsumers(async () => {
    await deps.assertLock();
    if (!(await deps.queue.isPaused()) || (await deps.queue.active()) !== 0)
      throw new OnlineUpgradeBlocked("queue_not_drained");
  });
  await deps.verifySourceConsumersAbsent();
  await deps.assertLock();
  state = await deps.read();
  await deps.save({ completedPhases: [...new Set([...state.completedPhases, "consumers-retired"])] });
  await deps.queue.resume();
  await deps.assertLock();
  await deps.save({ phase: "rollout", queueResumedAt: now() });
};
