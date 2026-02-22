import { getTranslate } from "@/lingodotdev/server";
import { ContactsPageLayout } from "@/modules/ee/contacts/components/contacts-page-layout";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { SegmentTable } from "@/modules/ee/contacts/segments/components/segment-table";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { CreateSegmentModal } from "./components/create-segment-modal";

export const SegmentsPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await paramsProps;
  const t = await getTranslate();

  const { isReadOnly } = await getEnvironmentAuth(params.environmentId);

  const [segments, contactAttributeKeys] = await Promise.all([
    getSegments(params.environmentId),
    getContactAttributeKeys(params.environmentId),
  ]);

  const isContactsEnabled = await getIsContactsEnabled();

  if (!segments) {
    throw new Error("Failed to fetch segments");
  }

  const filteredSegments = segments.filter((segment) => !segment.isPrivate);

  return (
    <ContactsPageLayout
      pageTitle={t("common.contacts")}
      activeId="segments"
      environmentId={params.environmentId}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
      cta={
        <CreateSegmentModal
          environmentId={params.environmentId}
          contactAttributeKeys={contactAttributeKeys}
          segments={filteredSegments}
        />
      }
      upgradePromptTitle={t("environments.segments.unlock_segments_title")}
      upgradePromptDescription={t("environments.segments.unlock_segments_description")}>
      <SegmentTable
        segments={filteredSegments}
        contactAttributeKeys={contactAttributeKeys}
        isContactsEnabled={isContactsEnabled}
        isReadOnly={isReadOnly}
      />
    </ContactsPageLayout>
  );
};
