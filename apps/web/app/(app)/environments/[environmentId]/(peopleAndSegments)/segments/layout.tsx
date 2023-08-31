import PeopleSegmentsTabs from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/PeopleSegmentsTabs";
import ContentWrapper from "@/components/shared/ContentWrapper";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "People",
};

export default function PeopleLayout({ params, children }) {
  return (
    <>
      <PeopleSegmentsTabs activeId="segments" environmentId={params.environmentId} />
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
