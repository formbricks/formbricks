import PeopleSegmentsTabs from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsTabs";

import { ContentWrapper } from "@formbricks/ui/ContentWrapper";

export default function ActionsAndAttributesLayout({ params, children }) {
  return (
    <ContentWrapper>
      <PeopleSegmentsTabs activeId="attributes" environmentId={params.environmentId} />
      {children}
    </ContentWrapper>
  );
}
