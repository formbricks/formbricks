import { ZGetFilter } from "@/modules/api/v2/types/api-filter";
import { z } from "zod";

export const ZContactLinksBySegmentParams = z.object({
  surveyId: z.string().cuid2().describe("The ID of the survey"),
  segmentId: z.string().cuid2().describe("The ID of the segment"),
});

export const ZContactLinksBySegmentQuery = ZGetFilter.pick({
  limit: true,
  skip: true,
}).extend({
  expirationDays: z.coerce
    .number()
    .min(1)
    .max(365)
    .nullish()
    .default(null)
    .describe("Number of days until the generated JWT expires. If not provided, there is no expiration."),
  attributeKeys: z
    .string()
    .optional()
    .describe(
      "Comma-separated list of contact attribute keys to include in the response. You can have max 20 keys. If not provided, no attributes will be included."
    )
    .refine((fields) => {
      if (!fields) return true;
      const fieldsArray = fields.split(",");
      return fieldsArray.length <= 20;
    }, "You can have max 20 keys."),
});

export type TContactWithAttributes = {
  contactId: string;
  attributes?: Record<string, string>;
};

export const ZContactLinkResponse = z.object({
  contactId: z.string().describe("The ID of the contact"),
  surveyUrl: z.string().url().describe("Personalized survey link"),
  expiresAt: z.string().nullable().describe("The date and time the link expires, null if no expiration"),
  attributes: z.record(z.string(), z.string()).describe("The attributes of the contact"),
});
