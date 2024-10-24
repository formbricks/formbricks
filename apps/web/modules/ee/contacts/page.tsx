import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getContactAttributeKeys } from "@formbricks/lib/services/contact-attribute-keys";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { ContactDataView } from "./components/contact-data-view";
import { ContactsSecondaryNavigation } from "./components/contacts-secondary-navigation";

export const ContactsPage = async ({ params }: { params: { environmentId: string } }) => {
  const environment = await getEnvironment(params.environmentId);
  const contactAttributeKeys = await getContactAttributeKeys(params.environmentId);

  if (!environment) {
    throw new Error("Environment not found");
  }

  const HowToAddPeopleButton = (
    <UploadContactsCSVButton environmentId={environment.id} contactAttributeKeys={contactAttributeKeys} />
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
