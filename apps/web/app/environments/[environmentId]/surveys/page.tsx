import SurveyList from "@/components/surveys/SurveyList";

export default async function SurveysPage({ params }) {
  return (
    <div>
      <SurveyList environmentId={params.environmentId} />
    </div>
  );
}
