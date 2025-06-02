"use server";

import { hashPassword } from "@/lib/auth";
import { verifyToken } from "@/lib/jwt";
import { actionClient } from "@/lib/utils/action-client/action-client";
import { ActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getUser, updateUser } from "@/modules/auth/lib/user";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { sendPasswordResetNotifyEmail } from "@/modules/email";
import { z } from "zod";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZUserPassword } from "@formbricks/types/user";

const ZResetPasswordAction = z.object({
  token: z.string(),
  password: ZUserPassword,
});

export const resetPasswordAction = actionClient.schema(ZResetPasswordAction).action(
  withAuditLogging(
    "updated",
    "user",
    async ({ ctx, parsedInput }: { ctx: ActionClientCtx; parsedInput: Record<string, any> }) => {
      const hashedPassword = await hashPassword(parsedInput.password);
      const { id } = await verifyToken(parsedInput.token);
      const oldObject = await getUser(id);
      if (!oldObject) {
        throw new ResourceNotFoundError("user", id);
      }
      const updatedUser = await updateUser(id, { password: hashedPassword });

      ctx.auditLoggingCtx.userId = id;
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = updatedUser;

      await sendPasswordResetNotifyEmail(updatedUser);
      return { success: true };
    }
  )
);
