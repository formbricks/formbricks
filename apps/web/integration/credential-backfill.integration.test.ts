import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { hashSecret } from "@/lib/crypto";
import { auth } from "@/modules/auth/lib/auth";
// The cutover data migration under test (auto-discovered by the migration runner at the flip).
import { backfillCredentialAccounts } from "../../../packages/database/migration/20260619120000_eng_1054_credential_account_backfill/migration";

/**
 * Integration coverage for the cutover credential-account backfill (ENG-1054) against real Postgres.
 * Proves the scariest cutover guarantee: an existing NextAuth-era user (bcrypt hash on User.password,
 * NO credential Account) can sign in via Better Auth after the backfill — no re-hash, no forced reset.
 */
beforeEach(async () => {
  await resetDb();
});

describe("Credential-account backfill (real Postgres)", () => {
  test("an existing User.password user can sign in via Better Auth after the backfill", async () => {
    const password = "LegacyPassw0rd!";
    const user = await prisma.user.create({
      data: {
        email: "legacy@example.com",
        name: "Legacy",
        emailVerified: true,
        password: await hashSecret(password),
      },
    });
    // NextAuth-era state: the hash lives on User.password, with no Account rows yet
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);

    const stats = await backfillCredentialAccounts(prisma);
    expect(stats.inserted).toBe(1);

    // a credential Account now exists in the shape BA reads, with the hash copied verbatim (no re-hash)
    const account = await prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: "credential", providerAccountId: user.id } },
    });
    expect(account?.userId).toBe(user.id);
    expect(account?.password).toBe(user.password);

    // and BA email/password sign-in works with the ORIGINAL password
    const res = await auth.api.signInEmail({
      body: { email: "legacy@example.com", password },
      asResponse: true,
    });
    expect(res.status).toBe(200);
  });

  test("is idempotent: running twice keeps a single credential account", async () => {
    const user = await prisma.user.create({
      data: {
        email: "legacy2@example.com",
        name: "Legacy2",
        emailVerified: true,
        password: await hashSecret("X1y2z3Ab!"),
      },
    });

    await backfillCredentialAccounts(prisma);
    const second = await backfillCredentialAccounts(prisma);

    expect(second.inserted).toBe(0);
    expect(second.skippedExisting).toBe(1);
    expect(await prisma.account.count({ where: { userId: user.id, provider: "credential" } })).toBe(1);
  });
});
