import { z } from "zod";

export const ZUserNotificationSettings = z.object({
  alert: z.record(z.boolean()),
  weeklySummary: z.record(z.boolean()),
});

export type TUserNotificationSettings = z.infer<typeof ZUserNotificationSettings>;
