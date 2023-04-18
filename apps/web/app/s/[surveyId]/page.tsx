import SurveyPage from "./SurveyPage";

export default function LinkSurveyPage({ params }) {
  return <SurveyPage surveyId={params.surveyId} />;
}
