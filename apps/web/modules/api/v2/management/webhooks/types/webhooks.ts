import { z } from "zod";
import { ZWebhook } from "@formbricks/database/zod/webhooks";
import { ZGetFilter } from "@/modules/api/v2/types/api-filter";

export const ZGetWebhooksFilter = ZGetFilter.extend({
  surveyIds: z.array(z.cuid2()).optional(),
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
  workspaceId: true,
  triggers: true,
  surveyIds: true,
});

export type TWebhookInput = z.infer<typeof ZWebhookInput>;

// Route-level schema — both IDs are required; bodyTransform resolves the missing one before validation.
export const ZWebhookCreateInput = ZWebhook.pick({
  name: true,
  url: true,
  source: true,
  triggers: true,
  surveyIds: true,
}).extend({
  environmentId: z.cuid2(),
  workspaceId: z.cuid2(),
});

export type TWebhookCreateInput = z.infer<typeof ZWebhookCreateInput>;
