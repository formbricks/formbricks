import { PersonDataView } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonDataView";
import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { CircleHelpIcon } from "lucide-react";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { Button } from "@formbricks/ui/Button";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new Error("Environment not found");
  }

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
    <PageContentWrapper>
      <PageHeader pageTitle="People" cta={HowToAddPeopleButton}>
        <PersonSecondaryNavigation activeId="people" environmentId={params.environmentId} />
      </PageHeader>
      <PersonDataView environment={environment} />
    </PageContentWrapper>
  );
};

export default Page;
