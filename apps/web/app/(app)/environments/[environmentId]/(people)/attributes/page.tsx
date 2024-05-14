import { PeopleSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PeopleSecondaryNavigation";
import { CircleHelpIcon } from "lucide-react";
import { Metadata } from "next";

import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { Button } from "@formbricks/ui/Button";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

import { AttributeClassesTable } from "./components/AttributeClassesTable";

export const metadata: Metadata = {
  title: "Attributes",
};

const Page = async ({ params }) => {
  let attributeClasses = await getAttributeClasses(params.environmentId);

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
    <PageContentWrapper>
      <PageHeader pageTitle="People" cta={HowToAddAttributesButton}>
        <PeopleSecondaryNavigation activeId="attributes" environmentId={params.environmentId} />
      </PageHeader>
      <AttributeClassesTable attributeClasses={attributeClasses} />
    </PageContentWrapper>
  );
};

export default Page;
