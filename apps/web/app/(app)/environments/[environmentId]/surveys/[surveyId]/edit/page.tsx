import SurveyEditor from "./SurveyEditor";
import { getEnvironment } from "@formbricks/lib/services/environment";

export default async function SurveysEditPage({ params }) {
  const environment = await getEnvironment(params.environmentId);
  return (
    <SurveyEditor environmentId={params.environmentId} surveyId={params.surveyId} environment={environment} />
  );
}
