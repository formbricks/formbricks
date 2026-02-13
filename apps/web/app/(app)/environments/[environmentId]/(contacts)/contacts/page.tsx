import { ITEMS_PER_PAGE } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { UploadContactsCSVButton } from "@/modules/contacts/components/upload-contacts-button";
import { ContactDataView } from "@/modules/ee/contacts/components/contact-data-view";
import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getContacts } from "@/modules/ee/contacts/lib/contacts";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const ContactsPage = async ({ params: paramsProps }: { params: Promise<{ environmentId: string }> }) => {
  const params = await paramsProps;

  const { environment, isReadOnly, organization } = await getEnvironmentAuth(params.environmentId);

  const t = await getTranslate();

  const isQuotasAllowed = await getIsQuotasEnabled(organization.billing.plan);

  const contactAttributeKeys = await getContactAttributeKeys(params.environmentId);
  const initialContacts = await getContacts(params.environmentId, 0);

  const AddContactsButton = <UploadContactsCSVButton environmentId={environment.id} />;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.contacts")} cta={!isReadOnly ? AddContactsButton : undefined}>
        <ContactsSecondaryNavigation activeId="contacts" environmentId={params.environmentId} />
      </PageHeader>

      <ContactDataView
        key={initialContacts.length + contactAttributeKeys.length}
        environment={environment}
        itemsPerPage={ITEMS_PER_PAGE}
        contactAttributeKeys={contactAttributeKeys}
        isReadOnly={isReadOnly}
        initialContacts={initialContacts}
        hasMore={initialContacts.length >= ITEMS_PER_PAGE}
        isQuotasAllowed={isQuotasAllowed}
      />
    </PageContentWrapper>
  );
};

export default ContactsPage;
