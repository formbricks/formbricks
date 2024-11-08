import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { BasicCreateSegmentModal } from "@/app/(app)/environments/[environmentId]/(people)/segments/components/BasicCreateSegmentModal";
import { SegmentTable } from "@/app/(app)/environments/[environmentId]/(people)/segments/components/SegmentTable";
import { CreateSegmentModal } from "@/modules/ee/advanced-targeting/components/create-segment-modal";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getAdvancedTargetingPermission } from "@formbricks/ee/lib/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSegments } from "@formbricks/lib/segment/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
  const t = await getTranslations();
  const [environment, segments, attributeClasses, organization, product] = await Promise.all([
    getEnvironment(params.environmentId),
    getSegments(params.environmentId),
    getAttributeClasses(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const isAdvancedTargetingAllowed = await getAdvancedTargetingPermission(organization);

  if (!segments) {
    throw new Error(t("environments.segments.failed_to_fetch_segments"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session?.user.id, product.id);

  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

  const filteredSegments = segments.filter((segment) => !segment.isPrivate);

  const renderCreateSegmentButton = () =>
    isAdvancedTargetingAllowed ? (
      <CreateSegmentModal
        environmentId={params.environmentId}
        attributeClasses={attributeClasses}
        segments={filteredSegments}
      />
    ) : (
      <BasicCreateSegmentModal
        attributeClasses={attributeClasses}
        environmentId={params.environmentId}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      />
    );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.people")} cta={!isReadOnly ? renderCreateSegmentButton() : undefined}>
        <PersonSecondaryNavigation activeId="segments" environmentId={params.environmentId} />
      </PageHeader>
      <SegmentTable
        segments={filteredSegments}
        attributeClasses={attributeClasses}
        isAdvancedTargetingAllowed={isAdvancedTargetingAllowed}
        isReadOnly={isReadOnly}
      />
    </PageContentWrapper>
  );
};

export default Page;
