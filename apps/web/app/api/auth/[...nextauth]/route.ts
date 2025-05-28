import { AUDIT_LOG_ENABLED, IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { authOptions as baseAuthOptions } from "@/modules/auth/lib/authOptions";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/utils";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
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
      async signIn({ user, account, profile, email, credentials }) {
        let result: boolean | string = true;
        let error: any = undefined;

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

        if (AUDIT_LOG_ENABLED) {
          const status: "success" | "failure" = result === false ? "failure" : "success"; // treat truthy & redirect strings as success
          const auditLog = {
            actionType: "user.signedin" as const,
            targetType: "user" as const,
            userId: user?.id ?? UNKNOWN_DATA,
            targetId: user?.id ?? UNKNOWN_DATA,
            organizationId: UNKNOWN_DATA,
            status,
            userType: "user" as const,
            newObject: user,
            ...(status === "failure" ? { eventId } : {}),
          };

          queueAuditEventBackground(auditLog);
        }

        if (error) throw error;
        return result;
      },
    },
  };

  return NextAuth(authOptions)(req, ctx);
};

export { handler as GET, handler as POST };
