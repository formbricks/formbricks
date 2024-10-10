import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { BasicCreateSegmentModal } from "@/app/(app)/environments/[environmentId]/(people)/segments/components/BasicCreateSegmentModal";
import { SegmentTable } from "@/app/(app)/environments/[environmentId]/(people)/segments/components/SegmentTable";
import { CreateSegmentModal } from "@formbricks/ee/advanced-targeting/components/create-segment-modal";
import { getAdvancedTargetingPermission } from "@formbricks/ee/lib/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getSegments } from "@formbricks/lib/segment/service";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async ({ params }) => {
  const [environment, segments, attributeClasses, organization] = await Promise.all([
    getEnvironment(params.environmentId),
    getSegments(params.environmentId),
    getAttributeClasses(params.environmentId),
    getOrganizationByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isAdvancedTargetingAllowed = await getAdvancedTargetingPermission(organization);

  if (!segments) {
    throw new Error("Failed to fetch segments");
  }

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
      <PageHeader pageTitle="People" cta={renderCreateSegmentButton()}>
        <PersonSecondaryNavigation activeId="segments" environmentId={params.environmentId} />
      </PageHeader>
      <SegmentTable
        segments={filteredSegments}
        attributeClasses={attributeClasses}
        isAdvancedTargetingAllowed={isAdvancedTargetingAllowed}
      />
    </PageContentWrapper>
  );
};

export default Page;
