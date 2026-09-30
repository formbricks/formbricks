import { beforeEach, describe, expect, test, vi } from "vitest";
import { sendVerificationEmail } from "@/modules/email";
import { startSsoRecovery } from "./sso-recovery";

/**
 * The regression test for ENG-2783, and the one the existing suite could not have been.
 *
 * `sso-recovery.test.ts` mocks the intent factory to a constant string, so the completion URL is the
 * same length there whatever the input — which is precisely why a bug about URL length lived in this
 * function for two releases with the file green. This file therefore drives the REAL intent
 * construction (only Redis is faked, by an in-memory store) and measures the URL the browser would
 * actually request.
 *
 * On the JWT implementation this replaces, the loop below produced 1092 -> 3793 -> 10996 -> 30204
 * characters: `symmetricEncrypt` is hex-encoded, so it doubles its input, and the JWT's base64url adds
 * another third — about 2.7x per attempt. nginx's `large_client_header_buffers` defaults to `4 8k` and
 * a request line may not exceed a single buffer, so the third attempt came back as a bare
 * `414 Request-URI Too Large` with no way out but editing the address bar.
 */

const NGINX_REQUEST_LINE_LIMIT = 8192;
const WEBAPP_URL = "http://localhost:3000";

// Hoisted with the mocks that use them: `vi.mock` factories are lifted above every top-level const.
const mocks = vi.hoisted(() => ({
  createEmailToken: vi.fn(() => "email-token"),
  webAppUrl: "http://localhost:3000",
  store: new Map<string, unknown>(),
}));

// vitestSetup.ts stubs `crypto.createHash` to a constant; recovery-intent keys on sha256(stateId), so
// the stub would collapse every intent onto one key and hide a collision.
vi.mock("crypto", async () => await vi.importActual<typeof import("crypto")>("crypto"));

vi.mock("@formbricks/database", () => ({ prisma: { $transaction: vi.fn(), user: { findUnique: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    withContext: () => ({ info: vi.fn(), error: vi.fn() }),
  },
}));
// Real crypto material, so this file runs unchanged against the JWT implementation too — which is what
// makes "red before, green after" checkable rather than asserted. `vitestSetup.ts` supplies a 19-char
// ENCRYPTION_KEY that `createCipheriv` rejects, and no NEXTAUTH_SECRET at all.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: mocks.webAppUrl,
  ENCRYPTION_KEY: "0".repeat(64),
  NEXTAUTH_SECRET: "test-nextauth-secret",
}));
// Only the email token is stubbed — it is a fixed-size claim either way, and the length under test is
// the callback's. Everything else stays real, including the intent factory this change removes.
vi.mock("@/lib/jwt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jwt")>()),
  createEmailToken: mocks.createEmailToken,
}));
vi.mock("@/modules/email", () => ({
  sendVerificationEmail: vi.fn(async () => true),
  sendSsoRecoveryFactorsRemovedEmail: vi.fn(async () => true),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEventBackground: vi.fn() }));

vi.mock("@/lib/cache", () => ({
  cache: {
    set: vi.fn(async (key: string, value: unknown) => {
      mocks.store.set(key, value);
      return { ok: true, data: undefined };
    }),
    get: vi.fn(async (key: string) => ({ ok: true, data: mocks.store.get(key) ?? null })),
    del: vi.fn(async () => ({ ok: true, data: undefined })),
  },
}));

const existingUser = {
  id: "cm5q1x2y30000abcdefghijkl",
  email: "matti@formbricks.com",
  locale: "en-US" as const,
  emailVerified: false,
  isActive: true,
  identityProvider: "email" as const,
  identityProviderAccountId: null,
  twoFactorEnabled: false,
};

/** One turn of the loop: start recovery, and hand back the completion URL it puts in the email. */
const startRecoveryReturningCompletionUrl = async (callbackUrl: string): Promise<string> => {
  await startSsoRecovery({
    existingUser,
    provider: "google",
    account: { type: "oauth", provider: "google", providerAccountId: "provider-account-1" } as never,
    callbackUrl,
  });

  return vi.mocked(sendVerificationEmail).mock.calls.at(-1)![0].callbackUrl!;
};

describe("SSO recovery URL growth (ENG-2783)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.clear();
    mocks.createEmailToken.mockReturnValue("email-token");
  });

  test("retrying the loop does not grow the URL", async () => {
    // The user's real destination, and then whatever the previous attempt handed the login link.
    let callbackUrl = `${WEBAPP_URL}/workspaces/cm5q1x2y30000abcdefghijkl/surveys`;
    const completionUrlLengths: number[] = [];

    for (let attempt = 0; attempt < 5; attempt++) {
      const completionUrl = await startRecoveryReturningCompletionUrl(callbackUrl);
      completionUrlLengths.push(completionUrl.length);
      // Step 6 of the loop: the verification-requested page's log-in link carries the completion URL
      // into /auth/login, and signing in with the same IdP re-enters startSsoRecovery with it.
      callbackUrl = completionUrl;
    }

    expect(new Set(completionUrlLengths).size).toBe(1);
  });

  test("keeps every attempt's request line far inside nginx's 8K buffer", async () => {
    let callbackUrl = `${WEBAPP_URL}/workspaces/cm5q1x2y30000abcdefghijkl/surveys`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const completionUrl = await startRecoveryReturningCompletionUrl(callbackUrl);
      // What the browser sends when the user clicks "log in" on the verification-requested page.
      const requestLine = `GET /auth/login?callbackUrl=${encodeURIComponent(completionUrl)} HTTP/1.1`;

      expect(requestLine.length).toBeLessThan(NGINX_REQUEST_LINE_LIMIT);
      callbackUrl = completionUrl;
    }
  });

  test("the completion URL is a short opaque reference, carrying no part of the intent", async () => {
    const completionUrl = await startRecoveryReturningCompletionUrl(`${WEBAPP_URL}/environments/env_1`);
    const stateId = new URL(completionUrl).searchParams.get("state");

    expect(stateId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(completionUrl.length).toBeLessThan(150);
    expect(completionUrl).not.toContain(existingUser.id);
    expect(completionUrl).not.toContain("matti");
  });

  test("a callback URL sized to survive one nesting still yields the same short URL", async () => {
    // Length has to stop mattering, not merely be smaller: an 8K callback is what attempt three used to
    // hand back, and it must not produce an 8K completion URL in turn.
    const hugeCallbackUrl = `${WEBAPP_URL}/environments/env_1?padding=${"a".repeat(8000)}`;

    const completionUrl = await startRecoveryReturningCompletionUrl(hugeCallbackUrl);

    expect(completionUrl.length).toBeLessThan(150);
  });

  test("refuses to nest: a recovery callback is dropped rather than stored", async () => {
    const completionUrl = await startRecoveryReturningCompletionUrl(`${WEBAPP_URL}/environments/env_1`);

    // Round two, arriving with the previous attempt's completion URL — the shape that used to nest.
    await startRecoveryReturningCompletionUrl(completionUrl);

    const storedCallbackUrls = [...mocks.store.values()].map(
      (intent) => (intent as { callbackUrl: string }).callbackUrl
    );
    expect(storedCallbackUrls).toEqual([`${WEBAPP_URL}/environments/env_1`, WEBAPP_URL]);
  });
});
