import PeopleList from "./PeopleList";

export default function PeoplePage({ params }) {
  return (
    <>
      <PeopleList environmentId={params.environmentId} />
    </>
  );
}
