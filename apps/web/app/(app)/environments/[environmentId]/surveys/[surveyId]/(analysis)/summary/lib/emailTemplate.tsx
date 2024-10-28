import { getPreviewEmailTemplateHtml } from "@formbricks/email/components/preview-email-template";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getStyling } from "@formbricks/lib/utils/styling";

export const getEmailTemplateHtml = async (surveyId: string, t: (key: string) => string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error(t("common.survey_not_found"));
  }
  const product = await getProductByEnvironmentId(survey.environmentId);
  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const styling = getStyling(product, survey);
  const surveyUrl = WEBAPP_URL + "/s/" + survey.id;
  const html = await getPreviewEmailTemplateHtml(survey, surveyUrl, styling);
  const doctype =
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';
  const htmlCleaned = html.toString().replace(doctype, "");

  return htmlCleaned;
};
