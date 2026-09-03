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
// Disable the HIBP breach check by default — otherwise every signup/reset in the suite would make a
// live call to api.pwnedpasswords.com (ENG-1587). The dedicated better-auth-hibp.integration.test.ts
// re-enables it for itself (with betterFetch mocked).
process.env.PASSWORD_HIBP_CHECK_DISABLED ??= "1";

// server-only is a Next.js build guard; no-op it under vitest.
vi.mock("server-only", () => ({}));

// Capture transactional emails instead of sending via SMTP. These resolve `true` because the real
// senders return Promise<boolean> and a FALSY result means "not sent" — auth.ts treats that as a send
// failure (ENG-2091), so a mock resolving undefined would fake an outage.
//
// Keep this the ONE place the module is mocked for integration tests. A per-file `vi.mock` of the same
// module replaces this wholesale, so an incomplete copy silently drops senders or gets their return
// type wrong — which is exactly how the undefined-vs-boolean bug above got in. Add senders here.
vi.mock("@/modules/email", () => ({
  sendVerificationLinkEmail: vi.fn(async () => true),
  // The SSO-recovery pair (ENG-2783): startSsoRecovery sends the first, completeSsoRecovery the second.
  sendVerificationEmail: vi.fn(async () => true),
  sendSsoRecoveryFactorsRemovedEmail: vi.fn(async () => true),
  sendPasswordResetLinkEmail: vi.fn(async () => true),
  sendPasswordResetNotifyEmail: vi.fn(async () => true),
  sendDeleteAccountConfirmationEmail: vi.fn(async () => true),
  sendInviteAcceptedEmail: vi.fn(async () => undefined), // returns void, not boolean
}));

/**
 * Analytics: stub only the exports that would do network I/O, and spread the rest so PURE helpers keep
 * their real behaviour — `getEmailDomain` computes a property value, and stubbing it to `undefined`
 * would quietly change what the code under test captures rather than just silencing a send.
 *
 * Spreading the real module is safe here: `posthogServerClient` is `null` without POSTHOG_KEY, and
 * `server-only` is no-op'd above.
 *
 * Same rule as the mailer above — keep this the ONE place the module is mocked. Five integration files
 * each had their own partial factory listing exports by hand, so when #8605 added `getEmailDomain` they
 * all failed with "No export is defined on the mock". A spread cannot drift that way.
 */
vi.mock("@/lib/posthog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/posthog")>()),
  capturePostHogEvent: vi.fn(),
  identifyPostHogPerson: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
}));
