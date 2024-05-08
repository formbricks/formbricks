import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "People",
};

export default async function PeopleLayout({ params, children }) {
  return (
    <>
      <PeopleSegmentsNav activeId="people" environmentId={params.environmentId} />
      {children}
    </>
  );
}
