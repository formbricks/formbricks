import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { SegmentTable } from "@/modules/ee/contacts/segments/components/segment-table";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getTranslate } from "@/tolgee/server";
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
    <PageContentWrapper>
      <PageHeader
        pageTitle="Contacts"
        cta={
          isContactsEnabled && !isReadOnly ? (
            <CreateSegmentModal
              environmentId={params.environmentId}
              contactAttributeKeys={contactAttributeKeys}
              segments={filteredSegments}
            />
          ) : undefined
        }>
        <ContactsSecondaryNavigation activeId="segments" environmentId={params.environmentId} />
      </PageHeader>

      {isContactsEnabled ? (
        <SegmentTable
          segments={filteredSegments}
          contactAttributeKeys={contactAttributeKeys}
          isContactsEnabled={isContactsEnabled}
          isReadOnly={isReadOnly}
        />
      ) : (
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("environments.segments.unlock_segments_title")}
            description={t("environments.segments.unlock_segments_description")}
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
