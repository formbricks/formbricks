import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { SegmentTable } from "@/modules/ee/contacts/segments/components/segment-table";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { CreateSegmentModal } from "./components/create-segment-modal";

export const SegmentsPage = async ({ params: paramsProps }: { params: Promise<{ workspaceId: string }> }) => {
  const params = await paramsProps;
  const t = await getTranslate();

  const { isReadOnly, organization, workspace } = await getWorkspaceAuth(params.workspaceId);

  const [segments, contactAttributeKeys] = await Promise.all([
    getSegments(workspace.id),
    getContactAttributeKeys(workspace.id),
  ]);

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
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      cta={
        <CreateSegmentModal
          contactAttributeKeys={contactAttributeKeys}
          segments={filteredSegments}
          workspaceId={workspace.id}
        />
      }
      upgradePromptTitle={t("workspace.segments.unlock_segments_title")}
      upgradePromptDescription={t("workspace.segments.unlock_segments_description")}>
      <SegmentTable
        allSegments={segments}
        segments={filteredSegments}
        contactAttributeKeys={contactAttributeKeys}
        isContactsEnabled={isContactsEnabled}
        isReadOnly={isReadOnly}
      />
    </ContactsPageLayout>
  );
};
