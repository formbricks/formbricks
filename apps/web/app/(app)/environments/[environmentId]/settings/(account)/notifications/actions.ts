"use server";

import { getUser, updateUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client/action-client";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { z } from "zod";
import { ZUserNotificationSettings } from "@formbricks/types/user";

const ZUpdateNotificationSettingsAction = z.object({
  notificationSettings: ZUserNotificationSettings,
});

export const updateNotificationSettingsAction = authenticatedActionClient
  .schema(ZUpdateNotificationSettingsAction)
  .action(
    withAuditLogging(
      "updated",
      "user",
      async ({
        ctx,
        parsedInput,
      }: {
        ctx: AuthenticatedActionClientCtx;
        parsedInput: Record<string, any>;
      }) => {
        const oldObject = await getUser(ctx.user.id);
        const result = await updateUser(ctx.user.id, {
          notificationSettings: parsedInput.notificationSettings,
        });
        ctx.auditLoggingCtx.userId = ctx.user.id;
        ctx.auditLoggingCtx.oldObject = oldObject;
        ctx.auditLoggingCtx.newObject = result;
        return result;
      }
    )
  );
