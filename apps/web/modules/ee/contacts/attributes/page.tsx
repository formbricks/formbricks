import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { AttributesTable } from "./components/attributes-table";
import { CreateAttributeModal } from "./components/create-attribute-modal";

export const AttributesPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await paramsProps;
  const locale = await getLocale();
  const t = await getTranslate();
  const [{ isReadOnly }, contactAttributeKeys] = await Promise.all([
    getEnvironmentAuth(params.environmentId),
    getContactAttributeKeys(params.environmentId),
  ]);

  const isContactsEnabled = await getIsContactsEnabled();

  return (
    <ContactsPageLayout
      pageTitle={t("common.contacts")}
      activeId="attributes"
      environmentId={params.environmentId}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      cta={<CreateAttributeModal environmentId={params.environmentId} />}>
      <AttributesTable
        contactAttributeKeys={contactAttributeKeys}
        isReadOnly={isReadOnly}
        environmentId={params.environmentId}
        locale={locale}
      />
    </ContactsPageLayout>
  );
};
