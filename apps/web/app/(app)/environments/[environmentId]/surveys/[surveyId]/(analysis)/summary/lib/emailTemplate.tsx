import { getPreviewEmailTemplateHtml } from "@/modules/email/components/preview-email-template";
import { getTranslate } from "@/tolgee/server";
import { getSurveyDomain } from "@formbricks/lib/getSurveyUrl";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getStyling } from "@formbricks/lib/utils/styling";

export const getEmailTemplateHtml = async (surveyId: string, locale: string) => {
  const t = await getTranslate();
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error("Survey not found");
  }
  const project = await getProjectByEnvironmentId(survey.environmentId);
  if (!project) {
    throw new Error("Project not found");
  }

  const styling = getStyling(project, survey);
  const surveyUrl = getSurveyDomain() + "/s/" + survey.id;
  const html = await getPreviewEmailTemplateHtml(survey, surveyUrl, styling, locale, t);
  const doctype =
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';
  const htmlCleaned = html.toString().replace(doctype, "");

  return htmlCleaned;
};
