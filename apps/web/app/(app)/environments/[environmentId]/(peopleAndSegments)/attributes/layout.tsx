import PeopleSegmentsTabs from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsTabs";

import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export default function ActionsAndAttributesLayout({ params, children }) {
  return (
    <InnerContentWrapper pageTitle="Attributes">
      <PeopleSegmentsTabs activeId="attributes" environmentId={params.environmentId} />
      {children}
    </InnerContentWrapper>
  );
}
