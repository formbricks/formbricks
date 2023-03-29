import TemplateList from "./TemplateList";

export default function SurveyTemplatesPage({ params }) {
  return <TemplateList environmentId={params.environmentId} />;
}
