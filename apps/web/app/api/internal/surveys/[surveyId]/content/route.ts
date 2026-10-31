/**
 * PUT /api/internal/surveys/{surveyId}/content — Update a survey from a reviewed Formbricks file
 * import (ENG-6851): replace its content and keep its id, status, responses, name, settings and styling.
 * 200 on success; 409 when the survey changed since the `updatedAt` sent, with the current one; 422 when
 * the survey is active or the file is not valid for it.
 *
 * Internal surface under the Internal API RFC (ENG-1668): session-only, no OpenAPI entry and no
 * stability promise, with every other v3 convention applied — the origin check, the default v3 rate
 * limit, RFC 9457 problems. Idempotent through its `updatedAt` precondition, so it takes no
 * Idempotency-Key. Audited as `updated` on the survey.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { SURVEY_IMPORT_MAX_CREATE_BODY_BYTES } from "@/modules/survey/import/limits";
import { updateSurveyContent } from "./lib/operations";
import { ZSurveyContentUpdateBody, ZSurveyContentUpdateParams } from "./lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = withV3ApiWrapper({
  auth: "session",
  bodyLimitBytes: SURVEY_IMPORT_MAX_CREATE_BODY_BYTES,
  action: "updated",
  targetType: "survey",
  schemas: {
    params: ZSurveyContentUpdateParams,
    body: ZSurveyContentUpdateBody,
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) =>
    updateSurveyContent({
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
      auditLog,
    }),
});
