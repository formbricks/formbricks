import "server-only";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getAuthorizedV3Survey } from "@/app/api/v3/surveys/authorization";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";

type TAuthorizedSurvey = Awaited<ReturnType<typeof getAuthorizedV3Survey>>;

export type TAttachmentExportAccess =
  | {
      response: null;
      survey: TSurvey;
      organizationId: string;
      workspaceId: string;
      workspaceIdForAudit: string;
      userId: string;
    }
  | { response: Response };

/**
 * The one gate every attachment-export route goes through: read access to the survey, and a session
 * user, since exports belong to the user who started them. Reading a survey's attachments one by one
 * needs the same survey read access, so an export reveals nothing the caller could not already open.
 */
export const authorizeAttachmentExportAccess = async ({
  surveyId,
  authentication,
  requestId,
  instance,
}: {
  surveyId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
}): Promise<TAttachmentExportAccess> => {
  const { survey, authResult, response }: TAuthorizedSurvey = await getAuthorizedV3Survey({
    surveyId,
    authentication,
    access: "read",
    requestId,
    instance,
  });
  if (response) return { response };

  const userId = getSessionUserId(authentication);
  if (!userId) return { response: problemForbidden(requestId, undefined, instance) };

  return {
    response: null,
    survey,
    organizationId: authResult.organizationId,
    workspaceId: survey.workspaceId,
    workspaceIdForAudit: authResult.workspaceId,
    userId,
  };
};
