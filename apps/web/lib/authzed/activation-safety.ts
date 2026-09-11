import "server-only";
import {
  AUTHZED_ACTIVATION_FINALIZATION_TIMEOUT_MS,
  AUTHZED_ACTIVATION_PREPARATION_LEASE_RENEWAL_MS,
} from "./activation-types";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

const AUTHZED_ACTIVATION_MINIMUM_DATABASE_CONNECTIONS = 2;

type TPromiseOutcome<T> =
  | Readonly<{ status: "fulfilled"; value: T }>
  | Readonly<{ reason: unknown; status: "rejected" }>;

const settle = async <T>(promise: Promise<T>): Promise<TPromiseOutcome<T>> => {
  try {
    return { status: "fulfilled", value: await promise };
  } catch (reason) {
    return { reason, status: "rejected" };
  }
};

/**
 * Activation holds an advisory-lock transaction while collecting final evidence through the regular
 * Prisma client. That evidence query needs a second pooled connection; reject undersized pools before
 * creating a receipt or mutation fence instead of waiting for the pool timeout during cutover.
 */
export const assertAuthzedActivationDatabasePoolCapacity = (databaseUrl: string): void => {
  const configuredLimit = new URL(databaseUrl).searchParams.get("connection_limit");
  if (configuredLimit === null) return;

  const parsedLimit = Number.parseInt(configuredLimit, 10);
  if (!Number.isFinite(parsedLimit) || parsedLimit >= AUTHZED_ACTIVATION_MINIMUM_DATABASE_CONNECTIONS) {
    return;
  }

  throw new AuthzedError({
    attempts: 0,
    code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
    operation: "activation_database_pool_capacity",
    retryable: false,
  });
};

export const throwIfAuthzedActivationAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;

  throw (
    signal.reason ??
    new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.CANCELLED,
      operation: "activation_cancelled",
      retryable: false,
    })
  );
};

/**
 * Bound an activation operation without allowing it to outlive the lock protecting it.
 *
 * JavaScript cannot forcibly stop a promise. On timeout, signal cooperative cancellation and then wait
 * for the operation to settle before rejecting. Callers can therefore release their transaction lock or
 * reset protocol state knowing no evidence work is still mutating SpiceDB in the background.
 */
export const runAuthzedActivationWithTimeout = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = AUTHZED_ACTIVATION_FINALIZATION_TIMEOUT_MS
): Promise<T> => {
  const controller = new AbortController();
  const timeoutError = new AuthzedError({
    attempts: 0,
    code: AUTHZED_ERROR_CODES.ACTIVATION_REQUIRED,
    operation: "activation_timeout",
    retryable: false,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Readonly<{ status: "timed_out" }>>((resolve) => {
    timer = setTimeout(() => resolve({ status: "timed_out" }), timeoutMs);
  });
  const operationOutcome = settle(Promise.resolve().then(() => operation(controller.signal)));
  const first = await Promise.race([operationOutcome, timeout]);

  if (first.status === "timed_out") {
    controller.abort(timeoutError);
    await operationOutcome;
    throw timeoutError;
  }

  if (timer) clearTimeout(timer);
  if (first.status === "rejected") throw first.reason;

  return first.value;
};

/**
 * Keep a preparation lease alive while long-running schema and graph work executes.
 *
 * A renewal failure aborts the operation and is not surfaced until that operation has settled. The
 * renewal task is also settled before success is returned, preventing an in-flight heartbeat from racing
 * the receipt transaction that consumes the lease.
 */
export const runWithRenewingAuthzedPreparationLease = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  renewLease: () => Promise<void>,
  renewalIntervalMs = AUTHZED_ACTIVATION_PREPARATION_LEASE_RENEWAL_MS
): Promise<T> => {
  const controller = new AbortController();
  let stopRenewal: (() => void) | undefined;
  const stopped = new Promise<void>((resolve) => {
    stopRenewal = resolve;
  });
  const waitForRenewalInterval = async (): Promise<"renew" | "stop"> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        new Promise<"renew">((resolve) => {
          timer = setTimeout(() => resolve("renew"), renewalIntervalMs);
        }),
        stopped.then(() => "stop" as const),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const renewalTask = (async (): Promise<void> => {
    for (;;) {
      const next = await waitForRenewalInterval();
      if (next === "stop") return;

      await renewLease();
    }
  })();
  const operationOutcome = settle(Promise.resolve().then(() => operation(controller.signal)));
  const renewalOutcome = settle(renewalTask);
  const first = await Promise.race([
    operationOutcome.then((outcome) => ({ kind: "operation" as const, outcome })),
    renewalOutcome.then((outcome) => ({ kind: "renewal" as const, outcome })),
  ]);

  if (first.kind === "renewal" && first.outcome.status === "rejected") {
    controller.abort(first.outcome.reason);
    stopRenewal?.();
    await operationOutcome;
    throw first.outcome.reason;
  }

  stopRenewal?.();
  const settledRenewal = await renewalOutcome;
  if (settledRenewal.status === "rejected") {
    controller.abort(settledRenewal.reason);
    await operationOutcome;
    throw settledRenewal.reason;
  }

  if (first.kind !== "operation") {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INTERNAL,
      operation: "activation_prepare_lease",
      retryable: false,
    });
  }
  if (first.outcome.status === "rejected") throw first.outcome.reason;

  return first.outcome.value;
};
