import SurveyList from "@/components/surveys/SurveyList";

export default async function SurveysPage({ params }) {
  return <SurveyList environmentId={params.environmentId} />;
}
