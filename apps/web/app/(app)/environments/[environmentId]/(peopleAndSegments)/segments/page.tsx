import CreateSegmentModal from "@formbricks/ee/advancedUserTargeting/components/CreateSegmentModal";
import SegmentTable from "@formbricks/ee/advancedUserTargeting/components/SegmentTable";
import { ACTIONS_TO_EXCLUDE } from "@formbricks/ee/advancedUserTargeting/lib/constants";
import { getUserTargetingPermission } from "@formbricks/ee/lib/service";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getUserSegments } from "@formbricks/lib/userSegment/service";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";

export const revalidate = REVALIDATION_INTERVAL;

export default async function SegmentsPage({ params }) {
  const [environment, userSegments, attributeClasses, actionClassesFromServer, team] = await Promise.all([
    getEnvironment(params.environmentId),
    getUserSegments(params.environmentId),
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

  const isUserTargetingAllowed = getUserTargetingPermission(team);

  if (!isUserTargetingAllowed) {
    throw new Error("User targeting not allowed");
  }

  if (!userSegments) {
    throw new Error("Failed to fetch segments");
  }

  const segments = userSegments.filter((segment) => !segment.isPrivate);

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
