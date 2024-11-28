import { authOptions } from "@/modules/auth/lib/authOptions";
import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contacts";
import { SegmentTable } from "@/modules/ee/contacts/segments/components/segment-table";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { UsersIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { CreateSegmentModal } from "./components/create-segment-modal";

export const SegmentsPage = async ({
  params: paramsProps,
}: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await paramsProps;
  const t = await getTranslations();
  const [session, environment, product, segments, contactAttributeKeys, organization] = await Promise.all([
    getServerSession(authOptions),
    getEnvironment(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
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

  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);
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
            icon={<UsersIcon className="h-6 w-6 text-slate-900" />}
            title={t("environments.segments.unlock_segments_title")}
            description={t("environments.segments.unlock_segments_description")}
            buttons={[
              {
                text: t("common.start_free_trial"),
                href: `https://formbricks.com/docs/self-hosting/license#30-day-trial-license-request`,
              },
              {
                text: t("common.learn_more"),
                href: "https://formbricks.com/docs/self-hosting/license#30-day-trial-license-request",
              },
            ]}
          />
        </div>
      )}
    </PageContentWrapper>
  );
};
