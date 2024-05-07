import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";
import { CircleHelpIcon } from "lucide-react";

import { Button } from "@formbricks/ui/Button";
import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export default function AttributeLayout({ params, children }) {
  const HowToAddAttributesButton = (
    <Button
      size="sm"
      href="https://formbricks.com/docs/app-surveys/user-identification#setting-custom-user-attributes"
      variant="secondary"
      target="_blank"
      EndIcon={CircleHelpIcon}>
      How to add attributes
    </Button>
  );

  return (
    <>
      <div className="flex">
        <PeopleSegmentsNav activeId="attributes" environmentId={params.environmentId} />
        <div className="w-full">
          <InnerContentWrapper pageTitle="Attributes" cta={HowToAddAttributesButton}>
            {children}
          </InnerContentWrapper>
        </div>
      </div>
    </>
  );
}
