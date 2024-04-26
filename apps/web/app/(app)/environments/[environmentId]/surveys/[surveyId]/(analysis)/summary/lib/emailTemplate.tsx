import { getPreviewEmailTemplateHtml } from "@formbricks/email/components/survey/PreviewEmailTemplste";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { getSurvey } from "@formbricks/lib/survey/service";

export const getEmailTemplateHtml = async (surveyId) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new Error("Survey not found");
  }
  const product = await getProductByEnvironmentId(survey.environmentId);
  if (!product) {
    throw new Error("Product not found");
  }
  const brandColor = product.styling.brandColor?.light || COLOR_DEFAULTS.brandColor;
  const surveyUrl = WEBAPP_URL + "/s/" + survey.id;
  const html = getPreviewEmailTemplateHtml(survey, surveyUrl, brandColor);
  const doctype =
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';
  const htmlCleaned = html.toString().replace(doctype, "");

  return htmlCleaned;
};
