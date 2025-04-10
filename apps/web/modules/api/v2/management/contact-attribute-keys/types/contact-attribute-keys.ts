import { ZGetFilter } from "@/modules/api/v2/types/api-filter";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";

extendZodWithOpenApi(z);

export const ZGetContactAttributeKeysFilter = ZGetFilter.extend({
  environmentId: z.string().cuid2().optional().describe("The environment ID to filter by"),
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
  )
  .describe("Filter for retrieving contact attribute keys");

export type TGetContactAttributeKeysFilter = z.infer<typeof ZGetContactAttributeKeysFilter>;

export const ZContactAttributeKeyInput = ZContactAttributeKey.pick({
  key: true,
  name: true,
  description: true,
  type: true,
  environmentId: true,
}).openapi({
  ref: "contactAttributeKeyInput",
  description: "Input data for creating or updating a contact attribute",
});

export type TContactAttributeKeyInput = z.infer<typeof ZContactAttributeKeyInput>;
