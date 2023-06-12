import { z } from "zod";

export const ZUserNotificationSettings = z.record(
  z.object({
    responseFinished: z.boolean(),
    weeklySummary: z.boolean(),
  })
);

export type TUserNotificationSettings = z.infer<typeof ZUserNotificationSettings>;
