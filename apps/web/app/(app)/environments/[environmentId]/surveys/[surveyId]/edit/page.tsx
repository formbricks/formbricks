export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SurveyEditor from "./SurveyEditor";
import { getSurveyWithAnalytics } from "@formbricks/lib/services/survey";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getEnvironment } from "@formbricks/lib/services/environment";


export default async function SurveysEditPage({ params }) {

  const [survey, product, environment] = await Promise.all([getSurveyWithAnalytics(params.surveyId), getProductByEnvironmentId(params.environmentId), getEnvironment(params.environmentId)]);

  return<>{(survey && product && environment) && <SurveyEditor survey={survey} product={product} environment={environment} />}</> 
}
