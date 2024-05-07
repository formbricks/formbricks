import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";
import { Metadata } from "next";

import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export const metadata: Metadata = {
  title: "People",
};

export default async function PeopleLayout({ params, children }) {
  return (
    <>
      <div className="flex">
        <PeopleSegmentsNav activeId="people" environmentId={params.environmentId} />
        <div className="ml-44 w-full">
          <InnerContentWrapper pageTitle="People">{children}</InnerContentWrapper>
        </div>
      </div>
    </>
  );
}
