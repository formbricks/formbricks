import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
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

  const isContactsEnabled = await getIsContactsEnabled(organization.id);

  return (
    <ContactsPageLayout
      pageTitle={t("common.contacts")}
      activeId="attributes"
      workspaceId={params.workspaceId}
      organizationId={organization.id}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      cta={<CreateAttributeModal workspaceId={workspace.id} />}>
      <AttributesTable isReadOnly={isReadOnly} workspaceId={params.workspaceId} locale={locale} />
    </ContactsPageLayout>
  );
};
