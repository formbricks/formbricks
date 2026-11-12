/**
 * POST /api/v3/surveys/generate — generate a survey draft from a prompt; persists nothing.
 *
 * `rateLimit: false` because the operation charges the survey-generation budget itself (10/min, shared
 * with the `generate_survey` MCP tool and the streaming route), and the wrapper's limit never sees an MCP
 * call.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { generateV3Survey } from "./operations";
import { ZV3SurveyGenerateBody } from "./schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  rateLimit: false,
  schemas: {
    body: ZV3SurveyGenerateBody,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    generateV3Survey({ authentication, body: parsedInput.body, requestId, instance }),
});
