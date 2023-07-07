import EventClassesList from "./EventClassesList";
import EventsAttributesTabs from "@/components/events_attributes/EventsAttributesTabs";
import ContentWrapper from "@/components/shared/ContentWrapper";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:"Actions & Attributes"
}

export default function EventsPage({ params }) {
  return (
    <div className="">
      <EventsAttributesTabs activeId="events" environmentId={params.environmentId} />
      <ContentWrapper>
        <EventClassesList environmentId={params.environmentId} />
      </ContentWrapper>
    </div>
  );
}
