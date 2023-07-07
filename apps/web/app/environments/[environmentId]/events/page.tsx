import ActionsAttributesTabs from "@/components/events_attributes/EventsAttributesTabs";
import ActionClassesComponent from "@/app/environments/[environmentId]/events/ActionClassesComponent";
import ContentWrapper from "@/components/shared/ContentWrapper";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Actions & Attributes",
};

export default function ActionsPage({ params }) {
  return (
    <>
      <ActionsAttributesTabs activeId="events" environmentId={params.environmentId} />
      <ContentWrapper>
        <ActionClassesComponent environmentId={params.environmentId}></ActionClassesComponent>
      </ContentWrapper>
    </>
  );
}
