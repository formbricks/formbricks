import { ITEMS_PER_PAGE } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { BulkGenerateLinksButton } from "@/modules/ee/contacts/components/bulk-generate-links-button";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getContacts } from "@/modules/ee/contacts/lib/contacts";
import { getPublishedLinkSurveys } from "@/modules/ee/contacts/lib/surveys";
import { getIsContactsEnabled, getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ContactDataView } from "./components/contact-data-view";

export const ContactsPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await paramsProps;

  const { environment, isReadOnly, organization } = await getEnvironmentAuth(params.environmentId);

  const t = await getTranslate();

  const isContactsEnabled = await getIsContactsEnabled();

  const isQuotasAllowed = await getIsQuotasEnabled(organization.billing.plan);

  const [contactAttributeKeys, initialContacts, publishedLinkSurveys] = await Promise.all([
    getContactAttributeKeys(params.environmentId),
    getContacts(params.environmentId, 0),
    getPublishedLinkSurveys(params.environmentId),
  ]);

  const AddContactsButton = (
    <div className="flex gap-2">
      <BulkGenerateLinksButton environmentId={environment.id} publishedLinkSurveys={publishedLinkSurveys} />
      <UploadContactsCSVButton environmentId={environment.id} contactAttributeKeys={contactAttributeKeys} />
    </div>
  );

  return (
    <ContactsPageLayout
      pageTitle={t("common.contacts")}
      activeId="contacts"
      environmentId={params.environmentId}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      cta={AddContactsButton}>
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
    </ContactsPageLayout>
  );
};
