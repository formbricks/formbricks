import { ContactsSecondaryNavigation } from "@/modules/ee/contacts/components/contacts-secondary-navigation";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contacts";
import { SegmentTable } from "@/modules/ee/contacts/segments/components/segment-table";
import { getSegments } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-actions";
import { UserIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
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
            icon={<UserIcon className="h-6 w-6 text-slate-900" />}
            title="Unlock segments with a higher plan"
            description="Organize contacts into segments to target specific user groups"
            buttons={[
              {
                text: "Upgrade",
                href: `/environments/${params.environmentId}/settings/billing`,
              },
              {
                text: "Learn more",
                href: "https://formbricks.com/pricing",
              },
            ]}
          />
        </div>
      )}
    </PageContentWrapper>
  );
};
