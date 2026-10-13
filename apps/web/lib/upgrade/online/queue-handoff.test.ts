import { expect, test, vi } from "vitest";
import type { OnlineState } from "./coordinator";
import { type QueueHandoffDependencies, handoffJobs } from "./queue-handoff";

const fixture = () => {
  const state: OnlineState = {
    targetImage: "app@sha256:target",
    completedPhases: ["prepare"],
    phase: "handoff",
    surveyCursor: null,
    surveyCount: 0n,
    baselineCompletedAt: null,
    forwardOnlyAt: null,
    activatedAt: null,
    queuePausedAt: null,
    queuePauseDeadlineAt: null,
    queueResumedAt: null,
  };
  let paused = false;
  let clock = 1000;
  const deps: QueueHandoffDependencies = {
    read: async () => state,
    save: vi.fn(async (patch) => {
      Object.assign(state, patch);
    }),
    assertLock: vi.fn(async () => {}),
    queue: {
      pause: vi.fn(async () => {
        paused = true;
      }),
      resume: vi.fn(async () => {
        paused = false;
      }),
      isPaused: async () => paused,
      active: vi.fn(async () => 0),
      close: vi.fn(),
    },
    retireSourceConsumers: vi.fn(async () => {
      expect(paused).toBe(true);
      expect(state.phase).toBe("retiring_consumers");
    }),
    verifySourceConsumersAbsent: vi.fn(async () => {}),
    timeoutSeconds: 1,
    now: () => new Date(clock),
    wait: async () => {
      clock += 500;
    },
  };
  return { state, deps };
};

test("active jobs finish before termination; waiting jobs resume on target workers", async () => {
  const { state, deps } = fixture();
  vi.mocked(deps.queue.active).mockResolvedValueOnce(1).mockResolvedValue(0);
  await handoffJobs(deps);
  expect(deps.retireSourceConsumers).toHaveBeenCalledOnce();
  expect(deps.verifySourceConsumersAbsent).toHaveBeenCalledOnce();
  expect(deps.queue.resume).toHaveBeenCalledOnce();
  expect(state).toMatchObject({
    phase: "rollout",
    completedPhases: ["prepare", "consumers-retired"],
    forwardOnlyAt: null,
    queuePausedAt: new Date(1000),
    queueResumedAt: new Date(1500),
  });
});

test("a drain deadline resumes consumption without permitting source termination", async () => {
  const { state, deps } = fixture();
  vi.mocked(deps.queue.active).mockResolvedValue(1);
  await expect(handoffJobs(deps)).rejects.toThrow("job_drain_timeout");
  expect(deps.retireSourceConsumers).not.toHaveBeenCalled();
  expect(await deps.queue.isPaused()).toBe(false);
  expect(state.phase).toBe("job_drain_aborted");
});

test("an operator's existing pause is never taken over or resumed", async () => {
  const { deps } = fixture();
  await deps.queue.pause();
  await expect(handoffJobs(deps)).rejects.toThrow("queue_already_paused");
  expect(deps.save).not.toHaveBeenCalled();
  expect(deps.queue.resume).not.toHaveBeenCalled();
});

test("retirement interruption retains the queue pause and resumes from its checkpoint", async () => {
  const { state, deps } = fixture();
  vi.mocked(deps.retireSourceConsumers).mockRejectedValueOnce(new Error("interrupted"));
  await expect(handoffJobs(deps)).rejects.toThrow("interrupted");
  expect(state.phase).toBe("retiring_consumers");
  expect(deps.queue.resume).not.toHaveBeenCalled();
  await handoffJobs(deps);
  expect(deps.queue.pause).toHaveBeenCalledOnce();
  expect(deps.queue.resume).toHaveBeenCalledOnce();
  expect(state.phase).toBe("rollout");
});

test("lock loss blocks termination and a later retry can finish draining", async () => {
  const { deps } = fixture();
  deps.wait = async () => {
    throw new Error("coordinator_killed");
  };
  vi.mocked(deps.queue.active).mockResolvedValueOnce(1).mockResolvedValue(0);
  await expect(handoffJobs(deps)).rejects.toThrow("coordinator_killed");
  vi.mocked(deps.assertLock).mockRejectedValueOnce(new Error("lock_lost"));
  await expect(handoffJobs(deps)).rejects.toThrow("lock_lost");
  expect(deps.retireSourceConsumers).not.toHaveBeenCalled();
  await handoffJobs(deps);
  expect(deps.retireSourceConsumers).toHaveBeenCalledOnce();
});

test("a crash around resume rechecks source absence and does not retire twice", async () => {
  const { deps } = fixture();
  vi.mocked(deps.queue.resume).mockRejectedValueOnce(new Error("redis_disconnected"));
  await expect(handoffJobs(deps)).rejects.toThrow("redis_disconnected");
  vi.mocked(deps.verifySourceConsumersAbsent).mockRejectedValueOnce(new Error("old_consumer_present"));
  await expect(handoffJobs(deps)).rejects.toThrow("old_consumer_present");
  await handoffJobs(deps);
  expect(deps.retireSourceConsumers).toHaveBeenCalledOnce();
  expect(deps.queue.resume).toHaveBeenCalledTimes(2);
  await handoffJobs(deps);
  expect(deps.queue.resume).toHaveBeenCalledTimes(2);
});

test("losing the shared pause during retirement blocks further source termination", async () => {
  const { deps } = fixture();
  vi.mocked(deps.retireSourceConsumers).mockRejectedValueOnce(new Error("interrupted"));
  await expect(handoffJobs(deps)).rejects.toThrow("interrupted");
  await deps.queue.resume();
  await expect(handoffJobs(deps)).rejects.toThrow("queue_pause_lost");
  expect(deps.retireSourceConsumers).toHaveBeenCalledOnce();
});

test("reintroduced source workers block a repeated prepare even after a recorded resume", async () => {
  const { deps } = fixture();
  await handoffJobs(deps);
  vi.mocked(deps.verifySourceConsumersAbsent).mockRejectedValueOnce(new Error("old_consumer_present"));
  await expect(handoffJobs(deps)).rejects.toThrow("old_consumer_present");
  expect(deps.retireSourceConsumers).toHaveBeenCalledOnce();
  expect(deps.queue.pause).toHaveBeenCalledOnce();
});

test("each source mutation rechecks queue activity under the coordinator lock", async () => {
  const { deps } = fixture();
  const mutate = vi.fn();
  deps.retireSourceConsumers = async (assertDrained) => {
    vi.mocked(deps.queue.active).mockResolvedValue(1);
    await assertDrained();
    mutate();
  };
  await expect(handoffJobs(deps)).rejects.toThrow("queue_not_drained");
  expect(mutate).not.toHaveBeenCalled();
  expect(deps.queue.resume).not.toHaveBeenCalled();
});

test("a retry after the previous drain deadline gets a fresh bounded attempt", async () => {
  const { state, deps } = fixture();
  deps.wait = async () => {
    throw new Error("coordinator_killed");
  };
  vi.mocked(deps.queue.active).mockResolvedValueOnce(1).mockResolvedValue(0);
  await expect(handoffJobs(deps)).rejects.toThrow("coordinator_killed");
  expect(state.phase).toBe("draining_jobs");
  deps.now = () => new Date(10_000);
  await handoffJobs(deps);
  expect(state.queuePauseDeadlineAt).toEqual(new Date(11_000));
  expect(deps.retireSourceConsumers).toHaveBeenCalledOnce();
  expect(deps.queue.resume).toHaveBeenCalledOnce();
});
