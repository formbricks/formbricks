import "server-only";

type TAuthzedCiOutboxWorkerRunnerOptions = Readonly<{
  deliver: () => Promise<void>;
  heartbeat: () => Promise<void>;
  maxConsecutiveFailures: number;
  onUnexpectedFailure: (consecutiveFailures: number) => void;
  shouldStop: () => boolean;
  wait: () => Promise<void>;
}>;

/**
 * Keep the CI-only outbox processor alive through isolated infrastructure blips, but stop after a
 * bounded run of unexpected failures so the workflow reports a broken delivery fixture instead of
 * cascading into unrelated authorization denials.
 */
export const runAuthzedCiOutboxWorker = async ({
  deliver,
  heartbeat,
  maxConsecutiveFailures,
  onUnexpectedFailure,
  shouldStop,
  wait,
}: TAuthzedCiOutboxWorkerRunnerOptions): Promise<void> => {
  let consecutiveFailures = 0;

  while (!shouldStop()) {
    try {
      await deliver();
      await heartbeat();
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures += 1;
      onUnexpectedFailure(consecutiveFailures);

      if (consecutiveFailures >= maxConsecutiveFailures) {
        throw new Error("AuthZed CI outbox delivery exceeded its consecutive-failure limit");
      }
    }

    if (!shouldStop()) {
      await wait();
    }
  }
};
