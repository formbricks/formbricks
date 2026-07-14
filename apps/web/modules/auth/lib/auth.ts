import "server-only";
import { oauthProvider } from "@better-auth/oauth-provider";
import { createId } from "@paralleldrive/cuid2";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth, jwt, twoFactor } from "better-auth/plugins";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TUserLocale } from "@formbricks/types/user";
import {
  EMAIL_VERIFICATION_DISABLED,
  PASSWORD_RESET_TOKEN_LIFETIME_MINUTES,
  RATE_LIMITING_DISABLED,
  SESSION_MAX_AGE,
} from "@/lib/constants";
import { hashSecret, verifySecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import {
  accountDeletionConfig,
  requireDeletionConfirmationBeforeHandler,
} from "@/modules/account/lib/better-auth-account-deletion";
import { ssoDatabaseHooks, ssoLicenseGateBeforeHandler } from "@/modules/ee/sso/lib/better-auth-hooks";
import { ssoGenericOAuthConfig, ssoSocialProviders } from "@/modules/ee/sso/lib/better-auth-providers";
import { ssoRecoverySignInPlugin } from "@/modules/ee/sso/lib/better-auth-recovery-signin";
import { runAfterAuthHooks } from "./after-auth-hooks";
import { rejectInactiveUserOnSessionCreate } from "./better-auth-active-user-gate";
import { createBrevoCustomerAfterEmailVerification } from "./better-auth-email-verification";
import { auditPasswordReset, betterAuthLogger, signInAuditDatabaseHook } from "./better-auth-observability";
import { getMcpOauthProviderOptions } from "./mcp-oauth-provider-options";
import { getAuthIssuerUrl, getMcpResourceUrl } from "./oauth-urls";
import { redisSecondaryStorage } from "./secondary-storage";

const DAY_IN_SECONDS = 60 * 60 * 24;

// `__Secure-`/Secure cookies require HTTPS — on http://localhost the browser drops them and the
// session can't persist. Gate on the configured URL scheme (parity with NextAuth's URL-based
// useSecureCookies default) instead of hardcoding true, so local/dev over http works.
const USE_SECURE_COOKIES = (env.BETTER_AUTH_URL ?? env.NEXTAUTH_URL ?? "").startsWith("https://");

/** Resolve a user's locale for transactional emails (Better Auth's callback user omits it). */
export const getUserLocale = async (userId: string): Promise<TUserLocale> => {
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return (dbUser?.locale ?? "en-US") as TUserLocale;
};

/**
 * Better Auth server instance (ENG-1054 — NextAuth → Better Auth migration).
 *
 * CUTOVER (the ENG-1054 flip): Better Auth owns sessions. Its HTTP handler is mounted at
 * /api/auth/[...all] (wrapped in `runWithSsoRequestContext`), the NextAuth [...nextauth] route is
 * removed, and the session DAL (`session.ts`) reads Better Auth only — no dual-read, so the flip is
 * a one-time forced re-login.
 *
 * Field mappings target the EXISTING Prisma columns (packages/database/schema.prisma), verified
 * against better-auth@1.6.18 `getAuthTables` (design doc §11). With Redis `secondaryStorage`
 * configured, BA skips the DB session/verification tables unless told otherwise — so
 * `session.storeSessionInDatabase` is set (the forward-auth proxies need DB sessions); verification
 * stays Redis-only (ephemeral; no Verification Prisma model needed).
 *
 * Known deferral (not blocking): the 2FA-challenge failure audit (`/two-factor/verify-*`) — the user
 * identity lives in the two-factor cookie, not the request body, so it is tracked separately. The
 * credential sign-in + sole-owner-deletion failure audits and the signedIn-success / lastLoginAt /
 * analytics / Sentry / logger wiring are all live in better-auth-observability.ts.
 */
export const auth = betterAuth({
  appName: "Formbricks",
  // ENG-1054: fall back to NEXTAUTH_SECRET (which already signed NextAuth's session cookies) when
  // BETTER_AUTH_SECRET is unset. This keeps existing envs working AND guarantees BA's cookie signing
  // uses the same secret the forward-auth proxy verifies with (session-cookie.ts) — a mismatch makes
  // the proxy reject every session and bounce users between / and /auth/login. NEXTAUTH_SECRET also
  // still signs app JWTs (lib/jwt.ts).
  secret: env.BETTER_AUTH_SECRET ?? env.NEXTAUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL ?? env.NEXTAUTH_URL,
  disabledPaths: ["/token"],
  trustedOrigins: [env.BETTER_AUTH_URL, env.NEXTAUTH_URL].filter((url): url is string => Boolean(url)),
  telemetry: { enabled: false },

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Sessions, verification records, and rate-limit counters in Redis (existing infra), shared
  // across instances. Sessions also persist to the DB via session.storeSessionInDatabase below.
  secondaryStorage: redisSecondaryStorage,

  // SSO providers (Google/GitHub social + Azure/OIDC/SAML genericOAuth) live in
  // modules/ee/sso/lib/better-auth-providers.ts. The account-linking / verify-before-link flow is
  // the security-sensitive Phase 5 work, re-expressed via hooks separately (pending review, D7).
  socialProviders: ssoSocialProviders,

  emailAndPassword: {
    enabled: true,
    // Matches ZUserPassword (min 8 / max 128); the upper+digit composition rule stays enforced
    // by ZUserPassword at the app layer (deferred policy modernization → design doc §10.6).
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: !EMAIL_VERIFICATION_DISABLED, // match current behavior (same gating flag)
    autoSignIn: false, // match current (no auto-login before verification); also enumeration-safe
    resetPasswordTokenExpiresIn: PASSWORD_RESET_TOKEN_LIFETIME_MINUTES * 60, // seconds
    revokeSessionsOnPasswordReset: true, // BA default is false; today we delete all sessions on reset (§10.1)
    // Keep existing bcrypt (cost 12) so current hashes verify without forcing a reset (design doc D4).
    password: {
      hash: (password) => hashSecret(password),
      verify: ({ password, hash }) => verifySecret(password, hash),
    },
    // Reuse Formbricks' mailer. Dynamic import keeps the heavy email/nodemailer graph out of auth.ts's
    // app-wide static import chain (only loaded when a reset is actually sent).
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetLinkEmail } = await import("@/modules/email");
      await sendPasswordResetLinkEmail({
        email: user.email,
        locale: await getUserLocale(user.id),
        verifyLink: url,
        linkValidityInMinutes: PASSWORD_RESET_TOKEN_LIFETIME_MINUTES,
      });
    },
    // After a successful reset, send the security notification (parity with the retired
    // completePasswordReset) and audit it. Better Auth already revoked sessions
    // (revokeSessionsOnPasswordReset above). Both are best-effort — never fail the completed reset.
    onPasswordReset: async ({ user }) => {
      try {
        const { sendPasswordResetNotifyEmail } = await import("@/modules/email");
        await sendPasswordResetNotifyEmail({ email: user.email, locale: await getUserLocale(user.id) });
      } catch (error) {
        logger.error({ error, userId: user.id }, "Failed to send password-reset notification email");
      }
      await auditPasswordReset(user.id);
    },
  },

  emailVerification: {
    // BA sends the verification email on signup (used by the createUserAction signup flow). When
    // EMAIL_VERIFICATION_DISABLED the user still receives it but isn't blocked from signing in —
    // requireEmailVerification (above) gates that.
    sendOnSignUp: true,
    // Resend a fresh verification link when an unverified user tries to sign in (the original sign-up
    // link may have expired). The login form surfaces this as a "check your inbox" message — without
    // this flag BA would throw EMAIL_NOT_VERIFIED without sending anything, leaving no recovery path
    // and making that message untrue. (ENG-1054)
    sendOnSignIn: true,
    // Establish the session on a successful verification so the user lands in the app instead of
    // bouncing to /auth/login (ENG-1746). Safe — clicking the signed link proves email ownership.
    // Distinct from the sibling `autoSignIn: false` above, which stays off (no auto-login at sign-up,
    // before ownership is proven; also enumeration-safe).
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // 1 hour
    sendVerificationEmail: async ({ user, url }) => {
      const { sendVerificationLinkEmail } = await import("@/modules/email");
      await sendVerificationLinkEmail({
        email: user.email,
        locale: await getUserLocale(user.id),
        verifyLink: url,
      });
    },
    // Re-home the "token" provider's Brevo-on-first-verification side effect (better-auth-email-verification.ts).
    afterEmailVerification: createBrevoCustomerAfterEmailVerification,
  },

  // Hash verification/reset token identifiers at rest (BA default is plaintext) — matches the
  // SHA-256-at-rest behavior of the current PasswordResetToken flow (design doc §10.1).
  verification: {
    storeIdentifier: { default: "hashed" },
  },

  session: {
    expiresIn: SESSION_MAX_AGE, // keep the current 1-day session TTL (parity with the legacy SESSION_MAX_AGE)
    updateAge: DAY_IN_SECONDS,
    freshAge: DAY_IN_SECONDS, // require recent auth for sensitive ops; never 0
    // REQUIRED with secondaryStorage — otherwise no `session` DB rows, which the forward-auth
    // proxies (getProxySession) depend on (design doc §11).
    storeSessionInDatabase: true,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
    // Map BA's logical fields onto the existing Prisma columns.
    fields: {
      token: "sessionToken",
      expiresAt: "expires",
    },
  },

  account: {
    // No automatic linking — Formbricks keeps its hardened verify-before-link (SSO recovery) flow,
    // re-expressed via hooks in Phase 5 (design doc D7). BA's defaults are more permissive.
    accountLinking: {
      enabled: false,
      allowDifferentEmails: false,
    },
    // Map BA's logical fields onto the existing Prisma columns; new columns (password,
    // accessTokenExpiresAt, refreshTokenExpiresAt, scope, userId, createdAt, updatedAt) keep BA's names.
    fields: {
      providerId: "provider",
      accountId: "providerAccountId",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
    },
  },

  // Existing Prisma columns that Better Auth doesn't know about; declared so the SSO hooks can
  // write them. `input: false` keeps them server-set only (never settable via the client API).
  user: {
    additionalFields: {
      identityProvider: { type: "string", required: false, input: false },
      identityProviderAccountId: { type: "string", required: false, input: false },
    },
    // Account deletion (design doc §14): native Better Auth deleteUser with Formbricks' pre/post
    // cleanup (sole-owner-org guard + org/invite removal, then Brevo + audit). Confirmation friction
    // is asymmetric and wired at the edges in Phase 6 — password for credential users, email-link for
    // SSO — so `sendDeleteAccountVerification` is intentionally NOT set here (it would email everyone).
    deleteUser: accountDeletionConfig,
  },

  // SSO sign-up flow — email-verification, identity denormalization, and JIT provisioning
  // (gate + writes) re-expressed as Better Auth database hooks (design doc §13). Verify-before-link
  // recovery is the remaining Phase 5c work. The session hook composes the isActive gate (reject
  // deactivated users before a session is created — parity with authOptions, covers every sign-in
  // path) with the Phase 7 `signedIn` success audit.
  databaseHooks: {
    ...ssoDatabaseHooks,
    session: {
      create: {
        before: rejectInactiveUserOnSessionCreate,
        after: signInAuditDatabaseHook.create?.after,
      },
    },
  },

  // Request hooks (parity with handleSsoCallback). Each slot is a single middleware, so related
  // concerns are composed as plain handlers (calling a wrapped middleware would re-run the per-request
  // context setup). `before`: re-check the SSO/SAML license on every SSO callback (covers existing-user
  // sign-ins that skip user.create), then require an explicit confirmation factor on POST /delete-user
  // (closes Better Auth's freshAge password bypass). `after`: turn an SSO "account not linked"
  // collision into the verify-before-link recovery flow, then emit the failed-login audit (parity with
  // NextAuth's `logAuthAttempt`). Recovery runs first; if it redirects (throws), the request is an SSO
  // recovery rather than a credential failure, so skipping the audit is correct.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      await ssoLicenseGateBeforeHandler(ctx);
      await requireDeletionConfirmationBeforeHandler(ctx);
    }),
    after: createAuthMiddleware(runAfterAuthHooks),
  },

  rateLimit: {
    // Enable explicitly rather than relying on Better Auth's NODE_ENV==="production" default, so the
    // brute-force limits also apply in staging / self-host. Respects the operator's RATE_LIMITING_DISABLED
    // (the same app-level toggle the legacy limiter used); the integration harness sets it to skip limits.
    enabled: !RATE_LIMITING_DISABLED,
    // Redis-backed so counters are shared across instances (the in-memory default is per-instance
    // and resets on deploy — unsuitable for multi-instance prod).
    storage: "secondary-storage",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
      "/oauth2/register": { window: 60, max: 5 },
      "/oauth2/token": { window: 60, max: 20 },
      "/oauth2/introspect": { window: 60, max: 60 },
      "/oauth2/revoke": { window: 60, max: 30 },
      "/two-factor/*": { window: 60, max: 5 },
      "/sso-recovery/*": { window: 60, max: 5 }, // brute-force defense on the recovery magic-link sign-in
      // Account deletion: re-auths the password (credential) / consumes the email token (SSO). Restore
      // the legacy 5/hour so a stolen session can't brute-force the password against delete-user (BA's
      // default global limit, ~100/10s, is only a flood guard). The callback gets a modest defensive cap.
      "/delete-user": { window: 3600, max: 5 },
      "/delete-user/callback": { window: 60, max: 5 },
    },
  },

  advanced: {
    useSecureCookies: USE_SECURE_COOKIES, // "__Secure-" prefix on HTTPS; relaxed on http (local/dev)
    cookiePrefix: "formbricks",
    // Formbricks ids are cuid2 (Prisma `@default(cuid())` + the `ZId = z.cuid2()` validators in the
    // service layer). Better Auth's default id format is NOT cuid2, so without this every Formbricks
    // service that validates a user id via ZId (e.g. updateUser, called from the SSO provisioning
    // write path) would reject BA-created users at cutover — caught by the SSO-provisioning test.
    database: { generateId: () => createId() },
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true, secure: USE_SECURE_COOKIES, path: "/" },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] }, // pin to the trusted proxy header
  },

  // Route Better Auth's logs to @formbricks/logger and capture errors to Sentry (Phase 7 parity).
  logger: betterAuthLogger,

  plugins: [
    jwt({
      disableSettingJwtHeader: true,
      jwt: {
        issuer: getAuthIssuerUrl(),
        audience: getMcpResourceUrl(),
      },
    }),
    // Options extracted to mcp-oauth-provider-options.ts so the DCR/authorize scope semantics are
    // integration-testable against a throwaway Better Auth instance.
    oauthProvider(getMcpOauthProviderOptions()),
    // TOTP + backup codes, matched to the current otplib setup (6 digits / 30s) and 10 encrypted
    // backup codes. Trusted-device is left off (never passed client-side) so 2FA is required every
    // login — strict parity. Cutover work (Phase 7): migrate secrets/backup codes out of
    // User.twoFactorSecret|backupCodes into the twoFactor table, and move the login-time TOTP/
    // backup challenge out of the credentials authorize into Better Auth's flow.
    twoFactor({
      issuer: "Formbricks",
      skipVerificationOnEnable: false, // require a valid TOTP before 2FA is enabled
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
    }),
    // SSO via generic OAuth (Azure/OIDC + the BoxyHQ SAML bridge); empty config when no license or
    // providers are configured. The account-linking/provisioning hooks are a separate reviewed pass.
    genericOAuth({ config: ssoGenericOAuthConfig }),
    // SSO-recovery magic-link sign-in — the BA replacement for the "token" provider's sso_recovery
    // path (recovery-scoped, not a general magic-link). See better-auth-recovery-signin.ts.
    ssoRecoverySignInPlugin,
    // nextCookies MUST remain the last plugin so server-action sign-in/out can set cookies.
    nextCookies(),
  ],
});
