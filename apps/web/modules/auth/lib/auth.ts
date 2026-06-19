import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "@formbricks/database";
import type { TUserLocale } from "@formbricks/types/user";
import {
  EMAIL_VERIFICATION_DISABLED,
  PASSWORD_RESET_TOKEN_LIFETIME_MINUTES,
  SESSION_MAX_AGE,
} from "@/lib/constants";
import { hashSecret, verifySecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { redisSecondaryStorage } from "./secondary-storage";

const DAY_IN_SECONDS = 60 * 60 * 24;

/** Resolve a user's locale for transactional emails (Better Auth's callback user omits it). */
const getUserLocale = async (userId: string): Promise<TUserLocale> => {
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return (dbUser?.locale ?? "en-US") as TUserLocale;
};

/**
 * Better Auth server instance (ENG-1054 — NextAuth → Better Auth migration).
 *
 * PHASE 1 (additive foundation): this instance exists and is usable server-side via `auth.api.*`,
 * but NextAuth still owns sessions and the HTTP handler is intentionally NOT mounted at
 * /api/auth/[...all] yet — it would collide with the NextAuth [...nextauth] catch-all. The
 * handler + cutover land in Phase 7.
 *
 * Field mappings target the EXISTING Prisma columns (packages/database/schema.prisma), verified
 * against better-auth@1.6.18 `getAuthTables` (design doc §11). With Redis `secondaryStorage`
 * configured, BA skips the DB session/verification tables unless told otherwise — so
 * `session.storeSessionInDatabase` is set (the forward-auth proxies + dual-read need DB sessions);
 * verification stays Redis-only (ephemeral; no Verification Prisma model needed).
 *
 * Deferred to later phases (kept out so they don't half-activate against the live NextAuth flows):
 *  - `emailVerified` Date→boolean column conversion (Phase 2/3 — required before requireEmailVerification works at cutover)
 *  - `genericOAuth` providers: Google/GitHub/Azure/OIDC + the BoxyHQ SAML bridge (Phase 5)
 *  - audit-log + Sentry wiring via hooks/onAPIError (Phase 7)
 */
export const auth = betterAuth({
  appName: "Formbricks",
  // ENG-1054: BA throws in production if this is unset; keep NEXTAUTH_SECRET for app JWTs (lib/jwt.ts).
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL ?? env.NEXTAUTH_URL,
  trustedOrigins: [env.BETTER_AUTH_URL, env.NEXTAUTH_URL].filter((url): url is string => Boolean(url)),
  telemetry: { enabled: false },

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Sessions, verification records, and rate-limit counters in Redis (existing infra), shared
  // across instances. Sessions also persist to the DB via session.storeSessionInDatabase below.
  secondaryStorage: redisSecondaryStorage,

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
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60, // 1 hour
    sendVerificationEmail: async ({ user, url }) => {
      const { sendVerificationLinkEmail } = await import("@/modules/email");
      await sendVerificationLinkEmail({
        email: user.email,
        locale: await getUserLocale(user.id),
        verifyLink: url,
      });
    },
  },

  // Hash verification/reset token identifiers at rest (BA default is plaintext) — matches the
  // SHA-256-at-rest behavior of the current PasswordResetToken flow (design doc §10.1).
  verification: {
    storeIdentifier: { default: "hashed" },
  },

  session: {
    expiresIn: SESSION_MAX_AGE, // keep the current 1-day TTL; bounds the dual-read window (D3)
    updateAge: DAY_IN_SECONDS,
    freshAge: DAY_IN_SECONDS, // require recent auth for sensitive ops; never 0
    // REQUIRED with secondaryStorage — otherwise no `session` DB rows, which the forward-auth
    // proxies (getProxySession) and the dual-read cutover both depend on (design doc §11).
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

  rateLimit: {
    // Redis-backed so counters are shared across instances (the in-memory default is per-instance
    // and resets on deploy — unsuitable for multi-instance prod).
    storage: "secondary-storage",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
      "/two-factor/*": { window: 60, max: 5 },
    },
  },

  advanced: {
    useSecureCookies: true, // also yields the browser-enforced "__Secure-" cookie name prefix
    cookiePrefix: "formbricks",
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true, secure: true, path: "/" },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] }, // pin to the trusted proxy header
  },

  logger: {
    level: "warn",
    disableColors: true,
    // TODO(Phase 7): forward to @formbricks/logger and capture errors to Sentry via onAPIError.
  },

  plugins: [
    // Full TOTP/backup-code hardening + secret migration from User.twoFactorSecret happen in Phase 4.
    twoFactor({ issuer: "Formbricks" }),
    // nextCookies MUST remain the last plugin so server-action sign-in/out can set cookies.
    nextCookies(),
  ],
});
