import EventsList from "./EventsList";
import EventsAttributesTabs from "@/components/events_attributes/EventsAttributesTabs";

export default function EventsAttributesPage({ params }) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="my-8 flex justify-center">
        <EventsAttributesTabs activeId="events" environmentId={params.environmentId} />
      </div>
      <EventsList />
    </div>
  );
}
