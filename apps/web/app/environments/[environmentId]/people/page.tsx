import PeopleList from "./PeopleList";

export default function PeoplePage({ params }) {
  return (
    <>
      <h1 className="my-2 text-3xl font-bold text-slate-800">People</h1>
      <p className="mb-6 text-slate-500">
        A list of all people who used your application since embedding the Formbricks JS widget.
      </p>
      <PeopleList environmentId={params.environmentId} />
    </>
  );
}
