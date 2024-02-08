import BasicCreateSegmentModal from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/components/BasicCreateSegmentModal";
import SegmentTable from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/components/SegmentTable";

import CreateSegmentModal from "@formbricks/ee/advancedUserTargeting/components/CreateSegmentModal";
import { ACTIONS_TO_EXCLUDE } from "@formbricks/ee/advancedUserTargeting/lib/constants";
import { getAdvancedUserTargetingPermission } from "@formbricks/ee/lib/service";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getSegments } from "@formbricks/lib/segment/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";

export const revalidate = REVALIDATION_INTERVAL;

export default async function SegmentsPage({ params }) {
  const [environment, segments, attributeClasses, actionClassesFromServer, team] = await Promise.all([
    getEnvironment(params.environmentId),
    getSegments(params.environmentId),
    getAttributeClasses(params.environmentId),
    getActionClasses(params.environmentId),
    getTeamByEnvironmentId(params.environmentId),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  if (!team) {
    throw new Error("Team not found");
  }

  const isAdvancedUserTargetingAllowed = getAdvancedUserTargetingPermission(team);

  if (!segments) {
    throw new Error("Failed to fetch segments");
  }

  const filteredSegments = segments.filter((segment) => !segment.isPrivate);

  const actionClasses = actionClassesFromServer.filter((actionClass) => {
    if (actionClass.type === "automatic") {
      if (ACTIONS_TO_EXCLUDE.includes(actionClass.name)) {
        return false;
      }

      return true;
    }

    return true;
  });

  return (
    <>
      {isAdvancedUserTargetingAllowed ? (
        <CreateSegmentModal
          environmentId={params.environmentId}
          actionClasses={actionClasses}
          attributeClasses={attributeClasses}
          segments={filteredSegments}
        />
      ) : (
        <BasicCreateSegmentModal attributeClasses={attributeClasses} environmentId={params.environmentId} />
      )}

      {filteredSegments.length === 0 ? (
        <EmptySpaceFiller
          type="table"
          environment={environment}
          emptyMessage="No segments yet. Add your first one to get started."
        />
      ) : (
        <SegmentTable
          segments={filteredSegments}
          actionClasses={actionClasses}
          attributeClasses={attributeClasses}
          isAdvancedUserTargetingAllowed={isAdvancedUserTargetingAllowed}
        />
      )}
    </>
  );
}
