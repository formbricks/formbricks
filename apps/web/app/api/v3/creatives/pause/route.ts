/** POST /api/v3/creatives/pause — pause every In progress creative a survey opens, in one request. */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { pauseV3SurveyCreatives } from "../lib/operations";
import { ZV3PauseCreativesBody } from "../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "creative",
  schemas: { query: ZV3EmptyQuery, body: ZV3PauseCreativesBody },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    pauseV3SurveyCreatives({ body: parsedInput.body, authentication, auditLog, requestId, instance }),
});
