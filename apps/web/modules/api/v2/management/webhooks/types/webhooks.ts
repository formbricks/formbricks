import { z } from "zod";
import { ZWebhook } from "@formbricks/database/zod/webhooks";

export const ZGetWebhooksFilter = z
  .object({
    limit: z.coerce.number().positive().min(1).max(100).optional().default(10),
    skip: z.coerce.number().nonnegative().optional().default(0),
    sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    surveyIds: z.array(z.string().cuid2()).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate && data.startDate > data.endDate) {
        return false;
      }
      return true;
    },
    {
      message: "startDate must be before endDate",
    }
  );

export type TGetWebhooksFilter = z.infer<typeof ZGetWebhooksFilter>;

export const ZWebhookInput = ZWebhook.pick({
  name: true,
  url: true,
  source: true,
  environmentId: true,
  triggers: true,
  surveyIds: true,
});

export type TWebhookInput = z.infer<typeof ZWebhookInput>;
