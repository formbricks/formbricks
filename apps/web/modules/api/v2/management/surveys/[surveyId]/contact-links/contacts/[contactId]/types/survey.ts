import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZContactLinkParams = z.object({
  surveyId: z
    .string()
    .cuid2()
    .openapi({
      description: "The ID of the survey",
      param: { name: "surveyId", in: "path" },
    }),
  contactId: z
    .string()
    .cuid2()
    .openapi({
      description: "The ID of the contact",
      param: { name: "contactId", in: "path" },
    }),
});

export const ZContactLinkQuery = z.object({
  expirationDays: z.coerce
    .number()
    .min(1)
    .optional()
    .describe("Number of days until the generated JWT expires. If not provided, there is no expiration."),
});

export type TContactLinkParams = z.infer<typeof ZContactLinkParams>;
export type TContactLinkQuery = z.infer<typeof ZContactLinkQuery>;
