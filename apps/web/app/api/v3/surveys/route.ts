/**
 * /api/v3/surveys - list and create block-based survey management resources.
 * Session cookie or x-api-key; scope by workspaceId only.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createV3SurveyResponse, listV3Surveys } from "./lib/operations";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) => {
    return await listV3Surveys({
      searchParams: new URL(req.url).searchParams,
      authentication,
      requestId,
      instance,
    });
  },
});

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: {
    body: z.unknown(),
  },
  action: "created",
  targetType: "survey",
  handler: async ({ authentication, auditLog, parsedInput, requestId, instance }) => {
    return await createV3SurveyResponse({
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
      auditLog,
    });
  },
});
