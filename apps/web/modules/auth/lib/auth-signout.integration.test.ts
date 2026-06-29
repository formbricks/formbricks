import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";

/**
 * Repro for the E2E "invalidate a copied session cookie after logout" failure (ENG-1054):
 * does Better Auth sign-out actually delete the DB Session row (which the forward-auth proxy reads)?
 */
beforeEach(async () => {
  await resetDb();
});

const signedInCookieHeader = async (email: string, password: string): Promise<string> => {
  const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  expect(res.status).toBe(200);
  // Rebuild a Cookie header (name=value pairs) from the Set-Cookie list.
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
};

describe("Better Auth sign-out invalidates the session (real Postgres)", () => {
  test("auth.api.signOut deletes the DB Session row", async () => {
    await auth.api.signUpEmail({
      body: { email: "carol@example.com", password: "Correct-Horse1", name: "Carol" },
      asResponse: true,
    });
    await prisma.user.update({ where: { email: "carol@example.com" }, data: { emailVerified: true } });

    const cookieHeader = await signedInCookieHeader("carol@example.com", "Correct-Horse1");
    expect(cookieHeader).toContain("session_token");
    // A second, independent session for the same user — sign-out must remove only the targeted one,
    // not every session (it's sign-out, not sign-out-all).
    await signedInCookieHeader("carol@example.com", "Correct-Horse1");
    expect(await prisma.session.count()).toBe(2);

    const out = await auth.api.signOut({ headers: new Headers({ cookie: cookieHeader }), asResponse: true });
    expect(out.status).toBe(200);

    // Exactly the signed-out session is gone (the forward-auth proxy reads prisma.session.findUnique);
    // the other survives.
    expect(await prisma.session.count()).toBe(1);
  });

  test("the HTTP /sign-out route (what the client calls) deletes the DB Session row", async () => {
    await auth.api.signUpEmail({
      body: { email: "dave@example.com", password: "Correct-Horse1", name: "Dave" },
      asResponse: true,
    });
    await prisma.user.update({ where: { email: "dave@example.com" }, data: { emailVerified: true } });

    const cookieHeader = await signedInCookieHeader("dave@example.com", "Correct-Horse1");
    expect(await prisma.session.count()).toBe(1);

    // Drive the real HTTP handler (closer to the browser path than auth.api.*).
    const res = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-out", {
        method: "POST",
        headers: { cookie: cookieHeader },
      })
    );
    expect(res.ok).toBe(true); // a 4xx (e.g. CSRF/415) would also "not crash" but isn't a real sign-out

    expect(await prisma.session.count()).toBe(0);
  });
});
