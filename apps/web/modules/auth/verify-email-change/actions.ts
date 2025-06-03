"use server";

import { verifyEmailChangeToken } from "@/lib/jwt";
import { actionClient } from "@/lib/utils/action-client";
import { ActionClientCtx } from "@/lib/utils/action-client/types/context";
import { updateBrevoCustomer } from "@/modules/auth/lib/brevo";
import { getUser, updateUser } from "@/modules/auth/lib/user";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { z } from "zod";

export const verifyEmailChangeAction = actionClient.schema(z.object({ token: z.string() })).action(
  withAuditLogging(
    "updated",
    "user",
    async ({ ctx, parsedInput }: { ctx: ActionClientCtx; parsedInput: Record<string, any> }) => {
      const { id, email } = await verifyEmailChangeToken(parsedInput.token);

      if (!email) {
        throw new Error("Email not found in token");
      }
      const oldObject = await getUser(id);
      const user = await updateUser(id, { email, emailVerified: new Date() });
      if (!user) {
        throw new Error("User not found or email update failed");
      }

      ctx.auditLoggingCtx.userId = id;
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = user;

      await updateBrevoCustomer({ id: user.id, email: user.email });
      return user;
    }
  )
);
