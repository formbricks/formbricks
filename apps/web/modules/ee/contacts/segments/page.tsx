import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { CreateSegmentModal } from "@/modules/ee/contacts/segments/components/create-segment-modal";
import { SegmentsDataTable } from "@/modules/ee/contacts/segments/components/segments-data-table";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

export const SegmentsPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await paramsProps;
  const { isReadOnly } = await getEnvironmentAuth(params.environmentId);
  const t = await getTranslate();
  const isContactsEnabled = await getIsContactsEnabled();
  const contactAttributeKeys = await getContactAttributeKeys(params.environmentId);
  const segments = await getSegments(params.environmentId);

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle="Contacts"
        cta={
          isContactsEnabled && !isReadOnly ? (
            <CreateSegmentModal
              environmentId={params.environmentId}
              contactAttributeKeys={contactAttributeKeys}
              segments={segments}
            />
          ) : undefined
        }>
        <ContactsSecondaryNavigation activeId="segments" environmentId={params.environmentId} />
      </PageHeader>

      {isContactsEnabled ? (
        <SegmentsDataTable
          segments={segments}
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
