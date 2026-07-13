import { createHash } from "@better-auth/utils/hash";
import { betterFetch } from "@better-fetch/fetch";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";

/**
 * Integration coverage for the HIBP breach check (ENG-1587) — drives the REAL Better Auth instance
 * (with the hibpBreachCheckPlugin wired in auth.ts) against a real Postgres. Only the outbound range
 * call to api.pwnedpasswords.com is intercepted; everything else (the plugin's password.hash hook, BA
 * path routing, the bcrypt hash, user/account creation) runs for real. This is what proves BA actually
 * routes /sign-up/email through our hook — the one thing the pure unit test can't.
 */

// Intercept ONLY the pwnedpasswords range endpoint; delegate every other betterFetch call (so we don't
// disturb the rest of Better Auth). Each test sets the range payload via `setRangeResponse`.
let rangeResponse: { data: string | null; error: unknown } = { data: "", error: null };
const setRangeResponse = (r: typeof rangeResponse) => {
  rangeResponse = r;
};

// integration/setup.ts disables the HIBP check suite-wide (so other tests don't hit the network);
// re-enable it for this file, which is the one that actually exercises the breach check. betterFetch
// is mocked below, so this still makes no real outbound call.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  PASSWORD_HIBP_CHECK_DISABLED: false,
}));

vi.mock("@better-fetch/fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@better-fetch/fetch")>();
  return {
    ...actual,
    betterFetch: vi.fn((url: string, opts: unknown) => {
      // Match the host exactly (parsed), not via substring — a substring check would also match a
      // crafted URL that merely contains the host elsewhere (CodeQL: incomplete URL sanitization).
      let host = "";
      try {
        host = new URL(String(url)).hostname;
      } catch {
        // non-absolute URL → not the range endpoint; fall through to the real fetch
      }
      if (host === "api.pwnedpasswords.com") {
        return Promise.resolve(rangeResponse);
      }
      return (actual.betterFetch as typeof betterFetch)(url as never, opts as never);
    }),
  };
});

/** Build a range-endpoint body that DOES contain the given password's SHA-1 suffix (a breach hit). */
const rangeHitFor = async (password: string): Promise<string> => {
  const sha1 = (await createHash("SHA-1", "hex").digest(password)).toUpperCase();
  return `${sha1.substring(5)}:99\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1`;
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  setRangeResponse({ data: "", error: null });
});

describe("HIBP breach check on sign-up (real Better Auth + Postgres)", () => {
  test("rejects a breached password and creates no user", async () => {
    const password = "P4ssw0rd-breached";
    setRangeResponse({ data: await rangeHitFor(password), error: null });

    await expect(
      auth.api.signUpEmail({ body: { email: "breach@example.com", password, name: "Bree" } })
    ).rejects.toMatchObject({ body: { code: "password_compromised" } });

    expect(await prisma.user.findUnique({ where: { email: "breach@example.com" } })).toBeNull();
  });

  test("allows a clean password (suffix absent from the range response)", async () => {
    // A range body whose suffixes cannot match any real SHA-1 suffix (too short) → not compromised.
    setRangeResponse({ data: "0000000000:1\n1111111111:2", error: null });

    const response = await auth.api.signUpEmail({
      body: { email: "clean@example.com", password: "Str0ng-unique-passphrase", name: "Cleo" },
      asResponse: true,
    });
    expect(response.status).toBeLessThan(300);
    expect(await prisma.user.findUnique({ where: { email: "clean@example.com" } })).not.toBeNull();
  });

  test("fails open: a range-endpoint error still lets sign-up through", async () => {
    setRangeResponse({ data: null, error: { status: 503 } });

    const response = await auth.api.signUpEmail({
      body: { email: "failopen@example.com", password: "Another-good-one-1", name: "Fay" },
      asResponse: true,
    });
    expect(response.status).toBeLessThan(300);
    expect(await prisma.user.findUnique({ where: { email: "failopen@example.com" } })).not.toBeNull();
  });
});
