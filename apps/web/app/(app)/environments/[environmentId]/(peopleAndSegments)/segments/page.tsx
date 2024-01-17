import CreateSegmentModal from "@formbricks/ee/advancedUserTargeting/components/CreateSegmentModal";
import SegmentTable from "@formbricks/ee/advancedUserTargeting/components/SegmentTable";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getUserSegments } from "@formbricks/lib/userSegment/service";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";

export const revalidate = REVALIDATION_INTERVAL;

export default async function SegmentsPage({ params }) {
  const [environment, userSegments, attributeClasses, actionClasses] = await Promise.all([
    getEnvironment(params.environmentId),
    getUserSegments(params.environmentId),
    getAttributeClasses(params.environmentId),
    getActionClasses(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!userSegments) {
    throw new Error("Failed to fetch segments");
  }

  const segments = userSegments.filter((segment) => !segment.isPrivate);

  return (
    <>
      <CreateSegmentModal
        environmentId={params.environmentId}
        actionClasses={actionClasses}
        attributeClasses={attributeClasses}
        userSegments={userSegments}
      />
      {segments.length === 0 ? (
        <EmptySpaceFiller
          type="table"
          environment={environment}
          emptyMessage="Your segments will appear here as soon as you add them ⏲️"
        />
      ) : (
        <SegmentTable
          userSegments={segments}
          actionClasses={actionClasses}
          attributeClasses={attributeClasses}
        />
      )}
    </>
  );
}
