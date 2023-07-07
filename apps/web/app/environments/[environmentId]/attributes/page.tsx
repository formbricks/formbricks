import AttributeClassesList from "./AttributeClassesList";
import ActionsAttributesTabs from "@/components/events_attributes/EventsAttributesTabs";
import ContentWrapper from "@/components/shared/ContentWrapper";

export default function AttributesPage({ params }) {
  return (
    <div className="">
      <ActionsAttributesTabs activeId="attributes" environmentId={params.environmentId} />
      <ContentWrapper>
        <AttributeClassesList environmentId={params.environmentId} />
      </ContentWrapper>
    </div>
  );
}
