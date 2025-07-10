import {
  ZContactLinkResponse,
  ZContactLinksBySegmentParams,
  ZContactLinksBySegmentQuery,
} from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/types/contact";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";
import { ZodOpenApiOperationObject } from "zod-openapi";

export const getContactLinksBySegmentEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactLinksBySegment",
  summary: "Get survey links for contacts in a segment",
  description: "Generates personalized survey links for contacts in a segment.",
  tags: ["Management API - Surveys - Contact Links"],
  requestParams: {
    path: ZContactLinksBySegmentParams,
    query: ZContactLinksBySegmentQuery,
  },
  responses: {
    "200": {
      description: "Contact links generated successfully.",
      content: {
        "application/json": {
          schema: responseWithMetaSchema(makePartialSchema(ZContactLinkResponse)),
        },
      },
    },
  },
};
