import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { SURVEY_EXPORT_FORMATS } from "@/modules/survey/export/lib/formats";
import { exportSurveyOperation } from "./lib/operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/internal/surveys/{surveyId}/export?format=json|xlsx` — the survey as a Formbricks file
 * (`<name>.formbricks.json`, ADR 0016) or an Excel export (`<name>.xlsx`, ADR 0017), from the survey
 * card's Export menu.
 *
 * Internal (Internal API RFC, ENG-1668): session-only, no OpenAPI entry and no stability promise, with
 * every other v3 convention applied. The format is a query parameter, as in Google Drive's
 * `files.export` and Microsoft Graph's `/content?format=`; an unknown one is a 400 naming `format`. The
 * client fetches the file rather than navigating to it, so a refusal arrives as problem JSON it can show.
 * Audited as `exported` on the survey; rate-limited by the default v3 bucket.
 */
const paramsSchema = z.object({
  surveyId: z.cuid2(),
});

const querySchema = z.strictObject({
  format: z.enum(SURVEY_EXPORT_FORMATS),
});

export const GET = withV3ApiWrapper({
  auth: "session",
  action: "exported",
  targetType: "survey",
  schemas: {
    params: paramsSchema,
    query: querySchema,
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) =>
    exportSurveyOperation({
      surveyId: parsedInput.params.surveyId,
      format: parsedInput.query.format,
      authentication,
      requestId,
      instance,
      auditLog,
    }),
});
