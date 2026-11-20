import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { reconcileApiKeyRelationships } from "@/lib/authzed/api-key";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";
import { finalizeSuccessfulSignIn } from "@/modules/auth/lib/sign-in-tracking";
import { buildVerificationRequestedPath } from "@/modules/auth/lib/verification-links";
import { sendSsoRecoveryFactorsRemovedEmail, sendVerificationEmail } from "@/modules/email";
import { syncSsoIdentityForUser } from "./account-linking";
import { createSsoRecoveryProof } from "./recovery-proof";
import {
  SsoRecoveryError,
  cancelSsoRecovery,
  completeSsoRecovery,
  getSsoRecoveryConfirmUrl,
  getSsoRecoveryConfirmation,
  getSsoRecoveryFailureRedirectUrl,
  getSsoRecoveryRefusal,
  getSsoRecoverySecondFactorRedirectUrl,
  getSsoRecoverySecondFactorUnavailableRedirectUrl,
  startSsoRecovery,
} from "./sso-recovery";

const mocks = vi.hoisted(() => ({
  createEmailToken: vi.fn(),
  createSsoRecoveryIntent: vi.fn(),
  readSsoRecoveryIntent: vi.fn(),
  consumeSsoRecoveryIntent: vi.fn(),
  claimSsoRecoveryIntent: vi.fn(),
  releaseClaim: vi.fn(),
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
    AUTH_SECRET: "test-auth-secret",
  };
});

vi.mock("@/lib/jwt", () => ({
  createEmailToken: mocks.createEmailToken,
}));

// The SpiceDB side of the API key sweep. `runPostCommitProjection` itself is left real: it is the
// boundary that swallows a projection failure, and a test that mocked it would prove nothing about it.
vi.mock("@/lib/authzed/api-key", () => ({
  reconcileApiKeyRelationships: vi.fn(),
}));

vi.mock("./recovery-intent", () => ({
  createSsoRecoveryIntent: mocks.createSsoRecoveryIntent,
  readSsoRecoveryIntent: mocks.readSsoRecoveryIntent,
  consumeSsoRecoveryIntent: mocks.consumeSsoRecoveryIntent,
  claimSsoRecoveryIntent: mocks.claimSsoRecoveryIntent,
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

/**
 * Completion from the browser that opened the emailed link, i.e. carrying a valid proof cookie for the
 * intent's user (ENG-7310). Most cases below are about what happens past that gate, so they go through
 * here; the gate itself is tested against `completeSsoRecovery` directly.
 */
const completeWithValidProof = (args: Parameters<typeof completeSsoRecovery>[0]) =>
  completeSsoRecovery({ recoveryProof: createSsoRecoveryProof("user_1", args.stateId), ...args });

/** The address the linking transaction finds on the user row it locks. */
const lockedUserEmail = { value: "john.doe@example.com" };
/** Set to make the locked row disagree with the guards' read of `emailVerified`. */
const lockedEmailVerified: { value: boolean | undefined } = { value: undefined };

describe("sso-recovery", () => {
  let transactionCommitted = false;
  let consumedAfterCommit: boolean | null = null;
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
  const txApiKeyFindMany = vi.fn();
  const txApiKeyDeleteMany = vi.fn();
  // Both new stores belong in the stub: post-ENG-1054 the password lives on `Account` and the 2FA secret
  // in `TwoFactor`, so a strip that only touched `user` is exactly the bug ENG-2557 fixed.
  const tx = {
    // The user row is locked to re-check its address before the link. The locked row answers with the user the guards read, unless a test changes it under the lock.
    $queryRaw: async (strings: TemplateStringsArray) => {
      if (!strings.join("").includes('FROM "User"')) return [];
      const read = (await vi.mocked(prisma.user.findUnique).mock.results.at(-1)?.value) as
        | { emailVerified: boolean }
        | null
        | undefined;
      return [
        {
          email: lockedUserEmail.value,
          emailVerified: lockedEmailVerified.value ?? read?.emailVerified ?? false,
        },
      ];
    },
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
    apiKey: {
      findMany: txApiKeyFindMany,
      deleteMany: txApiKeyDeleteMany,
    },
  };

  /** The squatter minted keys: the ENG-2634 starting state, opted into per test. */
  const withApiKeys = (ids: string[]) => {
    txApiKeyFindMany.mockResolvedValue(ids.map((id) => ({ id })));
    txApiKeyDeleteMany.mockResolvedValue({ count: ids.length });
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
    withApiKeys([]); // the common case: no keys, so nothing to reconcile or to mail about
    vi.mocked(revokeUserSessionsExcept).mockResolvedValue(2);
    // The mock carries a commit step. Without one, `consumeSsoRecoveryIntent` moved INSIDE the
    // transaction was indistinguishable from after it — and inside is wrong, because Redis is not part
    // of the transaction, so a rollback would leave the intent spent with nothing linked.
    transactionCommitted = false;
    consumedAfterCommit = null;
    vi.mocked(prisma.$transaction).mockImplementation(
      async (callback: (txClient: Prisma.TransactionClient) => Promise<unknown>) => {
        const result = await callback(tx as unknown as Prisma.TransactionClient);
        transactionCommitted = true;
        return result;
      }
    );
    mocks.consumeSsoRecoveryIntent.mockImplementation(async () => {
      consumedAfterCommit = transactionCommitted;
      return true;
    });
    mocks.releaseClaim.mockResolvedValue(undefined);
    mocks.claimSsoRecoveryIntent.mockResolvedValue({ kind: "claimed", release: mocks.releaseClaim });
    lockedUserEmail.value = "john.doe@example.com";
    lockedEmailVerified.value = undefined;
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
      ssoRecoveryStateId: "state-id",
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
    withApiKeys(["apikey_1", "apikey_2"]);
    // Same commit-step trick as `consumeSsoRecoveryIntent`: SpiceDB is not part of the transaction, so a
    // reconciliation issued inside it would survive a rollback and delete relationships for keys that
    // still exist.
    let reconciledAfterCommit: boolean | null = null;
    vi.mocked(reconcileApiKeyRelationships).mockImplementation(async () => {
      reconciledAfterCommit = transactionCommitted;
      return { status: "projected" } as never;
    });

    const callbackUrl = await completeWithValidProof({
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
    // The keys THIS user minted (ENG-2634): scoped by creator, not by organization, so a colleague's key
    // on an organization the squatter reached is left alone.
    expect(txApiKeyDeleteMany).toHaveBeenCalledWith({ where: { createdBy: "user_1" } });
    expect(reconcileApiKeyRelationships).toHaveBeenCalledWith({ apiKeyIds: ["apikey_1", "apikey_2"] });
    expect(reconciledAfterCommit).toBe(true);
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
          apiKeysRevoked: 2,
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
      completeWithValidProof({
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
        apiKeysRemoved: false,
      });
    });

    /**
     * ENG-2634. An account with neither sign-in factor set can still have minted API keys, and for a
     * legitimate owner those are the removal with a blast radius — integrations stop working — so the
     * keys alone have to be enough to send the mail.
     */
    test("reports deleted API keys on their own, when neither sign-in factor was set", async () => {
      asUnverifiedUser();
      txTwoFactorDeleteMany.mockResolvedValue({ count: 0 });
      txAccountUpdateMany.mockResolvedValue({ count: 0 });
      withApiKeys(["apikey_1"]);

      await completeRecovery();

      expect(sendSsoRecoveryFactorsRemovedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ passwordRemoved: false, twoFactorRemoved: false, apiKeysRemoved: true })
      );
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

    await completeWithValidProof({ stateId: "test-state", sessionUserId: "user_1" });

    expect(mocks.consumeSsoRecoveryIntent).toHaveBeenCalledWith("test-state");
    // After the COMMIT, not merely somewhere in the function: Redis is outside the transaction, so
    // consuming inside it would spend the intent even on a rollback.
    expect(consumedAfterCommit).toBe(true);
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

    await expect(completeWithValidProof({ stateId: "test-state", sessionUserId: "user_1" })).rejects.toThrow(
      "deadlock detected"
    );

    expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
  });

  test("leaves the intent in place when the recovery is rejected", async () => {
    // A mail scanner reaching the completion URL has no session, so it lands on `missing_session`.
    // Consuming there would spend the record before the real user ever clicked their link.
    await expect(completeWithValidProof({ stateId: "test-state" })).rejects.toThrow("OAuthAccountNotLinked");

    expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
  });

  /**
   * Single use is hygiene here, not the thing that makes replay safe.
   *
   * If `consumeSsoRecoveryIntent` cannot delete — Redis unreachable at exactly that moment — the record
   * survives to its TTL and a second completion runs. That is harmless by construction rather than by
   * luck: `syncSsoIdentityForUser` upserts, and the first completion set `emailVerified`, so
   * `reclaimUnverifiedLocalAuthIfNeeded` finds nothing to strip and the session sweep it guards never
   * fires. This is the alternative to claiming an `in_progress` state before the transaction, which
   * would need the same Redis that just failed the delete and would strand the user until TTL if the
   * process died between claim and commit.
   */
  test("a replayed completion relinks idempotently, stripping and sweeping nothing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: false,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);

    // First completion: the account is unproven, so this is the one that strips and sweeps. Its delete
    // fails, so the record stays readable and claimable for the second.
    mocks.consumeSsoRecoveryIntent.mockResolvedValue(false);
    await completeWithValidProof({ stateId: "test-state", sessionUserId: "user_1" });
    expect(txUserUpdate).toHaveBeenCalled();
    expect(revokeUserSessionsExcept).toHaveBeenCalled();

    // The delete failed, so the record is still there and the emailed link is spent again. The user
    // row is now proven, exactly as the first completion left it.
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: true,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);
    txUserUpdate.mockClear();
    vi.mocked(revokeUserSessionsExcept).mockClear();
    vi.mocked(syncSsoIdentityForUser).mockClear();

    await expect(completeWithValidProof({ stateId: "test-state", sessionUserId: "user_1" })).resolves.toBe(
      "http://localhost:3000/environments/env_1"
    );

    expect(syncSsoIdentityForUser).toHaveBeenCalledOnce(); // an upsert, so no second identity
    expect(txUserUpdate).not.toHaveBeenCalled(); // nothing left to strip
    expect(revokeUserSessionsExcept).not.toHaveBeenCalled(); // and so no second session sweep
  });

  test("a deleted intent refuses a second open before it writes", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: true,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as Awaited<ReturnType<typeof prisma.user.findUnique>>);
    // The first completion deletes the record, so a later open reads nothing and stops at the read. The
    // claim gate, which also answers `spent` here, is pinned by the claim table below.
    mocks.consumeSsoRecoveryIntent.mockImplementation(async () => {
      mocks.readSsoRecoveryIntent.mockResolvedValue(null);
      mocks.claimSsoRecoveryIntent.mockResolvedValue({ kind: "spent" });
      return true;
    });
    await completeWithValidProof({ stateId: "test-state", sessionUserId: "user_1" });
    vi.mocked(prisma.$transaction).mockClear();

    const replay = completeWithValidProof({ stateId: "test-state", sessionUserId: "user_1" });

    await expect(replay.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe("intent_unusable");
    expect(prisma.$transaction).not.toHaveBeenCalled();
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

    await completeWithValidProof({
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
    expect(txApiKeyDeleteMany).not.toHaveBeenCalled();
    expect(reconcileApiKeyRelationships).not.toHaveBeenCalled();
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

    await completeWithValidProof({
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

    const callbackUrl = await completeWithValidProof({
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

  describe("binding completion to the browser that opened the emailed link (ENG-7310)", () => {
    const expectUnprovenRejection = async (recoveryProof: string | undefined) => {
      const outcome = completeSsoRecovery({
        stateId: "test-state",
        recoveryProof,
        sessionUserId: "user_1",
      });

      await expect(outcome).rejects.toThrow("OAuthAccountNotLinked");
      await expect(outcome.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe("unproven");
      // Fails before any write, and before the session is even looked at.
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
      expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
      expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "sso_recovery_failed",
          userId: "user_1",
          newObject: expect.objectContaining({ failureReason: "missing_recovery_proof" }),
        })
      );
    };

    test("a signed-in account holder's browser cannot complete a recovery it did not open the link for", async () => {
      // The attacker's browser starts recovery with an identity claiming the victim's address, and is
      // handed the completion URL. Everything it needs is what the victim's browser then sends.
      vi.mocked(sendVerificationEmail).mockResolvedValue(true);
      await startSsoRecovery({
        existingUser: {
          id: "user_1",
          email: "john.doe@example.com",
          locale: "en-US",
          emailVerified: true,
          isActive: true,
          identityProvider: "email",
          identityProviderAccountId: null,
          twoFactorEnabled: true,
        },
        provider: "openid",
        account: { type: "oauth", provider: "openid", providerAccountId: "attacker-sub" },
        callbackUrl: "http://localhost:3000/",
      });
      const completionUrl = vi.mocked(buildVerificationRequestedPath).mock.calls[0][0].callbackUrl!;
      const stateId = new URL(completionUrl).searchParams.get("state")!;

      const outcome = completeSsoRecovery({ stateId, sessionUserId: "user_1" });

      await expect(outcome).rejects.toThrow("OAuthAccountNotLinked");
      // `unproven`, not a later guard: the session matches the intent, so on main this linked.
      await expect(outcome.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe("unproven");
      expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
    });

    test("rejects a completion with no proof", async () => {
      await expectUnprovenRejection(undefined);
    });

    test("rejects a proof minted for another recovery", async () => {
      await expectUnprovenRejection(createSsoRecoveryProof("user_1", "another-state"));
    });

    test("rejects a proof minted for another user's link", async () => {
      await expectUnprovenRejection(createSsoRecoveryProof("user_2", "test-state"));
    });

    test("rejects a malformed proof", async () => {
      await expectUnprovenRejection(`${createSsoRecoveryProof("user_1", "test-state")}x`);
    });

    test("checks the proof before the session, so a proofless browser is never told about the session", async () => {
      const outcome = completeSsoRecovery({ stateId: "test-state", sessionUserId: "user_2" });

      await expect(outcome.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe("unproven");
    });

    test("completes once the proof matches the intent's user and state", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user_1",
        email: "john.doe@example.com",
        locale: "en-US",
        emailVerified: true,
        isActive: true,
        identityProvider: "email",
        identityProviderAccountId: null,
        twoFactorEnabled: false,
      } as never);

      await expect(
        completeSsoRecovery({
          stateId: "test-state",
          recoveryProof: createSsoRecoveryProof("user_1", "test-state"),
          sessionUserId: "user_1",
        })
      ).resolves.toBe("http://localhost:3000/environments/env_1");
      expect(syncSsoIdentityForUser).toHaveBeenCalled();
    });
  });

  describe("the confirmation step (ENG-7395)", () => {
    const verifiedUser = {
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: true,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
      twoFactorEnabled: false,
    };

    test("names the provider and writes nothing", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(verifiedUser as never);

      await expect(
        getSsoRecoveryConfirmation({
          stateId: "test-state",
          recoveryProof: createSsoRecoveryProof("user_1", "test-state"),
          sessionUserId: "user_1",
        })
      ).resolves.toEqual({ provider: "google", email: "john.doe@example.com" });

      // A page view must not link, strip, consume or finalize anything.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
      expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
      expect(finalizeSuccessfulSignIn).not.toHaveBeenCalled();
    });

    test.each([
      ["no proof", undefined, "user_1", "unproven"],
      ["another user's session", createSsoRecoveryProof("user_1", "test-state"), "user_2", "rejected"],
      ["no session", createSsoRecoveryProof("user_1", "test-state"), undefined, "rejected"],
    ])(
      "refuses %s exactly as the completion would",
      async (_label, recoveryProof, sessionUserId, failure) => {
        const outcome = getSsoRecoveryConfirmation({ stateId: "test-state", recoveryProof, sessionUserId });

        await expect(outcome.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe(failure);
        expect(prisma.$transaction).not.toHaveBeenCalled();
      }
    );

    test("a cancel spends the intent, links nothing, and records why", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(verifiedUser as never);

      await cancelSsoRecovery({
        stateId: "test-state",
        recoveryProof: createSsoRecoveryProof("user_1", "test-state"),
        sessionUserId: "user_1",
      });

      expect(mocks.consumeSsoRecoveryIntent).toHaveBeenCalledWith("test-state");
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
      expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "sso_recovery_failed",
          userId: "user_1",
          newObject: expect.objectContaining({ failureReason: "cancelled_by_user" }),
        })
      );
    });

    test("a cancel that loses the race to a link records no cancellation", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(verifiedUser as never);
      mocks.consumeSsoRecoveryIntent.mockResolvedValue(false);

      const outcome = cancelSsoRecovery({
        stateId: "test-state",
        recoveryProof: createSsoRecoveryProof("user_1", "test-state"),
        sessionUserId: "user_1",
      });

      await expect(outcome.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe(
        "intent_unusable"
      );
      // The guards passed, so they audited nothing; the lost race must not audit either.
      expect(mocks.queueAuditEventBackground).not.toHaveBeenCalled();
    });

    test("only the browser that could link can cancel", async () => {
      const outcome = cancelSsoRecovery({ stateId: "test-state", sessionUserId: "user_1" });

      await expect(outcome.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe("unproven");
      // Someone holding just the state id cannot burn the account holder's recovery.
      expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
    });

    /**
     * Link and Cancel each authorize, then write. Clicked together, both used to pass the guards and both
     * acted: the identity linked while the cancellation was recorded. Now each takes a claim first, and
     * the one that loses it writes nothing.
     */
    describe("link and cancel take turns", () => {
      const proven = () => ({
        stateId: "test-state",
        recoveryProof: createSsoRecoveryProof("user_1", "test-state"),
        sessionUserId: "user_1",
      });

      beforeEach(() => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue(verifiedUser as never);
      });

      test("a link that cannot claim the recovery writes nothing", async () => {
        mocks.claimSsoRecoveryIntent.mockResolvedValue({ kind: "held" });

        const outcome = completeSsoRecovery(proven());

        await expect(outcome.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe(
          "intent_unusable"
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
        expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
      });

      test("a cancel that cannot claim the recovery spends nothing and records no cancellation", async () => {
        mocks.claimSsoRecoveryIntent.mockResolvedValue({ kind: "held" });

        const outcome = cancelSsoRecovery(proven());

        await expect(outcome.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe(
          "intent_unusable"
        );
        expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
        expect(mocks.queueAuditEventBackground).not.toHaveBeenCalledWith(
          expect.objectContaining({
            newObject: expect.objectContaining({ failureReason: "cancelled_by_user" }),
          })
        );
        expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
          expect.objectContaining({
            newObject: expect.objectContaining({ failureReason: "claimed_by_another_request" }),
          })
        );
      });

      test("a link holds its claim until the intent is spent, then gives it back", async () => {
        const order: string[] = [];
        mocks.consumeSsoRecoveryIntent.mockImplementation(async () => {
          order.push("consume");
          return true;
        });
        mocks.releaseClaim.mockImplementation(async () => {
          order.push("release");
        });

        await completeSsoRecovery(proven());

        expect(order).toEqual(["consume", "release"]);
      });

      test("a browser the guards refuse never takes the claim, so it cannot hold the recovery up", async () => {
        const unproven = { stateId: "test-state", sessionUserId: "user_1" };

        await expect(completeSsoRecovery(unproven)).rejects.toThrow("OAuthAccountNotLinked");
        await expect(cancelSsoRecovery(unproven)).rejects.toThrow("OAuthAccountNotLinked");
        expect(mocks.claimSsoRecoveryIntent).not.toHaveBeenCalled();
      });

      /** Why the claim was lost decides the audit reason: a Redis outage is not another request. */
      test.each([
        ["held", "claimed_by_another_request"],
        ["spent", "intent_already_spent"],
        ["unavailable", "claim_unavailable"],
      ] as const)("a claim lost as %s is audited as %s", async (kind, failureReason) => {
        mocks.claimSsoRecoveryIntent.mockResolvedValue({ kind });

        await expect(completeSsoRecovery(proven())).rejects.toThrow("OAuthAccountNotLinked");
        expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
          expect.objectContaining({
            action: "sso_recovery_failed",
            newObject: expect.objectContaining({ failureReason }),
          })
        );
      });

      test("a link whose intent could not be spent keeps the claim, so no cancel can follow it", async () => {
        mocks.consumeSsoRecoveryIntent.mockResolvedValue(false);

        await completeSsoRecovery(proven());

        expect(syncSsoIdentityForUser).toHaveBeenCalled();
        expect(mocks.releaseClaim).not.toHaveBeenCalled();
      });

      /**
       * The address is checked before the claim; an email change that commits after that check must not
       * get linked anyway. The transaction re-reads it holding the user row, and refuses on a mismatch.
       */
      test("an address that changed after the guards ran stops the link inside its transaction", async () => {
        lockedUserEmail.value = "changed@example.com";

        const outcome = completeSsoRecovery(proven());

        await expect(outcome.catch((error: SsoRecoveryError) => error.failure)).resolves.toBe("rejected");
        expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
        expect(txTwoFactorDeleteMany).not.toHaveBeenCalled();
        expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
        // Traced like the same mismatch caught by the guard.
        expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
          expect.objectContaining({ newObject: expect.objectContaining({ failureReason: "user_mismatch" }) })
        );
        // Rolled back, so the recovery is free again for a retry.
        expect(mocks.releaseClaim).toHaveBeenCalledTimes(1);
      });

      /**
       * Two recoveries for one user hold different intents, so both pass the guards on an unverified
       * address. The second waits on the row lock while the first verifies it, and must then decide the
       * reclaim from the locked row: stripping again would sweep the sessions the first one kept.
       */
      test("an address verified by a concurrent recovery is not reclaimed a second time", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
          ...verifiedUser,
          emailVerified: false,
        } as never);
        lockedEmailVerified.value = true;

        await completeSsoRecovery({ ...proven(), sessionToken: "kept-token" });

        expect(syncSsoIdentityForUser).toHaveBeenCalled();
        expect(txTwoFactorDeleteMany).not.toHaveBeenCalled();
        expect(revokeUserSessionsExcept).not.toHaveBeenCalled();
        expect(sendSsoRecoveryFactorsRemovedEmail).not.toHaveBeenCalled();
      });

      test("a link that rolls back gives its claim back, so the recovery can be retried", async () => {
        vi.mocked(prisma.$transaction).mockRejectedValue(new Error("rolled back"));

        await expect(completeSsoRecovery(proven())).rejects.toThrow("rolled back");
        expect(mocks.releaseClaim).toHaveBeenCalledTimes(1);
        expect(mocks.consumeSsoRecoveryIntent).not.toHaveBeenCalled();
      });

      test("a cancel gives its claim back after spending the intent", async () => {
        await cancelSsoRecovery(proven());

        expect(mocks.consumeSsoRecoveryIntent).toHaveBeenCalledWith("test-state");
        expect(mocks.releaseClaim).toHaveBeenCalledTimes(1);
      });
    });

    test("points at the confirmation page for a state", () => {
      expect(getSsoRecoveryConfirmUrl("abc")).toBe("http://localhost:3000/sso-recovery/confirm?state=abc");
    });

    test.each([
      [
        "unproven",
        new SsoRecoveryError("unproven", "http://localhost:3000/secret"),
        "error=sso_recovery_link_not_opened",
        false,
        false,
      ],
      [
        "intent_unusable",
        new SsoRecoveryError("intent_unusable", "http://localhost:3000/secret"),
        "error=OAuthAccountNotLinked",
        false,
        false,
      ],
      [
        "rejected with its own callback",
        new SsoRecoveryError("rejected", "http://localhost:3000/secret"),
        "error=OAuthAccountNotLinked",
        true,
        true,
      ],
      ["an unexpected error", new Error("boom"), "error=OAuthAccountNotLinked", false, true],
    ])(
      "maps %s to its redirect and its session cost",
      (_label, error, code, carriesCallback, revokesSession) => {
        const refusal = getSsoRecoveryRefusal(error);

        expect(refusal.redirectUrl).toContain(code);
        expect(refusal.redirectUrl.includes("callbackUrl=")).toBe(carriesCallback);
        expect(refusal.revokesSession).toBe(revokesSession);
      }
    );
  });

  test("rejects recovery when the signed-in user does not match the intent owner", async () => {
    await expect(
      completeWithValidProof({
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
      completeWithValidProof({
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
      completeWithValidProof({
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
      completeWithValidProof({
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

  /**
   * The failure KIND, not the message.
   *
   * Both kinds carry `OAUTH_ACCOUNT_NOT_LINKED_ERROR`, so every `rejects.toThrow("OAuthAccountNotLinked")`
   * in this file passes for either one — which left the discriminant itself untested. It is what the
   * completion route branches on to decide whether to revoke the caller's session, so reporting an
   * absent intent as a rejection silently undoes the fix for a second open of a link that is replayable
   * by design: the user gets signed in by the link and then signed straight back out, told the linking
   * failed, after it had already succeeded. Caught by mutation, not by reading.
   */
  const failureKindOf = async (completion: Promise<unknown>): Promise<unknown> => {
    const error = await completion.then(() => null).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(SsoRecoveryError);

    return (error as SsoRecoveryError).failure;
  };

  test("reports an intent that did not come back as unusable, never as a rejection", async () => {
    // Null covers all five: expired, already consumed, never issued, Redis unreadable, malformed.
    mocks.readSsoRecoveryIntent.mockResolvedValue(null);

    await expect(
      failureKindOf(completeWithValidProof({ stateId: "expired-state", sessionUserId: "user_1" }))
    ).resolves.toBe("intent_unusable");
  });

  test("reports a guard turning a live intent down as a rejection", async () => {
    // No session, so completion stops at `missing_session` with the record still readable.
    await expect(failureKindOf(completeWithValidProof({ stateId: "test-state" }))).resolves.toBe("rejected");
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
      completeWithValidProof({
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
      completeWithValidProof({
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
      completeWithValidProof({ stateId: "test-state", sessionUserId: "user_1" })
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
      completeWithValidProof({ stateId: "test-state", sessionUserId: "user_1" })
    ).rejects.toMatchObject({ callbackUrl: "http://localhost:3000/environments/env_1" });
  });

  /**
   * The last guard between an unsigned Redis record and an open redirect.
   *
   * `readSsoRecoveryIntent` type-checks the stored `callbackUrl`, but it cannot vouch for the origin —
   * the record carries no signature, unlike the JWT it replaced. So completion re-validates before
   * handing the value back, and this is the test that keeps that line alive: a mutation sweep showed
   * the whole return could be reduced to `intent.callbackUrl` with the entire suite still green.
   */
  test.each([
    ["an off-origin absolute URL", "https://evil.example/steal"],
    ["a scheme-relative pathname (ENG-1636)", "http://localhost:3000//evil.example"],
    ["a non-http scheme", "javascript:alert(1)"],
    ["credentials in the authority", "http://user:pass@localhost:3000/x"],
  ])("falls back to the app origin rather than redirecting to %s", async (_label, callbackUrl) => {
    mocks.readSsoRecoveryIntent.mockResolvedValue({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "google",
      providerAccountId: "provider-account-1",
      callbackUrl,
      createdAt: Date.now(),
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: true,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    } as any);

    await expect(completeWithValidProof({ stateId: "test-state", sessionUserId: "user_1" })).resolves.toBe(
      "http://localhost:3000"
    );
  });

  test("preserves only safe callback URLs in the failure redirect", () => {
    expect(getSsoRecoveryFailureRedirectUrl("http://localhost:3000/invite?token=invite-token")).toBe(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Finvite%3Ftoken%3Dinvite-token"
    );
    expect(getSsoRecoveryFailureRedirectUrl("https://evil.example/phish")).toBe(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked"
    );
  });

  test("sends a 2FA user to the login page with the completion URL as callbackUrl and no error", () => {
    expect(
      getSsoRecoverySecondFactorRedirectUrl(
        "http://localhost:3000/api/auth/sso/recovery/complete?state=test-state"
      )
    ).toBe(
      "http://localhost:3000/auth/login?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fsso%2Frecovery%2Fcomplete%3Fstate%3Dtest-state"
    );
    expect(getSsoRecoverySecondFactorRedirectUrl("https://evil.example/phish")).toBe(
      "http://localhost:3000/auth/login"
    );
  });

  test("names the dead end when credential sign-in is off, filtering callbacks the same way", () => {
    expect(
      getSsoRecoverySecondFactorUnavailableRedirectUrl(
        "http://localhost:3000/api/auth/sso/recovery/complete?state=test-state"
      )
    ).toBe(
      "http://localhost:3000/auth/login?error=sso_recovery_second_factor_unavailable&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fsso%2Frecovery%2Fcomplete%3Fstate%3Dtest-state"
    );
    expect(getSsoRecoverySecondFactorUnavailableRedirectUrl("https://evil.example/phish")).toBe(
      "http://localhost:3000/auth/login?error=sso_recovery_second_factor_unavailable"
    );
  });
});
