import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { getSharedContactDirectoryName } from "@/modules/ee/contacts/directories/lib/directory-service";
import { getWorkspaceContactDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { AttributesTable } from "./components/attributes-table";
import { CreateAttributeModal } from "./components/create-attribute-modal";

export const AttributesPage = async ({
  params: paramsProps,
}: {
  readonly params: Promise<{ workspaceId: string }>;
}) => {
  const params = await paramsProps;
  const locale = await getLocale();
  const t = await getTranslate();
  const { isReadOnly, isOwner, isManager, organization, workspace } = await getWorkspaceAuth(
    params.workspaceId
  );

  const isContactsEnabled = await getIsContactsEnabled(organization.id);
  const hasContactDirectory = Boolean(await getWorkspaceContactDirectory(workspace.id));
  const sharedDirectoryName = hasContactDirectory ? await getSharedContactDirectoryName(workspace.id) : null;

  return (
    <ContactsPageLayout
      pageTitle={t("common.contacts")}
      activeId="attributes"
      workspaceId={params.workspaceId}
      organizationId={organization.id}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      hasContactDirectory={hasContactDirectory}
      isOwnerOrManager={isOwner || isManager}
      cta={hasContactDirectory ? <CreateAttributeModal workspaceId={workspace.id} /> : undefined}>
      <AttributesTable
        isReadOnly={isReadOnly}
        workspaceId={params.workspaceId}
        locale={locale}
        sharedDirectoryName={sharedDirectoryName}
      />
    </ContactsPageLayout>
  );
};
