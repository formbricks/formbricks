import { isPrismaKnownRequestError } from "@/lib/utils/prisma-error";

/**
 * A Postgres deadlock aborts ONE transaction in the cycle (SQLSTATE 40P01) and is safe to retry.
 * Prisma reports it as P2034 on interactive transactions; the pg driver adapter can also surface it
 * as a DriverAdapterError whose message carries "deadlock detected" — the shape seen in Sentry for
 * ENG-2038 (login path) and ENG-2252 (contact identify path).
 */
export const isDeadlockError = (error: unknown): boolean => {
  if (isPrismaKnownRequestError(error) && error.code === "P2034") {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /deadlock detected/i.test(message) || message.includes("40P01");
};

const DEADLOCK_MAX_ATTEMPTS = 3;

/**
 * Retry a DB operation a bounded number of times when it fails with a deadlock, with a short linear
 * backoff so retried transactions don't re-collide in lockstep. Non-deadlock errors propagate on the
 * first attempt. The caller must be idempotent: a deadlock rolls the whole transaction back, so
 * re-running it must be safe.
 *
 * Retry is the second line of defense — the first is acquiring locks in a deterministic order so no
 * cycle can form in the first place (see updateAttributes in modules/ee/contacts/lib/attributes.ts).
 */
export const retryOnDeadlock = async <T>(operation: () => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= DEADLOCK_MAX_ATTEMPTS || !isDeadlockError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 25));
    }
  }
};
