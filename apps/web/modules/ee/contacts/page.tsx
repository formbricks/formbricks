import { contactCache } from "@/lib/cache/contact";
import { IS_FORMBRICKS_CLOUD, ITEMS_PER_PAGE } from "@/lib/constants";
import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getContacts } from "@/modules/ee/contacts/lib/contacts";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getTranslate } from "@/tolgee/server";
import { ContactDataView } from "./components/contact-data-view";
import { ContactsSecondaryNavigation } from "./components/contacts-secondary-navigation";

export const ContactsPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await paramsProps;

  const { environment, isReadOnly } = await getEnvironmentAuth(params.environmentId);

  const t = await getTranslate();

  const isContactsEnabled = await getIsContactsEnabled();

  const contactAttributeKeys = await getContactAttributeKeys(params.environmentId);
  const initialContacts = await getContacts(params.environmentId, 0);

  const AddContactsButton = (
    <UploadContactsCSVButton environmentId={environment.id} contactAttributeKeys={contactAttributeKeys} />
  );

  const refreshContacts = async () => {
    "use server";
    contactCache.revalidate({ environmentId: params.environmentId });
  };

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("common.contacts")}
        cta={isContactsEnabled && !isReadOnly ? AddContactsButton : undefined}>
        <ContactsSecondaryNavigation activeId="contacts" environmentId={params.environmentId} />
      </PageHeader>

      {isContactsEnabled ? (
        <ContactDataView
          key={initialContacts.length + contactAttributeKeys.length}
          environment={environment}
          itemsPerPage={ITEMS_PER_PAGE}
          contactAttributeKeys={contactAttributeKeys}
          isReadOnly={isReadOnly}
          initialContacts={initialContacts}
          hasMore={initialContacts.length >= ITEMS_PER_PAGE}
          refreshContacts={refreshContacts}
        />
      ) : (
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("environments.contacts.unlock_contacts_title")}
            description={t("environments.contacts.unlock_contacts_description")}
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.start_free_trial") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/environments/${params.environmentId}/settings/billing`
                  : "https://formbricks.com/upgrade-self-hosting-license",
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/environments/${params.environmentId}/settings/billing`
                  : "https://formbricks.com/learn-more-self-hosting-license",
              },
            ]}
          />
        </div>
      )}
    </PageContentWrapper>
  );
};
