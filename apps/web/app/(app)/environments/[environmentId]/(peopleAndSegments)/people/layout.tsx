import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";
import { CircleHelpIcon } from "lucide-react";
import { Metadata } from "next";

import { Button } from "@formbricks/ui/Button";
import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export const metadata: Metadata = {
  title: "People",
};

export default async function PeopleLayout({ params, children }) {
  const HowToAddPeopleButton = (
    <Button
      size="sm"
      href="https://formbricks.com/docs/app-surveys/user-identification"
      variant="secondary"
      target="_blank"
      EndIcon={CircleHelpIcon}>
      How to add people
    </Button>
  );
  return (
    <>
      <div className="flex">
        <PeopleSegmentsNav activeId="people" environmentId={params.environmentId} />
        <div className="ml-44 w-full">
          <InnerContentWrapper pageTitle="People" cta={HowToAddPeopleButton}>
            {children}
          </InnerContentWrapper>
        </div>
      </div>
    </>
  );
}
