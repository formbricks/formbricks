import { authOptions } from "@/modules/auth/lib/authOptions";
import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { SegmentTable } from "@/modules/ee/contacts/segments/components/segment-table";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { CreateSegmentModal } from "./components/create-segment-modal";

export const SegmentsPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await paramsProps;
  const t = await getTranslate();
  const [session, environment, product, segments, contactAttributeKeys, organization] = await Promise.all([
    getServerSession(authOptions),
    getEnvironment(params.environmentId),
    getProjectByEnvironmentId(params.environmentId),
    getSegments(params.environmentId),
    getContactAttributeKeys(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!session) {
    throw new Error("Session not found");
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session?.user.id,
    product.organizationId
  );
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProjectPermissionByUserId(session.user.id, product.id);
  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

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
