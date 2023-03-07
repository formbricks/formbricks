import IntegrationsTabs from "@/components/integrations/IntegrationsTabs";
import ContentWrapper from "@/components/ui/ContentWrapper";

export default function EventsAttributesPage({ params }) {
  return (
    <div className="mx-auto max-w-7xl">
      <IntegrationsTabs activeId="installation" environmentId={params.environmentId} />
      <ContentWrapper>Installation</ContentWrapper>
    </div>
  );
}
