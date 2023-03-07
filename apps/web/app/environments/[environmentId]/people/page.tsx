import PeopleList from "./PeopleList";

export default function EventsAttributesPage({ params }) {
  return (
    <div className="mx-auto mt-8 max-w-7xl">
      <PeopleList environmentId={params.environmentId} />
    </div>
  );
}
