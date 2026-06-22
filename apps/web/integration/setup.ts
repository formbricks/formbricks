/* eslint-disable turbo/no-undeclared-env-vars -- harness-only env overrides (TEST_*), not app config */
import { vi } from "vitest";

/**
 * Per-file setup for the Better Auth integration harness (ENG-1054).
 *
 * Point the app at the isolated test database + Redis BEFORE the test file imports `@/lib/env` or the
 * `@formbricks/database` prisma singleton (both bind to `process.env` at import time). setupFiles run
 * before the test module's imports, so these assignments win over the `.env` loaded by `dotenv -e`.
 *
 * NOTE: this harness does NOT mock `@formbricks/database` (the unit harness, vitestSetup.ts, does) —
 * the whole point is to exercise the real prisma client against a real Postgres.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/formbricks_ba_test?schema=public";
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379/15";
// Better Auth requires a secret; provide a stable test one if the loaded env doesn't carry it.
process.env.BETTER_AUTH_SECRET ??= "integration-test-better-auth-secret-0123456789abcdef";
// Disable rate limiting in the harness — counters would accumulate in the shared Redis db across tests.
process.env.RATE_LIMITING_DISABLED ??= "1";

// server-only is a Next.js build guard; no-op it under vitest.
vi.mock("server-only", () => ({}));

// Capture transactional emails instead of sending via SMTP.
vi.mock("@/modules/email", () => ({
  sendVerificationLinkEmail: vi.fn(async () => undefined),
  sendPasswordResetLinkEmail: vi.fn(async () => undefined),
  sendDeleteAccountConfirmationEmail: vi.fn(async () => undefined),
}));
