/**
 * POST /api/internal/surveys/imports — create the survey a reviewed import became (ENG-6850), for every
 * kind of file: a Qualtrics export's or a questionnaire's draft, or a Formbricks file's draft with the
 * references it carries, which are matched in the workspace or created with the survey in one
 * transaction. 201 with a `Location` header naming the survey.
 *
 * Internal surface under the Internal API RFC (ENG-1668): session-only, no OpenAPI entry and no
 * stability promise, with every other v3 convention applied — the origin check, the default v3 rate
 * limit, RFC 9457 problems. Takes an `Idempotency-Key` header, one per review. Audited as `created` on
 * the survey.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { SURVEY_IMPORT_MAX_CREATE_BODY_BYTES } from "@/modules/survey/import/limits";
import { createSurveyImport } from "./lib/operations";
import { ZSurveyImportCreateBody } from "./lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withV3ApiWrapper({
  auth: "session",
  bodyLimitBytes: SURVEY_IMPORT_MAX_CREATE_BODY_BYTES,
  action: "created",
  targetType: "survey",
  schemas: {
    body: ZSurveyImportCreateBody,
  },
  handler: async ({ req, authentication, parsedInput, requestId, instance, auditLog }) =>
    createSurveyImport({
      req,
      authentication,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
