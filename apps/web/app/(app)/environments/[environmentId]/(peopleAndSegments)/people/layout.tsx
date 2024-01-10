import PeopleSegmentsTabs from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/PeopleSegmentsTabs";
import { Metadata } from "next";

import ContentWrapper from "@formbricks/ui/ContentWrapper";

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
