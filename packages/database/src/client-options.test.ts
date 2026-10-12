import { describe, expect, test, vi } from "vitest";
import {
  APP_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS,
  APP_TRANSACTION_TIMEOUT_MS,
  PRISMA_GLOBAL_OMIT,
  createAppPrismaClientOptions,
  getAppTransactionOptions,
} from "./client-options";

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

describe("getAppTransactionOptions", () => {
  test("waits one second longer than pg-pool, so a saturated pool fails with pg-pool's own error", () => {
    expect(getAppTransactionOptions(5_000)).toEqual({ maxWait: 6_000, timeout: APP_TRANSACTION_TIMEOUT_MS });
    expect(getAppTransactionOptions(15_000).maxWait).toBe(16_000);
  });

  test("stays finite and positive when connect_timeout=0 disables pg-pool's acquire timeout", () => {
    // Prisma rejects a maxWait <= 0 at construction, which would take the app down at boot.
    expect(getAppTransactionOptions(0).maxWait).toBe(6_000);
  });

  test("raises the execution budget above Prisma's 5 s default", () => {
    expect(APP_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(5_000);
  });
});

describe("createAppPrismaClientOptions", () => {
  test("derives maxWait from the pool the adapter actually built", async () => {
    const options = createAppPrismaClientOptions(
      "postgresql://app:secret@database:5432/formbricks?connect_timeout=3"
    );

    expect(options.transactionOptions).toEqual({ maxWait: 4_000, timeout: APP_TRANSACTION_TIMEOUT_MS });
    expect(options.omit).toBe(PRISMA_GLOBAL_OMIT);

    const pool = (await options.adapter.connect()).underlyingDriver();
    try {
      expect(pool.options.idle_in_transaction_session_timeout).toBe(
        APP_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS
      );
    } finally {
      await pool.end();
    }
  });

  test("keeps maxWait finite with connect_timeout=0", () => {
    const options = createAppPrismaClientOptions(
      "postgresql://app:secret@database:5432/formbricks?connect_timeout=0"
    );

    expect(options.transactionOptions.maxWait).toBe(6_000);
  });
});
