export const revalidate = REVALIDATION_INTERVAL;

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getAllUserSegments } from "@formbricks/lib/services/userSegment";
import CreateSegmentModal from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/CreateSegmentModal";
import SegmentTable from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/SegmentTable";

export default async function SegmentsPage({ params }) {
  const fetchedSegments = await getAllUserSegments(params.environmentId);

  if (!fetchedSegments) {
    throw new Error("Failed to fetch segments");
  }

  const segments = fetchedSegments.filter((segment) => !segment.isPrivate);

  return (
    <>
      <CreateSegmentModal environmentId={params.environmentId} />
      {segments.length === 0 ? (
        <EmptySpaceFiller
          type="table"
          environmentId={params.environmentId}
          emptyMessage="Your segments will appear here as soon as you add them ⏲️"
        />
      ) : (
        <SegmentTable segments={segments} />
      )}
    </>
  );
}
