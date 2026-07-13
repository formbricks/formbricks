import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

// integration/setup.ts disables the HIBP check suite-wide (so other tests don't hit the network);
// re-enable it for this file, which is the one that actually exercises the breach check. Global fetch
// is stubbed below, so this still makes no real outbound call.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  PASSWORD_HIBP_CHECK_DISABLED: false,
}));

// Intercept ONLY the pwnedpasswords range endpoint (matched by parsed host); delegate every other
// fetch to the real implementation. Each test sets the range payload via `setRangeResponse`.
const realFetch = globalThis.fetch;
let rangeResponse: Response = new Response("");
const setRangeResponse = (r: Response) => {
  rangeResponse = r;
};

/** Build a range-endpoint body that DOES contain the given password's SHA-1 suffix (a breach hit). */
const rangeHitFor = (password: string): string => {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  return `${sha1.substring(5)}:99\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1`;
};

beforeEach(async () => {
  await resetDb();
  setRangeResponse(new Response(""));
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      let host = "";
      try {
        host = new URL(url).hostname;
      } catch {
        // non-absolute URL → not the range endpoint; fall through to the real fetch
      }
      if (host === "api.pwnedpasswords.com") return Promise.resolve(rangeResponse.clone());
      return realFetch(input, init);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HIBP breach check on sign-up (real Better Auth + Postgres)", () => {
  test("rejects a breached password and creates no user", async () => {
    const password = "P4ssw0rd-breached";
    setRangeResponse(new Response(rangeHitFor(password)));

    await expect(
      auth.api.signUpEmail({ body: { email: "breach@example.com", password, name: "Bree" } })
    ).rejects.toMatchObject({ body: { code: "password_compromised" } });

    expect(await prisma.user.findUnique({ where: { email: "breach@example.com" } })).toBeNull();
  });

  test("allows a clean password (suffix absent from the range response)", async () => {
    // A range body whose suffixes cannot match any real SHA-1 suffix (too short) → not compromised.
    setRangeResponse(new Response("0000000000:1\n1111111111:2"));

    const response = await auth.api.signUpEmail({
      body: { email: "clean@example.com", password: "Str0ng-unique-passphrase", name: "Cleo" },
      asResponse: true,
    });
    expect(response.status).toBeLessThan(300);
    expect(await prisma.user.findUnique({ where: { email: "clean@example.com" } })).not.toBeNull();
  });

  test("fails open: a range-endpoint error still lets sign-up through", async () => {
    setRangeResponse(new Response(null, { status: 503 }));

    const response = await auth.api.signUpEmail({
      body: { email: "failopen@example.com", password: "Another-good-one-1", name: "Fay" },
      asResponse: true,
    });
    expect(response.status).toBeLessThan(300);
    expect(await prisma.user.findUnique({ where: { email: "failopen@example.com" } })).not.toBeNull();
  });
});
