import { z } from "zod";

export const ZContactLinkParams = z.object({
  surveyId: z
    .cuid2()
    .meta({
      param: { name: "surveyId", in: "path" },
    })
    .describe("The ID of the survey"),
  contactId: z
    .cuid2()
    .meta({
      param: { name: "contactId", in: "path" },
    })
    .describe("The ID of the contact"),
});

export const ZContactLinkQuery = z.object({
  expirationDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Number of days until the generated JWT expires. If not provided, there is no expiration."),
});

export type TContactLinkParams = z.infer<typeof ZContactLinkParams>;
export type TContactLinkQuery = z.infer<typeof ZContactLinkQuery>;
