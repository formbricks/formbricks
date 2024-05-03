import PeopleSegmentsTabs from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsTabs";
import { Metadata } from "next";

import { getAdvancedTargetingPermission } from "@formbricks/ee/lib/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export const metadata: Metadata = {
  title: "Segments",
};

export default async function PeopleLayout({ params, children }) {
  const team = await getTeamByEnvironmentId(params.environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isUserTargetingAllowed = getAdvancedTargetingPermission(team);

  return (
    <InnerContentWrapper pageTitle="Segments">
      <PeopleSegmentsTabs
        activeId="segments"
        environmentId={params.environmentId}
        isUserTargetingAllowed={isUserTargetingAllowed}
      />
      {children}
    </InnerContentWrapper>
  );
}
