import { managementServer } from "@/modules/api/v2/management/lib/openapi";
import { getContactLinksBySegmentEndpoint } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/openapi";
import { ZodOpenApiPathsObject } from "zod-openapi";

export const surveyContactLinksBySegmentPaths: ZodOpenApiPathsObject = {
  "/surveys/{surveyId}/contact-links/segments/{segmentId}": {
    servers: managementServer,
    get: getContactLinksBySegmentEndpoint,
  },
};
