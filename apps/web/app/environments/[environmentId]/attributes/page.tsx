import EventsAttributesTabs from "@/components/events_attributes/EventsAttributesTabs";
import ContentWrapper from "@/components/shared/ContentWrapper";

export default function EventsAttributesPage({ params }) {
  return (
    <div className="">
      <EventsAttributesTabs activeId="attributes" environmentId={params.environmentId} />
      <ContentWrapper>Attribute</ContentWrapper>
    </div>
  );
}
