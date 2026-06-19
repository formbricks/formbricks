import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";

/**
 * Integration coverage for the email/password flow (ENG-1054) — drives the REAL Better Auth instance
 * against a real Postgres (provisioned by integration/global-setup.ts) through the Boolean test client
 * (integration/db-boolean.ts). This is the first runtime exercise of the BA↔Formbricks boundary:
 * the user/account field mappings, the bcrypt password hook, and DB session issuance.
 */
beforeEach(async () => {
  await resetDb();
});

describe("Better Auth email/password (real Postgres)", () => {
  test("sign-up creates the user and a bcrypt credential account via the Formbricks field mappings", async () => {
    const response = await auth.api.signUpEmail({
      body: { email: "alice@example.com", password: "Sup3rSecret!", name: "Alice Example" },
      asResponse: true,
    });
    expect(response.status).toBeLessThan(300);

    const user = await prisma.user.findUnique({
      where: { email: "alice@example.com" },
      include: { accounts: true },
    });
    expect(user).not.toBeNull();
    expect(user?.name).toBe("Alice Example");
    // boolean column (post-cutover shape): unverified on fresh sign-up
    expect(user?.emailVerified).toBe(false);
    expect(user?.accounts).toHaveLength(1);

    const account = user!.accounts[0];
    expect(account.provider).toBe("credential"); // BA providerId → Prisma `provider`
    expect(account.password).toMatch(/^\$2[aby]\$/); // bcrypt (hashSecret), never plaintext
  });

  test("sign-in issues a DB session for the right password (after verification) and rejects the wrong one", async () => {
    await auth.api.signUpEmail({
      body: { email: "bob@example.com", password: "Correct-Horse1", name: "Bob" },
      asResponse: true,
    });
    // requireEmailVerification mirrors NextAuth; mark verified so sign-in is allowed.
    await prisma.user.update({ where: { email: "bob@example.com" }, data: { emailVerified: true } });

    // wrong password → rejected, no session row
    await expect(
      auth.api.signInEmail({ body: { email: "bob@example.com", password: "nope-nope-1" } })
    ).rejects.toBeTruthy();
    expect(await prisma.session.count()).toBe(0);

    // correct password → 200 + a Session row exercising the sessionToken/expires field mappings
    const ok = await auth.api.signInEmail({
      body: { email: "bob@example.com", password: "Correct-Horse1" },
      asResponse: true,
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie") ?? "").toContain("session_token");

    const sessions = await prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionToken).toBeTruthy();
    expect(sessions[0].expires.getTime()).toBeGreaterThan(Date.now());
  });
});
