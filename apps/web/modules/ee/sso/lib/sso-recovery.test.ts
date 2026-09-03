import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";
import { finalizeSuccessfulSignIn } from "@/modules/auth/lib/sign-in-tracking";
import { buildVerificationRequestedPath } from "@/modules/auth/lib/verification-links";
import { sendSsoRecoveryFactorsRemovedEmail, sendVerificationEmail } from "@/modules/email";
import { syncSsoIdentityForUser } from "./account-linking";
import { completeSsoRecovery, getSsoRecoveryFailureRedirectUrl, startSsoRecovery } from "./sso-recovery";

const mocks = vi.hoisted(() => ({
  createEmailToken: vi.fn(),
  createSsoRecoveryIntent: vi.fn(),
  readSsoRecoveryIntent: vi.fn(),
  consumeSsoRecoveryIntent: vi.fn(),
  queueAuditEventBackground: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    WEBAPP_URL: "http://localhost:3000",
  };
});

vi.mock("@/lib/jwt", () => ({
  createEmailToken: mocks.createEmailToken,
}));

vi.mock("./recovery-intent", () => ({
  createSsoRecoveryIntent: mocks.createSsoRecoveryIntent,
  readSsoRecoveryIntent: mocks.readSsoRecoveryIntent,
  consumeSsoRecoveryIntent: mocks.consumeSsoRecoveryIntent,
}));

vi.mock("@/modules/auth/lib/session-revocation", () => ({
  revokeUserSessionsExcept: vi.fn(),
}));

vi.mock("@/modules/auth/lib/sign-in-tracking", () => ({
  finalizeSuccessfulSignIn: vi.fn(),
}));

vi.mock("@/modules/auth/lib/verification-links", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/auth/lib/verification-links")>();
  return {
    ...actual,
    buildVerificationRequestedPath: vi.fn(),
  };
});

vi.mock("@/modules/email", () => ({
  sendVerificationEmail: vi.fn(),
  sendSsoRecoveryFactorsRemovedEmail: vi.fn(),
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: mocks.queueAuditEventBackground,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    withContext: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
    })),
  },
}));

vi.mock("./account-linking", () => ({
  LINKED_SSO_LOOKUP_SELECT: {
    id: true,
    email: true,
    locale: true,
    emailVerified: true,
    isActive: true,
    identityProvider: true,
    identityProviderAccountId: true,
    twoFactorEnabled: true,
  },
  syncSsoIdentityForUser: vi.fn(),
}));

describe("sso-recovery", () => {
  const txUserUpdate = vi.fn();
  const txUserUpdateMany = vi.fn();
  // Both legacy writes go through `user.updateMany`, so the stub answers on the FILTER rather than on
  // call order: keyed positionally, reordering the two writes would silently swap what each test below
  // is asserting, and a case meant to prove one factor was untouched would be reading the other's count.
  const legacyCleared = { twoFactor: 0, password: 0 };
  const txTwoFactorDeleteMany = vi.fn();
  const txAccountUpdateMany = vi.fn();
  const txOauthAccessUpdateMany = vi.fn();
  const txOauthRefreshUpdateMany = vi.fn();
  const txOauthConsentDeleteMany = vi.fn();
  // Both new stores belong in the stub: post-ENG-1054 the password lives on `Account` and the 2FA secret
  // in `TwoFactor`, so a strip that only touched `user` is exactly the bug ENG-2557 fixed.
  const tx = {
    user: {
      update: txUserUpdate,
      updateMany: txUserUpdateMany,
    },
    twoFactor: {
      deleteMany: txTwoFactorDeleteMany,
    },
    account: {
      updateMany: txAccountUpdateMany,
    },
    oauthAccessToken: {
      updateMany: txOauthAccessUpdateMany,
    },
    oauthRefreshToken: {
      updateMany: txOauthRefreshUpdateMany,
    },
    oauthConsent: {
      deleteMany: txOauthConsentDeleteMany,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    legacyCleared.twoFactor = 0;
    legacyCleared.password = 0; // post-cutover default: neither legacy column holds anything
    txUserUpdateMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      "password" in where ? { count: legacyCleared.password } : { count: legacyCleared.twoFactor }
    );
    txTwoFactorDeleteMany.mockResolvedValue({ count: 1 });
    txAccountUpdateMany.mockResolvedValue({ count: 1 });
    txOauthAccessUpdateMany.mockResolvedValue({ count: 1 });
    txOauthRefreshUpdateMany.mockResolvedValue({ count: 2 });
    txOauthConsentDeleteMany.mockResolvedValue({ count: 1 });
    vi.mocked(revokeUserSessionsExcept).mockResolvedValue(2);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (callback: (txClient: Prisma.TransactionClient) => Promise<unknown>) =>
        await callback(tx as unknown as Prisma.TransactionClient)
    );
    vi.mocked(buildVerificationRequestedPath).mockReturnValue(
      "/auth/verification-requested?token=email-token&purpose=sso_recovery"
    );
    mocks.createEmailToken.mockReturnValue("email-token");
    mocks.createSsoRecoveryIntent.mockResolvedValue("state-id");
    mocks.readSsoRecoveryIntent.mockResolvedValue({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "google",
      providerAccountId: "provider-account-1",
      callbackUrl: "http://localhost:3000/environments/env_1",
      createdAt: Date.now(),
    });
  });

  test("preserves the recovery purpose when building the verification requested path", async () => {
    vi.mocked(sendVerificationEmail).mockResolvedValue(true);

    const result = await startSsoRecovery({
      existingUser: {
        id: "user_1",
        email: "john.doe@example.com",
        locale: "en-US",
        emailVerified: false,
        isActive: true,
        identityProvider: "email",
        identityProviderAccountId: null,
        twoFactorEnabled: false,
      },
      provider: "google",
      account: {
        type: "oauth",
        provider: "google",
        providerAccountId: "provider-account-1",
      } as any,
      callbackUrl: "http://localhost:3000/environments/env_1",
    });

    expect(sendVerificationEmail).toHaveBeenCalledWith({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      callbackUrl: "http://localhost:3000/api/auth/sso/recovery/complete?state=state-id",
      purpose: "sso_recovery",
    });
    expect(buildVerificationRequestedPath).toHaveBeenCalledWith({
      token: "email-token",
      callbackUrl: "http://localhost:3000/api/auth/sso/recovery/complete?state=state-id",
      purpose: "sso_recovery",
    });
    expect(result).toBe("/auth/verification-requested?token=email-token&purpose=sso_recovery");
  });

  test("records a failed recovery start when the verification email cannot be sent", async () => {
    vi.mocked(sendVerificationEmail).mockRejectedValue(new Error("smtp unavailable"));

    await expect(
      startSsoRecovery({
        existingUser: {
          id: "user_1",
          email: "john.doe@example.com",
          locale: "en-US",
          emailVerified: false,
          isActive: true,
          identityProvider: "email",
          identityProviderAccountId: null,
          twoFactorEnabled: false,
        },
        provider: "google",
        account: {
          type: "oauth",
          provider: "google",
          providerAccountId: "provider-account-1",
        } as any,
        callbackUrl: "https://evil.example/phish",
      })
    ).rejects.toThrow("smtp unavailable");

    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_failed",
        status: "failure",
        userId: "user_1",
        newObject: expect.objectContaining({
          callbackUrl: "http://localhost:3000",
          failureReason: "smtp unavailable",
        }),
      })
    );
  });

  test("reclaims unverified local auth factors before linking SSO", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: false,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);

    const callbackUrl = await completeSsoRecovery({
      stateId: "test-state",
      sessionUserId: "user_1",
      sessionToken: "current-session-token",
    });

    // Exact-match on purpose: the legacy nulls are load-bearing, not leftovers. `better-auth-two-factor-backfill`
    // re-materialises a `TwoFactor` row from `twoFactorEnabled && twoFactorSecret` on the next credential
    // sign-in, so dropping them from this payload would let the stripped factor come back.
    expect(txUserUpdate).toHaveBeenCalledWith({
      where: {
        id: "user_1",
      },
      data: {
        backupCodes: null,
        emailVerified: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });
    // The two legacy writes, asserted on the CALL and not only on the counts they feed. Their payloads
    // are load-bearing for the same reason the exact-match above is: a hash or a latch left behind is a
    // factor that survives an account changing hands, and `data: {}` would keep every derived count and
    // every assertion below green.
    expect(txUserUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_1", password: { not: null } },
      data: { password: null },
    });
    expect(txUserUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_1", twoFactorEnabled: true },
      data: { twoFactorEnabled: false },
    });
    // The live stores, which the pre-ENG-2557 implementation never touched.
    expect(txTwoFactorDeleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    // Scoped by owner, NOT by `providerAccountId`/`issuer`: those are account-key columns and a drifted key
    // (ENG-2555) would make a key-filtered query walk past a row still holding a live hash.
    // `password: { not: null }` narrows to rows that actually held a credential, so the reported count
    // is rows CHANGED rather than rows matched — an already-null row must not read as a factor removed.
    expect(txAccountUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", provider: "credential", password: { not: null } },
      data: { password: null },
    });
    // Post-commit, sparing the caller's own session so the redirect still lands signed in.
    expect(revokeUserSessionsExcept).toHaveBeenCalledWith({
      userId: "user_1",
      keepSessionToken: "current-session-token",
    });
    // The OAuth grants the account minted while unproven: a refresh token outlives every session, so
    // the sweep is incomplete without this.
    expect(txOauthAccessUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", revoked: null },
      data: { revoked: expect.any(Date) },
    });
    expect(txOauthRefreshUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", revoked: null },
      data: { revoked: expect.any(Date) },
    });
    // Consent too: `/authorize` skips the consent screen when a row exists, so leaving it would let a
    // still-cookie-cached session mint a replacement refresh token and undo the revocation above.
    expect(txOauthConsentDeleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_completed",
        status: "success",
        newObject: expect.objectContaining({
          credentialPasswordsCleared: 1,
          legacyPasswordCleared: false,
          twoFactorRowsRemoved: 1,
          // Distinct fields, and the stub returns distinct counts (1 access / 2 refresh) on purpose: a
          // summed field would read 3 either way and could not catch the two being swapped.
          oauthAccessTokensRevoked: 1,
          oauthRefreshTokensRevoked: 2,
          oauthConsentsRevoked: 1,
          sessionsRevoked: 2,
        }),
      })
    );
    expect(syncSsoIdentityForUser).toHaveBeenCalledWith({
      userId: "user_1",
      provider: "google",
      account: {
        type: "oauth",
        provider: "google",
        providerAccountId: "provider-account-1",
      },
      tx,
    });
    expect(finalizeSuccessfulSignIn).toHaveBeenCalledWith({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "google",
    });
    expect(callbackUrl).toBe("http://localhost:3000/environments/env_1");
  });

  /**
   * ENG-2633. The strip is correct for a squatter and a silent security downgrade for an owner who
   * never verified their address — and on the shipped self-hosted defaults, where verification blocks
   * nothing, the owner is the likelier of the two. Nothing here can tell them apart, so the account
   * holder has to be told what was removed instead.
   */
  describe("notifying the user about removed factors", () => {
    const asUnverifiedUser = () =>
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "john.doe@example.com",
        locale: "de-DE",
        emailVerified: false,
        isActive: true,
        identityProvider: "email",
        identityProviderAccountId: null,
      } as never);

    const completeRecovery = () =>
      completeSsoRecovery({
        stateId: "test-state",
        sessionUserId: "user_1",
        sessionToken: "current-session-token",
      });

    test("names what was removed, in the user's own locale", async () => {
      asUnverifiedUser();

      await completeRecovery();

      expect(sendSsoRecoveryFactorsRemovedEmail).toHaveBeenCalledWith({
        email: "john.doe@example.com",
        locale: "de-DE",
        passwordRemoved: true,
        twoFactorRemoved: true,
      });
    });

    // Each flag reports what this account actually had, so the mail never claims to have removed a
    // factor the user never enrolled.
    test("reports only the factors that were really there", async () => {
      asUnverifiedUser();
      txTwoFactorDeleteMany.mockResolvedValue({ count: 0 }); // no second factor enrolled

      await completeRecovery();

      expect(sendSsoRecoveryFactorsRemovedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ passwordRemoved: true, twoFactorRemoved: false })
      );
    });

    /**
     * The under-reporting trap. 2FA lives in two stores and the strip clears both, but a user who
     * enrolled before the backfill shim landed has only the legacy `User.twoFactorEnabled` latch and no
     * `TwoFactor` row — so counting rows alone would tell exactly that user their second factor was left
     * alone, on the one occasion it was taken away.
     */
    test("reports the second factor for a legacy enrolment with no TwoFactor row", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "john.doe@example.com",
        locale: "en-US",
        emailVerified: false,
        isActive: true,
        identityProvider: "email",
        identityProviderAccountId: null,
      } as never);
      legacyCleared.twoFactor = 1; // this transaction flipped the legacy latch...
      txTwoFactorDeleteMany.mockResolvedValue({ count: 0 }); // ...and there was no row to count

      await completeRecovery();

      expect(sendSsoRecoveryFactorsRemovedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ twoFactorRemoved: true })
      );
    });

    /**
     * The password half of the same trap. A pre-cutover account keeps its hash in `User.password` and
     * may have no credential `Account` row at all, so counting only those rows would tell that user
     * their password survived — on the one occasion it did not.
     */
    test("reports the password for a legacy hash with no credential account", async () => {
      asUnverifiedUser();
      txAccountUpdateMany.mockResolvedValue({ count: 0 }); // no credential row...
      legacyCleared.password = 1; // ...but a legacy hash was cleared
      txTwoFactorDeleteMany.mockResolvedValue({ count: 0 }); // and no second factor was touched

      await completeRecovery();

      // `twoFactorRemoved: false` is the half that only holds once the two legacy writes are told
      // apart — with a shared count it would read `true` off the password's own result.
      expect(sendSsoRecoveryFactorsRemovedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ passwordRemoved: true, twoFactorRemoved: false })
      );
    });

    // Recoveries are not locked against each other, and `user` is read before the transaction opens.
    // A racing second recovery finds the latch already down, so its filtered write matches nothing and
    // it must not mail the owner about a factor the first one removed.
    test("a concurrent recovery that changed nothing reports nothing", async () => {
      // The stale pre-transaction read still says the latch is up — that is the whole trap. Only the
      // filtered write inside the transaction knows this recovery was not the one that flipped it.
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "john.doe@example.com",
        locale: "de-DE",
        emailVerified: false,
        isActive: true,
        identityProvider: "email",
        identityProviderAccountId: null,
        twoFactorEnabled: true,
      } as never);
      legacyCleared.twoFactor = 0; // the other transaction got there first
      txTwoFactorDeleteMany.mockResolvedValue({ count: 0 });
      txAccountUpdateMany.mockResolvedValue({ count: 0 });

      await completeRecovery();

      expect(sendSsoRecoveryFactorsRemovedEmail).not.toHaveBeenCalled();
    });

    // `sendEmail` returns false without throwing when SMTP is unconfigured, so the catch never sees it.
    // Silence there means a second factor was removed and nobody was told — the exact failure this
    // notification exists to prevent, so it has to be attributable in the log.
    test("logs when the mail is not delivered rather than failing silently", async () => {
      asUnverifiedUser();
      vi.mocked(sendSsoRecoveryFactorsRemovedEmail).mockResolvedValue(false);

      await expect(completeRecovery()).resolves.toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user_1" }),
        expect.stringContaining("notification email was not sent")
      );
    });

    // An account with neither factor set has lost nothing, so a mail would be noise.
    test("says nothing when there was nothing to remove", async () => {
      asUnverifiedUser();
      txTwoFactorDeleteMany.mockResolvedValue({ count: 0 });
      txAccountUpdateMany.mockResolvedValue({ count: 0 });

      await completeRecovery();

      expect(sendSsoRecoveryFactorsRemovedEmail).not.toHaveBeenCalled();
    });

    test("says nothing when the account was already verified and nothing was stripped", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "john.doe@example.com",
        locale: "en-US",
        emailVerified: true,
        isActive: true,
        identityProvider: "email",
        identityProviderAccountId: null,
      } as never);

      await completeRecovery();

      expect(sendSsoRecoveryFactorsRemovedEmail).not.toHaveBeenCalled();
    });

    // The strip has already committed by this point, so a mailer outage must not turn a completed
    // recovery into a failed sign-in — the user would be locked out of an account that has already
    // changed shape.
    test("completes the recovery even when the mail cannot be sent", async () => {
      asUnverifiedUser();
      vi.mocked(sendSsoRecoveryFactorsRemovedEmail).mockRejectedValue(new Error("smtp down"));

      await expect(completeRecovery()).resolves.toBe("http://localhost:3000/environments/env_1");
      expect(finalizeSuccessfulSignIn).toHaveBeenCalled();
    });
  });

  test("consumes the intent once the link commits, but never before", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: false,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);

    await completeSsoRecovery({ stateId: "test-state", sessionUserId: "user_1" });

    expect(mocks.consumeSsoRecoveryIntent).toHaveBeenCalledWith("test-state");
  });

  /**
   * The link is what the intent pays for, so a transaction that rolls back must leave the intent
   * spendable — otherwise a transient database fault burns the user's one recovery and the emailed
   * link they still hold goes nowhere.
   */
  test("keeps the intent when the linking transaction rolls back", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: false,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);
    vi.mocked(syncSsoIdentityForUser).mockRejectedValue(new Error("deadlock detected"));

    await expect(completeSsoRecovery({ stateId: "test-state", sessionUserId: "user_1" })).rejects.toThrow(
      "deadlock detected"
    );

    expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
  });

  test("leaves the intent in place when the recovery is rejected", async () => {
    // A mail scanner reaching the completion URL has no session, so it lands on `missing_session`.
    // Consuming there would spend the record before the real user ever clicked their link.
    await expect(completeSsoRecovery({ stateId: "test-state" })).rejects.toThrow("OAuthAccountNotLinked");

    expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
  });

  test("does not clear local auth material for already verified users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: true,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);

    await completeSsoRecovery({
      stateId: "test-state",
      sessionUserId: "user_1",
      sessionToken: "current-session-token",
    });

    expect(txUserUpdate).not.toHaveBeenCalled();
    expect(txTwoFactorDeleteMany).not.toHaveBeenCalled();
    expect(txAccountUpdateMany).not.toHaveBeenCalled();
    expect(txOauthAccessUpdateMany).not.toHaveBeenCalled();
    expect(txOauthRefreshUpdateMany).not.toHaveBeenCalled();
    expect(txOauthConsentDeleteMany).not.toHaveBeenCalled();
    // A proven account is a legitimate one: linking another provider to it must not sign its other
    // sessions out, and must not report a strip that did not happen.
    expect(revokeUserSessionsExcept).not.toHaveBeenCalled();
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_completed",
        newObject: expect.not.objectContaining({ credentialPasswordsCleared: expect.anything() }),
      })
    );
    expect(syncSsoIdentityForUser).toHaveBeenCalledOnce();
  });

  /**
   * The guard keys on `emailVerified` alone. It used to also require `identityProvider === "email"`, but
   * that column is denormalized onto `User` by an `account.create.after` hook, so a security control
   * resting on it goes silently dead if it ever drifts. An unproven address is unproven whatever the
   * denormalized column happens to say.
   */
  test("strips an unverified account even when identityProvider says otherwise", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: false,
      isActive: true,
      identityProvider: "google",
      identityProviderAccountId: "provider-account-1",
    } as any);

    await completeSsoRecovery({
      stateId: "test-state",
      sessionUserId: "user_1",
      sessionToken: "current-session-token",
    });

    // `password: { not: null }` narrows to rows that actually held a credential, so the reported count
    // is rows CHANGED rather than rows matched — an already-null row must not read as a factor removed.
    expect(txAccountUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", provider: "credential", password: { not: null } },
      data: { password: null },
    });
    expect(txTwoFactorDeleteMany).toHaveBeenCalledOnce();
    expect(revokeUserSessionsExcept).toHaveBeenCalledOnce();
  });

  /**
   * The strip has already committed by the time sessions are swept, so a revocation failure must not undo
   * it or fail the recovery — the user would be left with a stripped password and no way through.
   */
  test("still completes recovery when the session sweep fails", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: false,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);
    vi.mocked(revokeUserSessionsExcept).mockRejectedValue(new Error("redis unavailable"));

    const callbackUrl = await completeSsoRecovery({
      stateId: "test-state",
      sessionUserId: "user_1",
      sessionToken: "current-session-token",
    });

    expect(callbackUrl).toBe("http://localhost:3000/environments/env_1");
    expect(txAccountUpdateMany).toHaveBeenCalledOnce();
    // A failed sweep must NOT be recorded as "0 sessions revoked" — same number, opposite incident.
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_completed",
        newObject: expect.objectContaining({
          credentialPasswordsCleared: 1,
          sessionRevocationFailed: true,
        }),
      })
    );
    // `action` discriminator is load-bearing: `toHaveBeenCalledWith` passes when ANY call matches, so
    // without it this would be satisfied by any other queued event lacking the key, and could go green
    // without ever proving the completion event omits it.
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_completed",
        newObject: expect.not.objectContaining({ sessionsRevoked: expect.anything() }),
      })
    );
  });

  test("rejects recovery when the signed-in user does not match the intent owner", async () => {
    await expect(
      completeSsoRecovery({
        stateId: "test-state",
        sessionUserId: "user_2",
      })
    ).rejects.toThrow("OAuthAccountNotLinked");

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_failed",
        status: "failure",
        userId: "user_1",
        newObject: expect.objectContaining({
          failureReason: "session_user_mismatch",
        }),
      })
    );
  });

  test("rejects recovery when there is no signed-in session", async () => {
    await expect(
      completeSsoRecovery({
        stateId: "test-state",
      })
    ).rejects.toThrow("OAuthAccountNotLinked");

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_failed",
        status: "failure",
        userId: "user_1",
        newObject: expect.objectContaining({
          failureReason: "missing_session",
        }),
      })
    );
  });

  test("rejects recovery when the intent provider is invalid", async () => {
    mocks.readSsoRecoveryIntent.mockResolvedValue({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "unknown-provider",
      providerAccountId: "provider-account-1",
      callbackUrl: "http://localhost:3000/environments/env_1",
    });

    await expect(
      completeSsoRecovery({
        stateId: "test-state",
        sessionUserId: "user_1",
      })
    ).rejects.toThrow("OAuthAccountNotLinked");

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_failed",
        status: "failure",
        userId: "user_1",
        newObject: expect.objectContaining({
          failureReason: "invalid_provider",
        }),
      })
    );
  });

  test("rejects invalid or expired recovery intents before looking up any user", async () => {
    mocks.readSsoRecoveryIntent.mockResolvedValue(null);

    await expect(
      completeSsoRecovery({
        stateId: "expired-state",
        sessionUserId: "user_1",
      })
    ).rejects.toThrow("OAuthAccountNotLinked");

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_failed",
        status: "failure",
        userId: "unknown",
        newObject: expect.objectContaining({
          failureReason: "invalid_or_expired_intent",
        }),
      })
    );
  });

  test("rejects recovery when the verified user no longer matches the intended email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "different@example.com",
      locale: "en-US",
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
      isActive: true,
      identityProvider: "google",
      identityProviderAccountId: "provider-account-1",
      password: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: null,
    } as any);

    await expect(
      completeSsoRecovery({
        stateId: "test-state",
        sessionUserId: "user_1",
      })
    ).rejects.toThrow("OAuthAccountNotLinked");

    expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
    expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sso_recovery_failed",
        status: "failure",
        userId: "user_1",
        newObject: expect.objectContaining({
          failureReason: "user_mismatch",
        }),
      })
    );
  });

  test("still completes recovery when sign-in finalization fails", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: new Date("2024-01-01T00:00:00.000Z"),
      isActive: true,
      identityProvider: "google",
      identityProviderAccountId: "provider-account-1",
      password: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: null,
    } as any);
    vi.mocked(finalizeSuccessfulSignIn).mockRejectedValue(new Error("tracking unavailable"));

    await expect(
      completeSsoRecovery({
        stateId: "test-state",
        sessionUserId: "user_1",
      })
    ).resolves.toBe("http://localhost:3000/environments/env_1");

    expect(syncSsoIdentityForUser).toHaveBeenCalledOnce();
  });

  /**
   * The failure redirect must not tell an unauthenticated caller whether a state id exists. Carrying the
   * stored callback on the pre-session branches did exactly that — a held id got the record's callback
   * back, an unknown one got a bare redirect — and leaked where that user was headed with it.
   */
  test.each([
    ["missing_session", { stateId: "test-state" }],
    ["session_user_mismatch", { stateId: "test-state", sessionUserId: "someone-else" }],
  ])("withholds the stored callback from a caller who is not the intent's user (%s)", async (_r, args) => {
    await expect(completeSsoRecovery(args)).rejects.toMatchObject({ callbackUrl: undefined });
  });

  test("withholds the stored callback when the provider is unusable, before any session is checked", async () => {
    mocks.readSsoRecoveryIntent.mockResolvedValue({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "unknown-provider",
      providerAccountId: "provider-account-1",
      callbackUrl: "http://localhost:3000/environments/env_1",
      createdAt: Date.now(),
    });

    await expect(
      completeSsoRecovery({ stateId: "test-state", sessionUserId: "user_1" })
    ).rejects.toMatchObject({ callbackUrl: undefined });
  });

  test("returns the callback once the caller is proven to be the intent's own user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "someone.else@example.com",
      locale: "en-US",
      emailVerified: true,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);

    await expect(
      completeSsoRecovery({ stateId: "test-state", sessionUserId: "user_1" })
    ).rejects.toMatchObject({ callbackUrl: "http://localhost:3000/environments/env_1" });
  });

  test("preserves only safe callback URLs in the failure redirect", () => {
    expect(getSsoRecoveryFailureRedirectUrl("http://localhost:3000/invite?token=invite-token")).toBe(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Finvite%3Ftoken%3Dinvite-token"
    );
    expect(getSsoRecoveryFailureRedirectUrl("https://evil.example/phish")).toBe(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked"
    );
  });
});
