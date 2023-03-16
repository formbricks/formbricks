import PersonDetails from "./PersonDetails";

export default function PersonPage({ params }) {
  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 lg:px-8">
        <PersonDetails personId={params.personId} environmentId={params.environmentId} />
      </main>
    </div>
  );
}
