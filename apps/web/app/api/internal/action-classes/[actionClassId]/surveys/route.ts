import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getActionClassSurveysOperation } from "../../lib/operations";
import { ZActionClassParams, ZActionClassSurveysQuery } from "../../schemas";

/** `GET /api/internal/action-classes/{actionClassId}/surveys`: the surveys an action triggers. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZActionClassParams, query: ZActionClassSurveysQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getActionClassSurveysOperation({
      authentication,
      actionClassId: parsedInput.params.actionClassId,
      excludeSurveyId: parsedInput.query.excludeSurveyId,
      requestId,
      instance,
    }),
});
