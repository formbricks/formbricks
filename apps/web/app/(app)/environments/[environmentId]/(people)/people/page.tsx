import { PersonDataView } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonDataView";
import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { CircleHelpIcon } from "lucide-react";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getPersonCount } from "@formbricks/lib/person/service";
import { Button } from "@formbricks/ui/components/Button";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const environment = await getEnvironment(params.environmentId);
  const personCount = await getPersonCount(params.environmentId);

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
      <PersonDataView environment={environment} personCount={personCount} itemsPerPage={ITEMS_PER_PAGE} />
    </PageContentWrapper>
  );
};

export default Page;
