import ContentWrapper from "@/components/shared/ContentWrapper";
import TemplateList from "./TemplateList";

export default function SurveyTemplatesPage({ params }) {
  return (
    <ContentWrapper>
      <TemplateList environmentId={params.environmentId} />
    </ContentWrapper>
  );
}
