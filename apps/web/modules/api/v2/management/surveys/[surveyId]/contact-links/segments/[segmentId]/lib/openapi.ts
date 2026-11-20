import { ZodOpenApiOperationObject } from "zod-openapi";
import {
  ZContactLinkResponse,
  ZContactLinksBySegmentParams,
  ZContactLinksBySegmentQuery,
} from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/types/contact";
import { makePartialSchema, responseWithMetaSchema } from "@/modules/api/v2/types/openapi-response";

export const getContactLinksBySegmentEndpoint: ZodOpenApiOperationObject = {
  operationId: "getContactLinksBySegment",
  summary: "Get survey links for contacts in a segment",
  description:
    "Generates personalized survey links for contacts in a segment. Although this is a GET, it creates credentials: each link lets whoever holds it submit a response as that contact. The API key therefore needs read & write access to the workspace; a read-only key, or a key restricted from this survey, is rejected with 401.",
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
