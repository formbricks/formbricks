import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { AttributesTable } from "./components/attributes-table";
import { CreateAttributeModal } from "./components/create-attribute-modal";

export const AttributesPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ workspaceId: string }>;
}) => {
  const params = await paramsProps;
  const locale = await getLocale();
  const t = await getTranslate();
  const { isReadOnly, organization, workspace } = await getWorkspaceAuth(params.workspaceId);

  const contactAttributeKeys = await getContactAttributeKeys(workspace.id);

  const isContactsEnabled = await getIsContactsEnabled(organization.id);

  return (
    <ContactsPageLayout
      pageTitle={t("common.contacts")}
      activeId="attributes"
      workspaceId={params.workspaceId}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      cta={<CreateAttributeModal workspaceId={workspace.id} />}>
      <AttributesTable
        contactAttributeKeys={contactAttributeKeys}
        isReadOnly={isReadOnly}
        workspaceId={params.workspaceId}
        locale={locale}
      />
    </ContactsPageLayout>
  );
};
