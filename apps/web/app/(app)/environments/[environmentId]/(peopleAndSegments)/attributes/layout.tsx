import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";

import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export default function AttributeLayout({ params, children }) {
  return (
    <>
      <div className="flex">
        <PeopleSegmentsNav activeId="attributes" environmentId={params.environmentId} />
        <div className="ml-44 w-full">
          <InnerContentWrapper pageTitle="Attributes">{children}</InnerContentWrapper>
        </div>
      </div>
    </>
  );
}
