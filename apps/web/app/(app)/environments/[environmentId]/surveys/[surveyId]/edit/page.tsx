export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SurveyEditor from "./SurveyEditor";
import { getSurveyWithAnalytics } from "@formbricks/lib/services/survey";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { getEventClasses } from "@formbricks/lib/services/eventClass";
import { getAttributeClasses } from "@formbricks/lib/services/attributeClass";


export default async function SurveysEditPage({ params }) {

  const [survey, product, environment, eventClasses, attributeClasses] = await Promise.all([getSurveyWithAnalytics(params.surveyId), getProductByEnvironmentId(params.environmentId), getEnvironment(params.environmentId),getEventClasses(params.environmentId), getAttributeClasses(params.environmentId)]);

  return<>{(survey && product && environment) && <SurveyEditor survey={survey} product={product} environment={environment} eventClasses={eventClasses} attributeClasses={attributeClasses}/>}</> 
}
