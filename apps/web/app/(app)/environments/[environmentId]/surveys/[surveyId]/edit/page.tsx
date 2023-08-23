export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SurveyEditor from "./SurveyEditor";
import { getSurveyWithAnalytics } from "@formbricks/lib/services/survey";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { getActionClasses } from "@formbricks/lib/services/actionClass";
import { getAttributeClasses } from "@formbricks/lib/services/attributeClass";

export default async function SurveysEditPage({ params }) {

  // const [survey, product, environment, eventClasses, attributeClasses] = await Promise.all([getSurveyWithAnalytics(params.surveyId), getProductByEnvironmentId(params.environmentId), getEnvironment(params.environmentId),getActionClasses(params.environmentId), getAttributeClasses(params.environmentId)]); 
  const survey = await getSurveyWithAnalytics(params.surveyId)
  const product =  await getProductByEnvironmentId(params.environmentId)
  const environment =await  getEnvironment(params.environmentId)
  const eventClasses = await getActionClasses(params.environmentId)
  const attributeClasses = await getAttributeClasses(params.environmentId)

  return (
    <>
    {(!survey || !environment || !eventClasses || !attributeClasses) && console.log("missing")}
    {(survey && environment && eventClasses && attributeClasses) && <SurveyEditor survey={survey} product={product} environment={environment} eventClasses={eventClasses} attributeClasses={attributeClasses}/>}
    </> 

    )
    
}
