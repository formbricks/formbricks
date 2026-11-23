import { BookUserIcon } from "lucide-react";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { UploadContactsCSVButton } from "@/modules/ee/contacts/components/upload-contacts-button";
import { getSharedContactDirectoryName } from "@/modules/ee/contacts/directories/lib/directory-service";
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

  const { isReadOnly, organization, workspace } = await getWorkspaceAuth(params.workspaceId);

  const t = await getTranslate();

  const isContactsEnabled = await getIsContactsEnabled(organization.id);

  const isQuotasAllowed = await getIsQuotasEnabled(organization.id);

  const [contactAttributeKeys, sharedDirectoryName, contactDirectory] = isContactsEnabled
    ? await Promise.all([
        getContactAttributeKeys(workspace.id),
        getSharedContactDirectoryName(workspace.id),
        getWorkspaceContactDirectory(workspace.id),
      ])
    : [[], null, null];

  const AddContactsButton = (
    <UploadContactsCSVButton
      workspaceId={workspace.id}
      contactAttributeKeys={contactAttributeKeys}
      matchingKey={contactDirectory?.matchingKey ?? "email"}
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
      cta={AddContactsButton}>
      {/* Spec decision 20: which directory this workspace uses, shown only when others share it. */}
      {sharedDirectoryName ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <BookUserIcon className="size-3.5" aria-hidden="true" />
          {t("workspace.contacts.directory_line", { directoryName: sharedDirectoryName })}
        </p>
      ) : null}
      <ContactDataView
        workspaceId={workspace.id}
        itemsPerPage={ITEMS_PER_PAGE}
        contactAttributeKeys={contactAttributeKeys}
        isReadOnly={isReadOnly}
        isQuotasAllowed={isQuotasAllowed}
      />
    </ContactsPageLayout>
  );
};
