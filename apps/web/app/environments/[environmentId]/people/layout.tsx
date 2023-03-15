import ContentWrapper from "@/components/shared/ContentWrapper";
import PeopleGroupsTabs from "@/components/people_groups/PeopleGroupsTabs";

export default function PeopleLayout({ params, children }) {
  return (
    <>
      <PeopleGroupsTabs activeId="people" environmentId={params.environmentId} />
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
