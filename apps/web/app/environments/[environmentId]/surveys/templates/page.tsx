import SurveyTemplates from "./SurveyTemplates";

export default function SurveyTemplatesPage({ params }) {
  return <SurveyTemplates environmentId={params.environmentId} />;
}
