import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getSurvey } from "@/lib/survey/service";
import { getStyling } from "@/lib/utils/styling";
import { getTranslate } from "@/lingodotdev/server";
import { getPreviewEmailTemplateHtml } from "@/modules/email/components/preview-email-template";
import { extractEmailBodyFragment } from "./emailTemplateFragment";

export const getEmailTemplateHtml = async (surveyId: string, locale: string) => {
  const t = await getTranslate();
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError(t("common.survey"), surveyId);
  }
  const project = await getProjectByEnvironmentId(survey.environmentId);
  if (!project) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const styling = getStyling(project, survey);
  const surveyUrl = getPublicDomain() + "/s/" + survey.id;
  const html = await getPreviewEmailTemplateHtml(survey, surveyUrl, styling, locale, t);

  return extractEmailBodyFragment(html.toString());
};
