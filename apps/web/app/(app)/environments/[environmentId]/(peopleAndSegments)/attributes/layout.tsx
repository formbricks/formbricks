import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";

import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export default function ActionsAndAttributesLayout({ params, children }) {
  return (
    <div className="flex">
      <PeopleSegmentsNav activeId="attributes" environmentId={params.environmentId} />
      <InnerContentWrapper pageTitle="Attributes">{children}</InnerContentWrapper>
    </div>
  );
}
