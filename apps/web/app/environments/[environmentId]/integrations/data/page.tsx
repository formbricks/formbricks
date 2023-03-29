import IntegrationsTabs from "@/components/integrations/IntegrationsTabs";
import ContentWrapper from "@/components/shared/ContentWrapper";

export default function EventsAttributesPage({ params }) {
  return (
    <div className="">
      <IntegrationsTabs activeId="data" environmentId={params.environmentId} />
      <ContentWrapper>Data</ContentWrapper>
    </div>
  );
}
