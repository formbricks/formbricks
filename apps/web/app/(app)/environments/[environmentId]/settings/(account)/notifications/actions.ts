"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { updateUser } from "@formbricks/lib/user/service";
import { ZUserNotificationSettings } from "@formbricks/types/user";

const ZUpdateNotificationSettingsAction = z.object({
  notificationSettings: ZUserNotificationSettings,
});

export const updateNotificationSettingsAction = authenticatedActionClient
  .schema(ZUpdateNotificationSettingsAction)
  .action(async ({ ctx, parsedInput }) => {
    await updateUser(ctx.user.id, {
      notificationSettings: parsedInput.notificationSettings,
    });
  });
