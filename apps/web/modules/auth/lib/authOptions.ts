import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TUser } from "@formbricks/types/user";
import {
  CONTROL_HASH,
  EMAIL_VERIFICATION_DISABLED,
  ENCRYPTION_KEY,
  ENTERPRISE_LICENSE_KEY,
  SESSION_MAX_AGE,
  WEBAPP_URL,
} from "@/lib/constants";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { verifyToken } from "@/lib/jwt";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import {
  completeAccountDeletionSsoReauthentication,
  getAccountDeletionSsoReauthFailureRedirectUrl,
  getAccountDeletionSsoReauthIntentFromCallbackUrl,
  validateAccountDeletionSsoReauthenticationCallback,
} from "@/modules/account/lib/account-deletion-sso-reauth";
import { getAuthCallbackUrlFromCookies } from "@/modules/auth/lib/callback-url";
import { finalizeSuccessfulSignIn } from "@/modules/auth/lib/sign-in-tracking";
import { updateUser } from "@/modules/auth/lib/user";
import {
  logAuthAttempt,
  logAuthEvent,
  logAuthSuccess,
  logEmailVerificationAttempt,
  logTwoFactorAttempt,
  shouldLogAuthFailure,
  verifyPassword,
} from "@/modules/auth/lib/utils";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { getSSOProviders } from "@/modules/ee/sso/lib/providers";
import { handleSsoCallback } from "@/modules/ee/sso/lib/sso-handlers";
import { createBrevoCustomer } from "./brevo";

type TSignInCallbackParams = Parameters<NonNullable<NonNullable<NextAuthOptions["callbacks"]>["signIn"]>>[0];
type TSignInUser = TSignInCallbackParams["user"];
type TSignInAccount = TSignInCallbackParams["account"];
type TCredentialsOrTokenAccount = NonNullable<TSignInAccount> & { provider: "credentials" | "token" };

const getValidatedAuthCallbackUrl = async () => {
  const cookieStore = await cookies();
  return getValidatedCallbackUrl(getAuthCallbackUrlFromCookies(cookieStore), WEBAPP_URL) ?? "";
};

const getAuthFlowPurpose = (user: TSignInUser) => {
  const authFlowPurpose = "authFlowPurpose" in user ? user.authFlowPurpose : undefined;
  return typeof authFlowPurpose === "string" ? authFlowPurpose : undefined;
};

const isCredentialsOrTokenProvider = (account: TSignInAccount): account is TCredentialsOrTokenAccount =>
  account?.provider === "credentials" || account?.provider === "token";

const assertCredentialsUserCanSignIn = (user: TSignInUser) => {
  if ("emailVerified" in user && !user.emailVerified && !EMAIL_VERIFICATION_DISABLED) {
    logger.error("Email Verification is Pending");
    throw new Error("Email Verification is Pending");
  }
};

const handleCredentialsOrTokenSignIn = async ({
  account,
  user,
  userEmail,
  userId,
}: {
  account: TCredentialsOrTokenAccount;
  user: TSignInUser;
  userEmail: string;
  userId: string;
}) => {
  const isSsoRecovery = account.provider === "token" && getAuthFlowPurpose(user) === "sso_recovery";

  if (!isSsoRecovery) {
    assertCredentialsUserCanSignIn(user);

    await finalizeSuccessfulSignIn({
      userId,
      email: userEmail,
      provider: account.provider,
    });
  }

  return true;
};

const maybeValidateAccountDeletionSsoReauth = async ({
  account,
  intentToken,
}: {
  account: NonNullable<TSignInAccount>;
  intentToken: string | null;
}) => {
  if (!intentToken) {
    return;
  }

  await validateAccountDeletionSsoReauthenticationCallback({
    account,
    intentToken,
  });
};

const maybeCompleteAccountDeletionSsoReauth = async ({
  account,
  intentToken,
}: {
  account: NonNullable<TSignInAccount>;
  intentToken: string | null;
}) => {
  if (!intentToken) {
    return;
  }

  await completeAccountDeletionSsoReauthentication({
    account,
    intentToken,
  });
};

const handleEnterpriseSsoSignIn = async ({
  account,
  callbackUrl,
  intentToken,
  user,
  userEmail,
  userId,
}: {
  account: NonNullable<TSignInAccount>;
  callbackUrl: string;
  intentToken: string | null;
  user: TSignInUser;
  userEmail: string;
  userId: string;
}) => {
  await maybeValidateAccountDeletionSsoReauth({ account, intentToken });

  const result = await handleSsoCallback({
    user: user as TUser,
    account,
    callbackUrl,
  });

  if (result === true) {
    await maybeCompleteAccountDeletionSsoReauth({ account, intentToken });

    await finalizeSuccessfulSignIn({
      userId,
      email: userEmail,
      provider: account.provider,
    });
  }

  return result;
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      id: "credentials",
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Credentials",
      // The credentials is used to generate a suitable form on the sign in page.
      // You can specify whatever fields you are expecting to be submitted.
      // e.g. domain, username, password, 2FA token, etc.
      // You can pass any HTML attribute to the <input> tag through the object.
      credentials: {
        email: {
          label: "Email Address",
          type: "email",
          placeholder: "Your email address",
        },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Your password",
        },
        totpCode: { label: "Two-factor Code", type: "input", placeholder: "Code from authenticator app" },
        backupCode: { label: "Backup Code", type: "input", placeholder: "Two-factor backup code" },
      },
      async authorize(credentials, _req) {
        await applyIPRateLimit(rateLimitConfigs.auth.login);

        // Use email for rate limiting when available, fall back to "unknown_user" for credential validation
        const identifier = credentials?.email || "unknown_user"; // NOSONAR // We want to check for empty strings

        if (!credentials) {
          if (await shouldLogAuthFailure("no_credentials")) {
            logAuthAttempt("no_credentials_provided", "credentials", "credentials_validation");
          }
          throw new Error("Invalid credentials");
        }

        // Validate password length to prevent CPU DoS attacks
        // bcrypt processes passwords up to 72 bytes, but we limit to 128 characters for security
        if (credentials.password && credentials.password.length > 128) {
          if (await shouldLogAuthFailure(identifier)) {
            logAuthAttempt(
              "password_too_long",
              "credentials",
              "password_validation",
              UNKNOWN_DATA,
              credentials?.email
            );
          }
          throw new Error("Invalid credentials");
        }

        let user;
        try {
          // Perform database lookup
          user = await prisma.user.findUnique({
            where: {
              email: credentials?.email,
            },
          });
        } catch (e) {
          logger.error(e, "Error in CredentialsProvider authorize");
          logAuthAttempt("database_error", "credentials", "user_lookup", UNKNOWN_DATA, credentials?.email);
          throw Error("Internal server error. Please try again later");
        }

        // Always perform password verification to maintain constant timing. This is important to prevent timing attacks for user enumeration.
        // Use actual hash if user exists, control hash if user doesn't exist
        const hashToVerify = user?.password || CONTROL_HASH;
        const isValid = await verifyPassword(credentials.password, hashToVerify);

        // Now check all conditions after constant-time operations are complete
        if (!user) {
          if (await shouldLogAuthFailure(identifier)) {
            logAuthAttempt("user_not_found", "credentials", "user_lookup", UNKNOWN_DATA, credentials?.email);
          }
          throw new Error("Invalid credentials");
        }

        if (!user.password) {
          logAuthAttempt("no_password_set", "credentials", "password_validation", user.id, user.email);
          throw new Error("Invalid credentials");
        }

        if (user.isActive === false) {
          logAuthAttempt("account_inactive", "credentials", "account_status", user.id, user.email);
          throw new Error("Your account is currently inactive. Please contact the organization admin.");
        }

        if (!isValid) {
          if (await shouldLogAuthFailure(user.email)) {
            logAuthAttempt("invalid_password", "credentials", "password_validation", user.id, user.email);
          }
          throw new Error("Invalid credentials");
        }

        logAuthSuccess("passwordVerified", "credentials", "password_validation", user.id, user.email, {
          requires2FA: user.twoFactorEnabled,
        });

        if (user.twoFactorEnabled && credentials.backupCode) {
          if (!ENCRYPTION_KEY) {
            logger.error("Missing encryption key; cannot proceed with backup code login.");
            logTwoFactorAttempt(false, "backup_code", user.id, user.email, "encryption_key_missing");
            throw new Error("Internal Server Error");
          }

          if (!user.backupCodes) {
            logTwoFactorAttempt(false, "backup_code", user.id, user.email, "no_backup_codes");
            throw new Error("No backup codes found");
          }

          let backupCodes;

          try {
            backupCodes = JSON.parse(symmetricDecrypt(user.backupCodes, ENCRYPTION_KEY));
          } catch (e) {
            logger.error(e, "Error in CredentialsProvider authorize");
            logTwoFactorAttempt(false, "backup_code", user.id, user.email, "invalid_backup_codes");
            throw new Error("Invalid backup codes");
          }

          // check if user-supplied code matches one
          const index = backupCodes.indexOf(credentials.backupCode.replaceAll("-", ""));
          if (index === -1) {
            if (await shouldLogAuthFailure(user.email)) {
              logTwoFactorAttempt(false, "backup_code", user.id, user.email, "invalid_backup_code");
            }
            throw new Error("Invalid backup code");
          }

          // delete verified backup code and re-encrypt remaining
          backupCodes[index] = null;
          await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              backupCodes: symmetricEncrypt(JSON.stringify(backupCodes), ENCRYPTION_KEY),
            },
          });

          logTwoFactorAttempt(true, "backup_code", user.id, user.email, undefined, {
            backupCodeConsumed: true,
          });
        } else if (user.twoFactorEnabled) {
          if (!credentials.totpCode) {
            logAuthEvent("twoFactorRequired", "success", user.id, user.email, {
              provider: "credentials",
              authMethod: "password_validation",
              requiresTOTP: true,
            });
            throw new Error("second factor required");
          }

          if (!user.twoFactorSecret) {
            logTwoFactorAttempt(false, "totp", user.id, user.email, "no_2fa_secret");
            throw new Error("Internal Server Error");
          }

          if (!ENCRYPTION_KEY) {
            logTwoFactorAttempt(false, "totp", user.id, user.email, "encryption_key_missing");
            throw new Error("Internal Server Error");
          }

          const secret = symmetricDecrypt(user.twoFactorSecret, ENCRYPTION_KEY);
          if (secret.length !== 32) {
            logTwoFactorAttempt(false, "totp", user.id, user.email, "invalid_2fa_secret");
            throw new Error("Invalid two factor secret");
          }

          const isValidToken = (await import("./totp")).totpAuthenticatorCheck(credentials.totpCode, secret);
          if (!isValidToken) {
            if (await shouldLogAuthFailure(user.email)) {
              logTwoFactorAttempt(false, "totp", user.id, user.email, "invalid_totp_code");
            }
            throw new Error("Invalid two factor code");
          }

          logTwoFactorAttempt(true, "totp", user.id, user.email);
        }

        let authMethod;
        if (!user.twoFactorEnabled) {
          authMethod = "password_only";
        } else if (credentials.backupCode) {
          authMethod = "password_and_backup_code";
        } else {
          authMethod = "password_and_totp";
        }

        logAuthSuccess("authenticationSucceeded", "credentials", authMethod, user.id, user.email);

        return {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
        };
      },
    }),
    CredentialsProvider({
      id: "token",
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: "Token",
      // The credentials is used to generate a suitable form on the sign in page.
      // You can specify whatever fields you are expecting to be submitted.
      // e.g. domain, username, password, 2FA token, etc.
      // You can pass any HTML attribute to the <input> tag through the object.
      credentials: {
        token: {
          label: "Verification Token",
          type: "string",
        },
      },
      async authorize(credentials, _req) {
        await applyIPRateLimit(rateLimitConfigs.auth.verifyEmail);

        // For token verification, we can't rate limit effectively by token (single-use)
        // So we use a generic identifier for token abuse attempts
        const identifier = "email_verification_attempts";

        let user;
        try {
          if (!credentials?.token) {
            if (await shouldLogAuthFailure(identifier)) {
              logEmailVerificationAttempt(false, "token_not_provided");
            }
            throw new Error("Token not found");
          }

          const { id, purpose } = await verifyToken(credentials?.token);
          const foundUser = await prisma.user.findUnique({
            where: {
              id: id,
            },
          });
          user = foundUser ? { ...foundUser, authFlowPurpose: purpose } : null;
        } catch (e) {
          logger.error(e, "Error in CredentialsProvider authorize");

          if (await shouldLogAuthFailure(identifier)) {
            logEmailVerificationAttempt(false, "invalid_token", UNKNOWN_DATA, undefined, {
              tokenProvided: !!credentials?.token,
            });
          }
          throw new Error("Either a user does not match the provided token or the token is invalid");
        }

        if (!user) {
          if (await shouldLogAuthFailure(identifier)) {
            logEmailVerificationAttempt(false, "user_not_found_for_token");
          }
          throw new Error("Either a user does not match the provided token or the token is invalid");
        }

        const authFlowPurpose = user.authFlowPurpose ?? "email_verification";
        const isSsoRecovery = authFlowPurpose === "sso_recovery";

        if (user.emailVerified && !isSsoRecovery) {
          logEmailVerificationAttempt(false, "email_already_verified", user.id, user.email);
          throw new Error("Email already verified");
        }

        if (user.isActive === false) {
          logEmailVerificationAttempt(false, "account_inactive", user.id, user.email);
          throw new Error("Your account is currently inactive. Please contact the organization admin.");
        }

        if (!user.emailVerified && !isSsoRecovery) {
          const updatedUser = await updateUser(user.id, { emailVerified: new Date() });
          user = {
            ...updatedUser,
            authFlowPurpose,
          };

          logEmailVerificationAttempt(true, undefined, user.id, user.email, {
            emailVerifiedAt: user.emailVerified,
          });

          // send new user to brevo after email verification
          createBrevoCustomer({ id: user.id, email: user.email });
        }

        return user;
      },
    }),
    // Conditionally add enterprise SSO providers
    ...(ENTERPRISE_LICENSE_KEY ? getSSOProviders() : []),
  ],
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE,
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        if ("isActive" in user && typeof user.isActive === "boolean") {
          session.user.isActive = user.isActive;
        }
      }
      return session;
    },
    async signIn({ user, account }) {
      const callbackUrl = await getValidatedAuthCallbackUrl();
      const accountDeletionSsoReauthIntentToken =
        getAccountDeletionSsoReauthIntentFromCallbackUrl(callbackUrl);

      const userEmail = user.email ?? "";
      const userId = user.id;

      if (isCredentialsOrTokenProvider(account)) {
        return handleCredentialsOrTokenSignIn({
          account,
          user,
          userEmail,
          userId,
        });
      }

      if (ENTERPRISE_LICENSE_KEY && account) {
        try {
          return await handleEnterpriseSsoSignIn({
            account,
            callbackUrl,
            intentToken: accountDeletionSsoReauthIntentToken,
            user,
            userEmail,
            userId,
          });
        } catch (error) {
          const failureRedirectUrl = getAccountDeletionSsoReauthFailureRedirectUrl({
            error,
            intentToken: accountDeletionSsoReauthIntentToken,
          });

          if (failureRedirectUrl) {
            return failureRedirectUrl;
          }

          throw error;
        }
      }

      await finalizeSuccessfulSignIn({
        userId,
        email: userEmail,
        provider: account?.provider ?? "unknown",
      });
      return true;
    },
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/login", // Error code passed in query string as ?error=
  },
};
