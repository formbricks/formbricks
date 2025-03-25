import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";

const ZContactLinkResponse = z
  .object({
    contactId: z.string(),
    surveyUrl: z.string().url(),
    expiresAt: z.string().nullable(),
  })
  .catchall(z.string());

const ZContactLinksResponse = z.object({
  data: z.array(ZContactLinkResponse),
  meta: z.object({
    total: z.number(),
  }),
});

export const getContactLinksBySegmentEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactLinksBySegment",
  summary: "Get survey links for contacts in a segment",
  description: "Generates personalized survey links for contacts in a segment.",
  tags: ["Management API > Surveys > Contact Links"],
  requestParams: {
    path: z.object({
      surveyId: z.string().cuid2().describe("The ID of the survey"),
      segmentId: z.string().cuid2().describe("The ID of the segment"),
    }),
    query: z.object({
      expirationDays: z
        .number()
        .positive()
        .min(1)
        .max(365)
        .nullable()
        .optional()
        .default(null)
        .describe("Number of days until the generated JWT expires"),
      limit: z.number().min(1).max(10).default(10).describe("Number of items to return"),
      skip: z.number().min(0).default(0).describe("Number of items to skip"),
    }),
  },
  responses: {
    "200": {
      description: "Contact links generated successfully.",
      content: {
        "application/json": {
          schema: ZContactLinksResponse,
        },
      },
    },
  },
};
