import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contacts";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { getIsContactsEnabled } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { ContactDataView } from "./components/contact-data-view";
import { ContactsSecondaryNavigation } from "./components/contacts-secondary-navigation";

export const ContactsPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await paramsProps;
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("Session not found");
  }

  const isContactsEnabled = await getIsContactsEnabled();
  if (!isContactsEnabled) {
    notFound();
  }

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
