import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { authOptions as baseAuthOptions } from "@/modules/auth/lib/authOptions";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import * as Sentry from "@sentry/nextjs";
import NextAuth from "next-auth";
import { logger } from "@formbricks/logger";

export const fetchCache = "force-no-store";

const handler = async (req: Request, ctx: any) => {
  const eventId = req.headers.get("x-request-id") ?? undefined;

  const authOptions = {
    ...baseAuthOptions,
    callbacks: {
      ...baseAuthOptions.callbacks,
      async jwt(params: any) {
        let result: any = params.token;
        let error: any = undefined;

        try {
          if (baseAuthOptions.callbacks?.jwt) {
            result = await baseAuthOptions.callbacks.jwt(params);
          }
        } catch (err) {
          error = err;
          logger.withContext({ eventId, err }).error("JWT callback failed");

          if (SENTRY_DSN && IS_PRODUCTION) {
            Sentry.captureException(err);
          }
        }

        // Audit JWT operations (token refresh, updates)
        if (params.trigger && params.token?.profile?.id) {
          const status: TAuditStatus = error ? "failure" : "success";
          const auditLog = {
            action: "jwtTokenCreated" as const,
            targetType: "user" as const,
            userId: params.token.profile.id,
            targetId: params.token.profile.id,
            organizationId: UNKNOWN_DATA,
            status,
            userType: "user" as const,
            newObject: { trigger: params.trigger, tokenType: "jwt" },
            ...(error ? { eventId } : {}),
          };

          queueAuditEventBackground(auditLog);
        }

        if (error) throw error;
        return result;
      },
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

        // Audit session creation/access
        if (params.session?.user?.id) {
          const status: TAuditStatus = error ? "failure" : "success";
          const auditLog = {
            action: "sessionChecked" as const,
            targetType: "user" as const,
            userId: params.session.user.id,
            targetId: params.session.user.id,
            organizationId: UNKNOWN_DATA,
            status,
            userType: "user" as const,
            ...(error ? { eventId } : {}),
          };

          queueAuditEventBackground(auditLog);
        }

        if (error) throw error;
        return result;
      },
      async signIn({ user, account, profile, email, credentials }) {
        let result: boolean | string = true;
        let error: any = undefined;
        let authMethod = "unknown";

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

          // Determine authentication method for more detailed logging
          if (account?.provider === "credentials") {
            authMethod = "password";
          } else if (account?.provider === "token") {
            authMethod = "email_verification";
          } else if (account?.provider && account.provider !== "credentials") {
            authMethod = "sso";
          }
        } catch (err) {
          error = err;
          result = false;

          logger.withContext({ eventId, err }).error("User sign-in failed");

          if (SENTRY_DSN && IS_PRODUCTION) {
            Sentry.captureException(err);
          }
        }

        const status: TAuditStatus = result === false ? "failure" : "success";
        const auditLog = {
          action: "signedIn" as const,
          targetType: "user" as const,
          userId: user?.id ?? UNKNOWN_DATA,
          targetId: user?.id ?? UNKNOWN_DATA,
          organizationId: UNKNOWN_DATA,
          status,
          userType: "user" as const,
          newObject: {
            ...user,
            authMethod,
            provider: account?.provider,
            ...(error ? { errorMessage: error.message } : {}),
          },
          ...(status === "failure" ? { eventId } : {}),
        };

        queueAuditEventBackground(auditLog);

        if (error) throw error;
        return result;
      },
    },
  };

  return NextAuth(authOptions)(req, ctx);
};

export { handler as GET, handler as POST };
