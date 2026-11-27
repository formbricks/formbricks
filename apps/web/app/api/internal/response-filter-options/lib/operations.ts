import "server-only";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getResponseFilteringValues } from "@/lib/response/service";
import { getTagsByWorkspaceId } from "@/lib/tag/service";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { serializeResponseFilterOptions } from "../serializers";
import { authorizeSurveyResponseAccess } from "./access";

/**
 * `GET /api/internal/response-filter-options?surveyId=`: what the survey's Responses / Summary filter can
 * offer. It reads every response of the survey for the values they hold, so the page asks only once the
 * filter is opened. `survey.response_read` on the survey, as the server action it replaces checked.
 */
export async function getResponseFilterOptionsOperation({
  authentication,
  surveyId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  requestId: string;
  instance: string;
}): Promise<Response> {
  const scope = await authorizeSurveyResponseAccess({
    authentication,
    surveyId,
    requestId,
    instance,
  });
  if (scope instanceof Response) return scope;

  try {
    const organizationBilling = await getOrganizationBilling(scope.organizationId);
    if (!organizationBilling) throw new ResourceNotFoundError("Organization", scope.organizationId);

    const isQuotasAllowed = await getIsQuotasEnabled(scope.organizationId);
    const [tags, values, quotas] = await Promise.all([
      getTagsByWorkspaceId(scope.workspaceId),
      getResponseFilteringValues(surveyId),
      isQuotasAllowed ? getQuotas(surveyId) : [],
    ]);

    return successResponse(
      serializeResponseFilterOptions({
        tags,
        attributes: values.contactAttributes,
        hiddenFields: values.hiddenFields,
        reservedValues: values.reservedValues,
        variableValues: values.variableValues,
        quotas,
      }),
      { requestId, cache: "private, no-store" }
    );
  } catch (error) {
    return mapV3ThrownError(error, {
      log: logger.withContext({ requestId }),
      requestId,
      instance,
      operation: "response-filter-options.get",
    });
  }
}
