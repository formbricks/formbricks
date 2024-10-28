import { PersonDataView } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonDataView";
import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { CircleHelpIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { Button } from "@formbricks/ui/components/Button";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const environment = await getEnvironment(params.environmentId);
  const t = await getTranslations();
  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const HowToAddPeopleButton = (
    <Button
      size="sm"
      href="https://formbricks.com/docs/app-surveys/user-identification"
      variant="secondary"
      target="_blank"
      EndIcon={CircleHelpIcon}>
      {t("environments.people.how_to_add_people")}
    </Button>
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.people")} cta={HowToAddPeopleButton}>
        <PersonSecondaryNavigation activeId="people" environmentId={params.environmentId} />
      </PageHeader>
      <PersonDataView environment={environment} itemsPerPage={ITEMS_PER_PAGE} />
    </PageContentWrapper>
  );
};

export default Page;
