import EventsList from "./EventsList";
import EventsAttributesTabs from "@/components/events_attributes/EventsAttributesTabs";
import ContentWrapper from "@/components/ui/ContentWrapper";

export default function EventsAttributesPage({ params }) {
  return (
    <div className="mx-auto max-w-7xl">
      <EventsAttributesTabs activeId="events" environmentId={params.environmentId} />
      <ContentWrapper>
        <EventsList />
      </ContentWrapper>
    </div>
  );
}
