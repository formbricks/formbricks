import { NextRequest } from "next/server";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { authenticateRequest } from "@/app/api/v1/auth";
import { type TAuthorizationActor, can } from "@/lib/authorization";
import { getWorkspaceAuthorizationActionForMethod } from "@/lib/authorization/permission-action";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { SURVEY_ACTION_FOR_METHOD } from "@/lib/survey/visibility/api-key";
import { getSession } from "@/modules/auth/lib/session";
import { getStorageFileNameScope } from "@/modules/storage/utils";

/**
 * ENG-3282: a file under `surveys/{surveyId}/…` belongs to that survey, so once visibility is enforced
 * the survey has to be reachable too — a restricted survey's uploads are its owner's and the organization
 * administrators'. Legacy paths name no survey and keep the workspace check alone.
 *
 * The survey is read from the decoded, joined name — the key the storage read and delete build — not
 * from the raw segments: `surveys%2F{id}%2F…` (or `%252F` once the router has decoded it) is a single
 * segment here but `surveys/{id}/…` in storage. A name that does not decode is refused
 * outright (storage fails on it too), and so, once enforced, is a `surveys/` key with an empty survey
 * segment: it names no survey the caller could be checked against.
 */
const canReachSurveyFile = async (
  actor: TAuthorizationActor,
  filePath: ReadonlyArray<string>,
  action: "GET" | "DELETE"
): Promise<boolean> => {
  const scope = getStorageFileNameScope(filePath.join("/"));
  if (!scope.decodable) return false;
  if (!scope.isSurveyScope) return true;
  if (!(await isSurveyVisibilityReady())) return true;
  if (!scope.surveyId) return false;
  return can(actor, SURVEY_ACTION_FOR_METHOD[action], { type: "survey", id: scope.surveyId });
};

export const authorizePrivateDownload = async (
  request: NextRequest,
  workspaceId: string,
  action: "GET" | "DELETE",
  filePath: ReadonlyArray<string>
): Promise<
  Result<
    { authType: "session"; userId: string } | { authType: "apiKey"; apiKeyId: string },
    {
      unauthorized: boolean;
    }
  >
> => {
  const session = await getSession();

  if (session?.user) {
    const isUserAuthorized = await can(
      { type: "user", id: session.user.id },
      getWorkspaceAuthorizationActionForMethod(action),
      { type: "workspace", id: workspaceId }
    );
    if (
      !isUserAuthorized ||
      !(await canReachSurveyFile({ type: "user", id: session.user.id }, filePath, action))
    ) {
      return err({
        unauthorized: true,
      });
    }

    return ok({
      authType: "session",
      userId: session.user.id,
    });
  }

  const auth = await authenticateRequest(request);
  if (!auth) {
    return err({
      unauthorized: false,
    });
  }

  if (
    !(await can({ type: "apiKey", id: auth.apiKeyId }, getWorkspaceAuthorizationActionForMethod(action), {
      type: "workspace",
      id: workspaceId,
    })) ||
    !(await canReachSurveyFile({ type: "apiKey", id: auth.apiKeyId }, filePath, action))
  ) {
    return err({
      unauthorized: true,
    });
  }

  return ok({
    authType: "apiKey",
    apiKeyId: auth.apiKeyId,
  });
};
