import { handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import {
  DEFAULT_PREFILL_LINK_EXPIRATION_DAYS,
  getPrefillSurveyLink,
} from "@/modules/survey/link/lib/prefill-survey-link";
import { fetchAndAuthorizeResponse } from "../lib/authorize";

/**
 * GET /api/v1/management/responses/{responseId}/prefill-link
 *
 * Mints a signed, encrypted link that opens the response's survey prefilled with
 * that response's answers. Requires an API key with read access to the survey's
 * workspace, so only authorized callers can create a prefill link. Optional query
 * param `expirationDays` (positive integer) overrides the default lifetime.
 */
export const GET = withV1ApiWrapper({
  handler: async ({
    req,
    props,
    authentication,
  }: THandlerParams<{ params: Promise<{ responseId: string }> }>) => {
    const params = await props.params;
    try {
      const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "GET");
      if (result.error) {
        return { response: result.error };
      }

      if (result.survey.type !== "link") {
        return {
          response: responses.badRequestResponse("Prefill links are only available for link surveys"),
        };
      }

      let expirationDays = DEFAULT_PREFILL_LINK_EXPIRATION_DAYS;
      const expirationDaysParam = new URL(req.url).searchParams.get("expirationDays");
      if (expirationDaysParam !== null) {
        const parsed = Number(expirationDaysParam);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          return {
            response: responses.badRequestResponse("expirationDays must be a positive integer"),
          };
        }
        expirationDays = parsed;
      }

      const linkResult = getPrefillSurveyLink(result.response.id, result.survey.id, expirationDays);
      if (!linkResult.ok) {
        return {
          response: responses.internalServerErrorResponse(linkResult.error.message),
        };
      }

      return {
        response: responses.successResponse({
          prefillSurveyUrl: linkResult.data,
          expirationDays,
        }),
      };
    } catch (error) {
      return { response: handleErrorResponse(error) };
    }
  },
});
