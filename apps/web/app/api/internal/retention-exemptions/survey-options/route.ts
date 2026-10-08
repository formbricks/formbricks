import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listRetentionExemptionSurveyOptionsOperation } from "../lib/operations";
import { ZRetentionExemptionSurveyOptionsQuery } from "../schemas";

/**
 * `GET /api/internal/retention-exemptions/survey-options?organizationId=&search=&limit=`: the surveys the
 * Add exemption dialog offers, across every workspace of the organisation and searchable by name. The
 * v3 survey list is per workspace, and the dialog picks from the whole organisation (ENG-3610).
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZRetentionExemptionSurveyOptionsQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listRetentionExemptionSurveyOptionsOperation({
      authentication,
      query: parsedInput.query,
      requestId,
      instance,
    }),
});
