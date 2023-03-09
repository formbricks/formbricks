import ContentWrapper from "@/components/shared/ContentWrapper";
import PeopleList from "./PeopleList";
import PeopleGroupsTabs from "@/components/people_groups/PeopleGroupsTabs";

export default function PeoplePage({ params }) {
  return (
    <>
      <PeopleList environmentId={params.environmentId} />
    </>
  );
}
