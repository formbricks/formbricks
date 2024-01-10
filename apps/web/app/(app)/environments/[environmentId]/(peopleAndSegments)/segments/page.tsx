import CreateSegmentModal from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/CreateSegmentModal";
import SegmentTable from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/SegmentTable";

import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getUserSegments } from "@formbricks/lib/services/userSegment";

export const revalidate = REVALIDATION_INTERVAL;

export default async function SegmentsPage({ params }) {
  const [userSegments, attributeClasses, actionClasses] = await Promise.all([
    getUserSegments(params.environmentId),
    getAttributeClasses(params.environmentId),
    getActionClasses(params.environmentId),
  ]);

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
        // <EmptySpaceFiller
        //   type="table"
        //   environmentId={params.environmentId}
        //   emptyMessage="Your segments will appear here as soon as you add them ⏲️"
        // />
        <div>No Segments yet</div>
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
