import * as Sentry from "@sentry/nextjs";
import NextAuth, { Account, Profile, User } from "next-auth";
import { AdapterUser } from "next-auth/adapters";
import { CredentialInput } from "next-auth/providers/credentials";
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { authOptions as baseAuthOptions } from "@/modules/auth/lib/authOptions";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

export const fetchCache = "force-no-store";

const getAuthMethod = (account: Account | null) => {
  if (account?.provider === "credentials") {
    return "password";
  }

  if (account?.provider === "token") {
    return "email_verification";
  }

  if (account?.provider) {
    return "sso";
  }

  return "unknown";
};

const isSsoRecoveryVerificationFlow = (account: Account | null, user: User | AdapterUser) =>
  account?.provider === "token" &&
  "authFlowPurpose" in user &&
  typeof user.authFlowPurpose === "string" &&
  user.authFlowPurpose === "sso_recovery";

const handler = async (req: Request, ctx: any) => {
  const eventId = req.headers.get("x-request-id") ?? undefined;

  const authOptions = {
    ...baseAuthOptions,
    callbacks: {
      ...baseAuthOptions.callbacks,
      async session(params: any) {
        let result: any = params.session;
        let error: any = undefined;

        try {
          if (baseAuthOptions.callbacks?.session) {
            result = await baseAuthOptions.callbacks.session(params);
          }
        } catch (err) {
          error = err;
          logger.withContext({ eventId, err }).error("Session callback failed");

          if (SENTRY_DSN && IS_PRODUCTION) {
            Sentry.captureException(err);
          }
        }

        if (error) throw error;
        return result;
      },
      async signIn({
        user,
        account,
        profile,
        email,
        credentials,
      }: {
        user: User | AdapterUser;
        account: Account | null;
        profile?: Profile;
        email?: { verificationRequest?: boolean };
        credentials?: Record<string, CredentialInput>;
      }) {
        let result: boolean | string = true;
        let error: any = undefined;
        const authMethod = getAuthMethod(account);

        try {
          if (baseAuthOptions.callbacks?.signIn) {
            result = await baseAuthOptions.callbacks.signIn({
              user,
              account,
              profile,
              email,
              credentials,
            });
          }
        } catch (err) {
          error = err;
          result = false;

          logger.withContext({ eventId, err }).error("User sign-in failed");

          if (SENTRY_DSN && IS_PRODUCTION) {
            Sentry.captureException(err);
          }
        }

        if (result === false) {
          queueAuditEventBackground({
            action: "signedIn",
            targetType: "user",
            userId: user?.id ?? UNKNOWN_DATA,
            targetId: user?.id ?? UNKNOWN_DATA,
            organizationId: UNKNOWN_DATA,
            status: "failure",
            userType: "user",
            newObject: {
              ...user,
              authMethod,
              provider: account?.provider,
              ...(error instanceof Error ? { errorMessage: error.message } : {}),
            },
            eventId,
          });
        }

        if (error) throw error;
        return result;
      },
    },
    events: {
      ...baseAuthOptions.events,
      async signIn({ user, account, isNewUser }: any) {
        if (isSsoRecoveryVerificationFlow(account, user)) {
          return;
        }

        try {
          await baseAuthOptions.events?.signIn?.({ user, account, isNewUser });
        } catch (err) {
          logger.withContext({ eventId, err }).error("Sign-in event callback failed");

          if (SENTRY_DSN && IS_PRODUCTION) {
            Sentry.captureException(err);
          }
        }

        queueAuditEventBackground({
          action: "signedIn",
          targetType: "user",
          userId: user?.id ?? UNKNOWN_DATA,
          targetId: user?.id ?? UNKNOWN_DATA,
          organizationId: UNKNOWN_DATA,
          status: "success",
          userType: "user",
          newObject: {
            ...user,
            authMethod: getAuthMethod(account),
            provider: account?.provider,
            sessionStrategy: "database",
            isNewUser: isNewUser ?? false,
          },
        });
      },
    },
  };

  return NextAuth(authOptions)(req, ctx);
};

export { handler as GET, handler as POST };
