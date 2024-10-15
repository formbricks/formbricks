import { CircleHelpIcon } from "lucide-react";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { Button } from "@formbricks/ui/components/Button";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { ContactDataView } from "./components/ContactDataView";
import { ContactsSecondaryNavigation } from "./components/ContactsSecondaryNavigation";

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
      <PageHeader pageTitle="Contacts" cta={HowToAddPeopleButton}>
        <ContactsSecondaryNavigation activeId="contacts" environmentId={params.environmentId} />
      </PageHeader>
      <ContactDataView environment={environment} itemsPerPage={ITEMS_PER_PAGE} />
    </PageContentWrapper>
  );
};

export default Page;
