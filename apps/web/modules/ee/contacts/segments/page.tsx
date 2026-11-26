import { getUserVisibleSurveyWhere } from "@/lib/survey/visibility/actor-context";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { getSharedContactDirectoryName } from "@/modules/ee/contacts/directories/lib/directory-service";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getWorkspaceContactDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import { SegmentTable } from "@/modules/ee/contacts/segments/components/segment-table";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { CreateSegmentModal } from "./components/create-segment-modal";

export const SegmentsPage = async ({
  params: paramsProps,
}: {
  readonly params: Promise<{ workspaceId: string }>;
}) => {
  const params = await paramsProps;
  const t = await getTranslate();

  const { isReadOnly, isOwner, isManager, organization, session, workspace } = await getWorkspaceAuth(
    params.workspaceId
  );

  const hasContactDirectory = Boolean(await getWorkspaceContactDirectory(workspace.id));

  const [segments, contactAttributeKeys, sharedDirectoryName] = hasContactDirectory
    ? await Promise.all([
        getUserVisibleSurveyWhere(session.user.id, organization.id).then((where) =>
          getSegments(workspace.id, where)
        ),
        getContactAttributeKeys(workspace.id),
        getSharedContactDirectoryName(workspace.id),
      ])
    : [[], [], null];

  const isContactsEnabled = await getIsContactsEnabled(organization.id);

  if (!segments) {
    throw new Error("Failed to fetch segments");
  }

  const filteredSegments = segments.filter((segment) => !segment.isPrivate);

  return (
    <ContactsPageLayout
      pageTitle={t("common.contacts")}
      activeId="segments"
      workspaceId={params.workspaceId}
      organizationId={organization.id}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      hasContactDirectory={hasContactDirectory}
      isOwnerOrManager={isOwner || isManager}
      sharedDirectoryName={sharedDirectoryName}
      cta={
        hasContactDirectory ? (
          <CreateSegmentModal
            contactAttributeKeys={contactAttributeKeys}
            segments={filteredSegments}
            workspaceId={workspace.id}
          />
        ) : undefined
      }
      upgradePromptTitle={t("workspace.segments.unlock_segments_title")}
      upgradePromptDescription={t("workspace.segments.unlock_segments_description")}
      upgradeFeature="segments">
      <SegmentTable
        allSegments={segments}
        segments={filteredSegments}
        contactAttributeKeys={contactAttributeKeys}
        isContactsEnabled={isContactsEnabled}
        isReadOnly={isReadOnly}
        workspaceId={workspace.id}
      />
    </ContactsPageLayout>
  );
};
