import PeopleSegmentsTabs from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsTabs";
import { Metadata } from "next";

import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export const metadata: Metadata = {
  title: "People",
};

export default async function PeopleLayout({ params, children }) {
  return (
    <InnerContentWrapper pageTitle="Respondents">
      <PeopleSegmentsTabs activeId="respondents" environmentId={params.environmentId} />
      {children}
    </InnerContentWrapper>
  );
}
