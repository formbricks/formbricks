import { z } from "zod";
import { ZContactAttribute } from "@formbricks/database/zod/contact-attributes";

export const ZGetContactAttributesFilter = z
  .object({
    limit: z.coerce.number().positive().min(1).max(100).optional().default(10),
    skip: z.coerce.number().nonnegative().optional().default(0),
    sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
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

export const ZContactAttributeInput = ZContactAttribute.pick({
  attributeKeyId: true,
  contactId: true,
  value: true,
}).openapi({
  ref: "contactAttributeInput",
  description: "Input data for creating or updating a contact attribute",
});

export type TContactAttributeInput = z.infer<typeof ZContactAttributeInput>;
