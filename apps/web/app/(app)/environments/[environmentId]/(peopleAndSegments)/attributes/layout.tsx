import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";

export default function AttributeLayout({ params, children }) {
  return (
    <>
      <PeopleSegmentsNav activeId="attributes" environmentId={params.environmentId} />
      {children}
    </>
  );
}
