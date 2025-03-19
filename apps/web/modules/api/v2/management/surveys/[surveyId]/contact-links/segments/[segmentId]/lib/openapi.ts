import { z } from "zod";
import { ZodOpenApiOperationObject } from "zod-openapi";
import { ZId } from "@formbricks/types/common";

const ZContactLinkResponse = z.object({
  contactId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  surveyUrl: z.string().url(),
  expiresAt: z.string().nullable(),
});

const ZContactLinksResponse = z.object({
  data: z.array(ZContactLinkResponse),
  meta: z.object({
    total: z.number(),
  }),
});

export const getContactLinksBySegmentEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactLinksBySegment",
  summary: "Get contact links by segment",
  description: "Generates personalized survey links for contacts in a segment.",
  tags: ["Management API > Surveys > Contact Links"],
  requestParams: {
    path: z.object({
      surveyId: ZId.describe("The ID of the survey"),
      segmentId: ZId.describe("The ID of the segment"),
    }),
    query: z.object({
      expirationDays: z
        .number()
        .positive()
        .optional()
        .describe("Number of days until the generated JWT expires"),
      limit: z.number().min(1).max(250).default(10).describe("Number of items to return"),
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
