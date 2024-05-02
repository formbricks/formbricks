import PeopleSegmentsTabs from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsTabs";
import { Metadata } from "next";

import { ContentWrapper } from "@formbricks/ui/ContentWrapper";

export const metadata: Metadata = {
  title: "People",
};

export default async function PeopleLayout({ params, children }) {
  return (
    <ContentWrapper>
      <PeopleSegmentsTabs activeId="respondents" environmentId={params.environmentId} />
      {children}
    </ContentWrapper>
  );
}
