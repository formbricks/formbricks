import { getPublicDomain } from "@/lib/getPublicUrl";
import { getSurvey } from "@/lib/survey/service";
import { getStyling } from "@/lib/utils/styling";
import { getWorkspaceByEnvironmentId } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { getPreviewEmailTemplateHtml } from "@/modules/email/components/preview-email-template";

export const getEmailTemplateHtml = async (surveyId: string, locale: string) => {
  const t = await getTranslate();
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error("Survey not found");
  }
  const workspace = await getWorkspaceByEnvironmentId(survey.environmentId);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const styling = getStyling(workspace, survey);
  const surveyUrl = getPublicDomain() + "/s/" + survey.id;
  const html = await getPreviewEmailTemplateHtml(survey, surveyUrl, styling, locale, t);
  const doctype =
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';
  const htmlCleaned = html.toString().replace(doctype, "");

  return htmlCleaned;
};
