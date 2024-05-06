import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";
import BasicCreateSegmentModal from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/components/BasicCreateSegmentModal";
import { Metadata } from "next";

import CreateSegmentModal from "@formbricks/ee/advancedTargeting/components/CreateSegmentModal";
import { ACTIONS_TO_EXCLUDE } from "@formbricks/ee/advancedTargeting/lib/constants";
import { getAdvancedTargetingPermission } from "@formbricks/ee/lib/service";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getSegments } from "@formbricks/lib/segment/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export const metadata: Metadata = {
  title: "Segments",
};

export default async function SegmentsLayout({ params, children }) {
  const [environment, segments, attributeClasses, actionClassesFromServer, team] = await Promise.all([
    getEnvironment(params.environmentId),
    getSegments(params.environmentId),
    getAttributeClasses(params.environmentId),
    getActionClasses(params.environmentId),
    getTeamByEnvironmentId(params.environmentId),
  ]);

  if (!team) {
    throw new Error("Team not found");
  }

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

  const isAdvancedTargetingAllowed = getAdvancedTargetingPermission(team);

  const renderCreateSegmentButton = () =>
    isAdvancedTargetingAllowed ? (
      <CreateSegmentModal
        environmentId={params.environmentId}
        actionClasses={actionClasses}
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
    <div className="flex">
      <PeopleSegmentsNav
        activeId="segments"
        environmentId={params.environmentId}
        isUserTargetingAllowed={isAdvancedTargetingAllowed}
      />
      <InnerContentWrapper pageTitle="Segments" cta={renderCreateSegmentButton()}>
        {children}
      </InnerContentWrapper>
    </div>
  );
}
