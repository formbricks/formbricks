import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";
import { finalizeSuccessfulSignIn } from "@/modules/auth/lib/sign-in-tracking";
import { buildVerificationRequestedPath } from "@/modules/auth/lib/verification-links";
import { sendVerificationEmail } from "@/modules/email";
import { syncSsoIdentityForUser } from "./account-linking";
import { createSsoRecoveryProof, getSsoRecoveryStateId } from "./recovery-proof";
import {
  SsoRecoveryError,
  cancelSsoRecovery,
  completeSsoRecovery,
  getSsoRecoveryConfirmUrl,
  getSsoRecoveryConfirmation,
  getSsoRecoveryFailureRedirectUrl,
  getSsoRecoveryRefusal,
  startSsoRecovery,
} from "./sso-recovery";

const mocks = vi.hoisted(() => ({
  createEmailToken: vi.fn(),
  createSsoRelinkIntent: vi.fn(),
  verifySsoRelinkIntent: vi.fn(),
  queueAuditEventBackground: vi.fn(),
  claimSsoRecovery: vi.fn(),
  markSsoRecoverySpent: vi.fn(),
  releaseClaim: vi.fn(),
}));

vi.mock("./recovery-claim", () => ({
  claimSsoRecovery: mocks.claimSsoRecovery,
  markSsoRecoverySpent: mocks.markSsoRecoverySpent,
}));

/** The address and verification state the linking transaction finds on the user row it locks. */
const lockedUserEmail = { value: "john.doe@example.com" };
/** Set to make the locked row disagree with the guards' read of `emailVerified`. */
const lockedEmailVerified: { value: boolean | undefined } = { value: undefined };

/**
 * Completion from the browser that opened the emailed link, i.e. carrying a valid proof cookie for the
 * intent's user and this recovery (ENG-7310). Most cases below are about what happens past that gate.
 */
const completeWithValidProof = (args: Parameters<typeof completeSsoRecovery>[0]) => {
  let userId = "user_1";
  try {
    userId = mocks.verifySsoRelinkIntent(args.intentToken).userId;
  } catch {
    // An intent that does not verify is refused before the proof is read.
  }
  return completeSsoRecovery({
    recoveryProof: createSsoRecoveryProof(userId, getSsoRecoveryStateId(args.intentToken)),
    ...args,
  });
};

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
    // The proof is an HMAC under this secret (ENG-7310).
    NEXTAUTH_SECRET: "test-nextauth-secret",
  };
});

vi.mock("@/lib/jwt", () => ({
  createEmailToken: mocks.createEmailToken,
  createSsoRelinkIntent: mocks.createSsoRelinkIntent,
  verifySsoRelinkIntent: mocks.verifySsoRelinkIntent,
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
  },
  syncSsoIdentityForUser: vi.fn(),
}));

describe("sso-recovery", () => {
  const txUserUpdate = vi.fn();
  const txTwoFactorDeleteMany = vi.fn();
  const txAccountUpdateMany = vi.fn();
  const txOauthAccessUpdateMany = vi.fn();
  const txOauthRefreshUpdateMany = vi.fn();
  const txOauthConsentDeleteMany = vi.fn();
  // Both new stores belong in the stub: post-ENG-1054 the password lives on `Account` and the 2FA secret
  // in `TwoFactor`, so a strip that only touched `user` is exactly the bug ENG-2557 fixed.
  const tx = {
    // The user row is locked to re-check its address before the link. The locked row answers with the
    // user the guards read, unless a test changes it under the lock.
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
    lockedUserEmail.value = "john.doe@example.com";
    lockedEmailVerified.value = undefined;
    mocks.releaseClaim.mockResolvedValue(undefined);
    mocks.claimSsoRecovery.mockResolvedValue({ kind: "claimed", release: mocks.releaseClaim });
    mocks.markSsoRecoverySpent.mockResolvedValue(true);
    mocks.createSsoRelinkIntent.mockReturnValue("intent-token");
    mocks.verifySsoRelinkIntent.mockReturnValue({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "google",
      providerAccountId: "provider-account-1",
      callbackUrl: "http://localhost:3000/environments/env_1",
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
      callbackUrl: "http://localhost:3000/api/auth/sso/recovery/complete?intent=intent-token",
      purpose: "sso_recovery",
      // The mailed link is bound to this recovery (ENG-7310).
      ssoRecoveryStateId: getSsoRecoveryStateId("intent-token"),
    });
    expect(buildVerificationRequestedPath).toHaveBeenCalledWith({
      token: "email-token",
      callbackUrl: "http://localhost:3000/api/auth/sso/recovery/complete?intent=intent-token",
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

    const callbackUrl = await completeWithValidProof({
      intentToken: "test-intent",
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
        password: null,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });
    // The live stores, which the pre-ENG-2557 implementation never touched.
    expect(txTwoFactorDeleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    // Scoped by owner, NOT by `providerAccountId`/`issuer`: those are account-key columns and a drifted key
    // (ENG-2555) would make a key-filtered query walk past a row still holding a live hash.
    expect(txAccountUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", provider: "credential" },
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
      intentToken: "test-intent",
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

    await completeWithValidProof({
      intentToken: "test-intent",
      sessionUserId: "user_1",
      sessionToken: "current-session-token",
    });

    expect(txAccountUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", provider: "credential" },
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
      intentToken: "test-intent",
      sessionUserId: "user_1",
      sessionToken: "current-session-token",
    });

    expect(callbackUrl).toBe("http://localhost:3000/environments/env_1");
    expect(txAccountUpdateMany).toHaveBeenCalledOnce();
    // Logged by name and frames, never the store's message.
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errName: "Error", userId: "user_1" }),
      "Failed to revoke sessions after reclaiming unverified local auth"
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("redis unavailable");
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
      completeWithValidProof({
        intentToken: "test-intent",
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
        intentToken: "test-intent",
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
    mocks.verifySsoRelinkIntent.mockReturnValue({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "unknown-provider",
      providerAccountId: "provider-account-1",
      callbackUrl: "http://localhost:3000/environments/env_1",
    });

    await expect(
      completeWithValidProof({
        intentToken: "test-intent",
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
    mocks.verifySsoRelinkIntent.mockImplementation(() => {
      throw new Error("expired");
    });

    await expect(
      completeWithValidProof({
        intentToken: "expired-intent",
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
      completeWithValidProof({
        intentToken: "test-intent",
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
        intentToken: "test-intent",
        sessionUserId: "user_1",
      })
    ).resolves.toBe("http://localhost:3000/environments/env_1");

    expect(syncSsoIdentityForUser).toHaveBeenCalledOnce();
  });

  test("preserves only safe callback URLs in the failure redirect", () => {
    expect(getSsoRecoveryFailureRedirectUrl("http://localhost:3000/invite?token=invite-token")).toBe(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Finvite%3Ftoken%3Dinvite-token"
    );
    expect(getSsoRecoveryFailureRedirectUrl("https://evil.example/phish")).toBe(
      "http://localhost:3000/auth/login?error=OAuthAccountNotLinked"
    );
  });

  describe("only the browser that opened the emailed link, and only once (ENG-7310, ENG-7395)", () => {
    const verifiedUser = {
      id: "user_1",
      email: "john.doe@example.com",
      locale: "en-US",
      emailVerified: true,
      isActive: true,
      identityProvider: "email",
      identityProviderAccountId: null,
    };
    const stateId = getSsoRecoveryStateId("test-intent");
    const proven = () => ({
      intentToken: "test-intent",
      recoveryProof: createSsoRecoveryProof("user_1", stateId),
      sessionUserId: "user_1",
    });
    const failureOf = (promise: Promise<unknown>) =>
      promise.then(
        () => "resolved",
        (error: SsoRecoveryError) => error.failure
      );

    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(verifiedUser as never);
    });

    test("a signed-in browser without the proof is refused before anything is read or written", async () => {
      await expect(
        failureOf(completeSsoRecovery({ intentToken: "test-intent", sessionUserId: "user_1" }))
      ).resolves.toBe("unproven");

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(mocks.claimSsoRecovery).not.toHaveBeenCalled();
      expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          newObject: expect.objectContaining({ failureReason: "missing_recovery_proof" }),
        })
      );
    });

    test("a proof for another recovery, or for another user, does not open this one", async () => {
      for (const recoveryProof of [
        // A literal id: vitestSetup fakes `createHash`, so hashing two intents here would give one id.
        createSsoRecoveryProof("user_1", "another-recovery-id"),
        createSsoRecoveryProof("user_2", stateId),
      ]) {
        await expect(failureOf(completeSsoRecovery({ ...proven(), recoveryProof }))).resolves.toBe(
          "unproven"
        );
      }
      expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
    });

    test("links, then marks the recovery spent and gives the claim back", async () => {
      await completeSsoRecovery(proven());

      expect(mocks.claimSsoRecovery).toHaveBeenCalledWith(stateId);
      expect(syncSsoIdentityForUser).toHaveBeenCalled();
      expect(mocks.markSsoRecoverySpent).toHaveBeenCalledWith(stateId);
      expect(mocks.releaseClaim).toHaveBeenCalledTimes(1);
    });

    test.each(["held", "spent", "unavailable"] as const)(
      "a link that cannot claim the recovery (%s) writes nothing",
      async (kind) => {
        mocks.claimSsoRecovery.mockResolvedValue({ kind });

        await expect(failureOf(completeSsoRecovery(proven()))).resolves.toBe("intent_unusable");
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(mocks.markSsoRecoverySpent).not.toHaveBeenCalled();
      }
    );

    test("a link whose recovery could not be marked spent keeps the claim, so no cancel can follow it", async () => {
      mocks.markSsoRecoverySpent.mockResolvedValue(false);

      await completeSsoRecovery(proven());

      expect(syncSsoIdentityForUser).toHaveBeenCalled();
      expect(mocks.releaseClaim).not.toHaveBeenCalled();
    });

    test("a link that rolls back gives its claim back, so the recovery can be retried", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("rolled back"));

      await expect(completeSsoRecovery(proven())).rejects.toThrow("rolled back");
      expect(mocks.releaseClaim).toHaveBeenCalledTimes(1);
      expect(mocks.markSsoRecoverySpent).not.toHaveBeenCalled();
    });

    test("an address that changed after the guards ran stops the link inside its transaction", async () => {
      lockedUserEmail.value = "changed@example.com";

      await expect(failureOf(completeSsoRecovery(proven()))).resolves.toBe("rejected");
      expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
      expect(mocks.markSsoRecoverySpent).not.toHaveBeenCalled();
      expect(mocks.releaseClaim).toHaveBeenCalledTimes(1);
    });

    test("an address verified by a concurrent recovery is not reclaimed a second time", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...verifiedUser, emailVerified: false } as never);
      lockedEmailVerified.value = true;

      await completeSsoRecovery({ ...proven(), sessionToken: "kept-token" });

      expect(syncSsoIdentityForUser).toHaveBeenCalled();
      expect(txTwoFactorDeleteMany).not.toHaveBeenCalled();
      expect(revokeUserSessionsExcept).not.toHaveBeenCalled();
    });

    test("the confirmation page runs the guards and writes nothing", async () => {
      await expect(getSsoRecoveryConfirmation(proven())).resolves.toEqual({
        provider: "google",
        email: "john.doe@example.com",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(mocks.claimSsoRecovery).not.toHaveBeenCalled();

      await expect(
        failureOf(getSsoRecoveryConfirmation({ intentToken: "test-intent", sessionUserId: "user_1" }))
      ).resolves.toBe("unproven");
    });

    test("a cancel marks the recovery spent, gives its claim back and is recorded", async () => {
      await cancelSsoRecovery(proven());

      expect(mocks.markSsoRecoverySpent).toHaveBeenCalledWith(stateId);
      expect(mocks.releaseClaim).toHaveBeenCalledTimes(1);
      expect(syncSsoIdentityForUser).not.toHaveBeenCalled();
      expect(mocks.queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          newObject: expect.objectContaining({ failureReason: "cancelled_by_user" }),
        })
      );
    });

    test("only the browser that could link can cancel", async () => {
      await expect(
        failureOf(cancelSsoRecovery({ intentToken: "test-intent", sessionUserId: "user_1" }))
      ).resolves.toBe("unproven");
      expect(mocks.markSsoRecoverySpent).not.toHaveBeenCalled();
    });

    test("a cancel that loses the claim records no cancellation", async () => {
      mocks.claimSsoRecovery.mockResolvedValue({ kind: "held" });

      await expect(failureOf(cancelSsoRecovery(proven()))).resolves.toBe("intent_unusable");
      expect(mocks.markSsoRecoverySpent).not.toHaveBeenCalled();
      expect(mocks.queueAuditEventBackground).not.toHaveBeenCalledWith(
        expect.objectContaining({
          newObject: expect.objectContaining({ failureReason: "cancelled_by_user" }),
        })
      );
    });

    test("maps each refusal to its redirect and its session cost", () => {
      expect(getSsoRecoveryRefusal(new SsoRecoveryError("unproven"))).toEqual({
        redirectUrl: "http://localhost:3000/auth/login?error=sso_recovery_link_not_opened",
        revokesSession: false,
      });
      expect(getSsoRecoveryRefusal(new SsoRecoveryError("intent_unusable"))).toEqual({
        redirectUrl: "http://localhost:3000/auth/login?error=OAuthAccountNotLinked",
        revokesSession: false,
      });
      expect(getSsoRecoveryRefusal(new SsoRecoveryError("rejected")).revokesSession).toBe(true);
      expect(getSsoRecoveryRefusal(new Error("boom")).revokesSession).toBe(true);
    });

    test("points at the confirmation page for an intent", () => {
      expect(getSsoRecoveryConfirmUrl("abc")).toBe("http://localhost:3000/sso-recovery/confirm?intent=abc");
    });
  });
});
