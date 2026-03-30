import { ZodOpenApiPathsObject } from "zod-openapi";
import { getContactLinksBySegmentEndpoint } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/openapi";

export const surveyContactLinksBySegmentPaths: ZodOpenApiPathsObject = {
  "/management/surveys/{surveyId}/contact-links/segments/{segmentId}": {
    get: getContactLinksBySegmentEndpoint,
  },
};
