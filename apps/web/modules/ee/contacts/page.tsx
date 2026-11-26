import { ITEMS_PER_PAGE } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import {
  getContactDirectoryUploadDestination,
  getSharedContactDirectoryName,
} from "@/modules/ee/contacts/directories/lib/directory-service";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getWorkspaceContactDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import { getIsContactsEnabled, getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { ContactDataView } from "./components/contact-data-view";

export const ContactsPage = async ({
  params: paramsProps,
}: {
  readonly params: Promise<{ workspaceId: string }>;
}) => {
  const params = await paramsProps;

  const { isReadOnly, isOwner, isManager, organization, workspace } = await getWorkspaceAuth(
    params.workspaceId
  );

  const t = await getTranslate();

  const isContactsEnabled = await getIsContactsEnabled(organization.id);

  const isQuotasAllowed = await getIsQuotasEnabled(organization.id);

  const contactDirectory = await getWorkspaceContactDirectory(workspace.id);
  const hasContactDirectory = Boolean(contactDirectory);

  const [contactAttributeKeys, sharedDirectoryName, uploadDestination] =
    isContactsEnabled && hasContactDirectory
      ? await Promise.all([
          getContactAttributeKeys(workspace.id),
          getSharedContactDirectoryName(workspace.id),
          getContactDirectoryUploadDestination(workspace.id),
        ])
      : [[], null, null];

  // Spec decision 13: Upload CSV stays in the header, disabled, until the workspace has a directory.
  const AddContactsButton = (
    <UploadContactsCSVButton
      workspaceId={workspace.id}
      contactAttributeKeys={contactAttributeKeys}
      matchingKey={contactDirectory?.matchingKey ?? "email"}
      destination={uploadDestination}
      disabled={!hasContactDirectory}
    />
  );

  return (
    <ContactsPageLayout
      pageTitle={t("common.contacts")}
      activeId="contacts"
      workspaceId={params.workspaceId}
      organizationId={organization.id}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      hasContactDirectory={hasContactDirectory}
      isOwnerOrManager={isOwner || isManager}
      sharedDirectoryName={sharedDirectoryName}
      cta={AddContactsButton}>
      <ContactDataView
        workspaceId={workspace.id}
        itemsPerPage={ITEMS_PER_PAGE}
        contactAttributeKeys={contactAttributeKeys}
        isReadOnly={isReadOnly}
        isQuotasAllowed={isQuotasAllowed}
        sharedDirectoryName={sharedDirectoryName}
      />
    </ContactsPageLayout>
  );
};
