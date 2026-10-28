import "server-only";
import { logger } from "@formbricks/logger";
import { APP_RELEASE_VERSION } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getSurveyWithCustomCss } from "@/lib/survey/service";
import { getLinkSurveyCustomCss } from "@/modules/survey/link/lib/respondent-custom-css";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { type TSurveyPreviewMeta, buildSurveyPreviewMeta } from "./render-payload";

/**
 * Loads what the renderer needs for a survey the caller is already authorized to read. Only ever called
 * after `getV3Survey` answered 200 for the same id, so authorization, visibility and tenant rules are the
 * ones that operation enforced; the workspace check below is the belt to that braces.
 *
 * Returns `null` when anything fails: the Review tab only needs the v3 survey, and a preview that cannot
 * be built must not cost the person the outline.
 */
export const loadSurveyPreviewMeta = async ({
  surveyId,
  expectedWorkspaceId,
  requestId,
}: {
  surveyId: string;
  expectedWorkspaceId: string | undefined;
  requestId: string;
}): Promise<TSurveyPreviewMeta | null> => {
  const log = logger.withContext({ requestId, surveyId });

  try {
    const survey = await getSurveyWithCustomCss(surveyId);
    if (!survey || (expectedWorkspaceId && survey.workspaceId !== expectedWorkspaceId)) {
      return null;
    }

    const workspaceContext = await getWorkspaceContextForLinkSurvey(survey.workspaceId);
    const customCss = await getLinkSurveyCustomCss({
      workspaceCustomCss: workspaceContext.customCss,
      allowStyleOverwrite: workspaceContext.workspace.styling?.allowStyleOverwrite,
      survey,
    });

    return buildSurveyPreviewMeta({
      survey,
      workspace: {
        styling: workspaceContext.workspace.styling,
        linkSurveyBranding: workspaceContext.workspace.linkSurveyBranding,
      },
      customCss,
      publicDomain: getPublicDomain(),
      releaseVersion: APP_RELEASE_VERSION,
    });
  } catch (error) {
    log.warn({ error }, "Could not build the survey preview data; showing the outline only");
    return null;
  }
};
