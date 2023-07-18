import ContentWrapper from "@/components/shared/ContentWrapper";

import PeopleGroupsTabs from "@/components/people_groups/PeopleGroupsTabs";

export default function EventsAttributesPage({ params }) {
  return (
    <>
      <PeopleGroupsTabs activeId="groups" environmentId={params.environmentId} />
      <ContentWrapper>Coming soon</ContentWrapper>
    </>
  );
}
