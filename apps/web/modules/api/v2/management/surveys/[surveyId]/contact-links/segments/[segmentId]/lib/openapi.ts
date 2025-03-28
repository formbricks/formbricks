import {
  ZContactLinksBySegmentParams,
  ZContactLinksBySegmentQuery,
} from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/types/contact";
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
    path: ZContactLinksBySegmentParams,
    query: ZContactLinksBySegmentQuery,
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
