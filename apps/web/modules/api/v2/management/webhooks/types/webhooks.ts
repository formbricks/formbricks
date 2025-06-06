import { ZGetFilter } from "@/modules/api/v2/types/api-filter";
import { z } from "zod";
import { ZWebhook } from "@formbricks/database/zod/webhooks";

export const ZGetWebhooksFilter = ZGetFilter.extend({
  surveyIds: z.array(z.string().cuid2()).optional(),
}).refine(
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
