import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";
import { Metadata } from "next";

import { getAdvancedTargetingPermission } from "@formbricks/ee/lib/service";
import { getSegments } from "@formbricks/lib/segment/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

export const metadata: Metadata = {
  title: "Segments",
};

export default async function SegmentsLayout({ params, children }) {
  const [segments, team] = await Promise.all([
    getSegments(params.environmentId),
    getTeamByEnvironmentId(params.environmentId),
  ]);

  if (!team) {
    throw new Error("Team not found");
  }

  if (!segments) {
    throw new Error("Failed to fetch segments");
  }

  const isAdvancedTargetingAllowed = await getAdvancedTargetingPermission(team);

  return (
    <>
      <PeopleSegmentsNav
        activeId="segments"
        environmentId={params.environmentId}
        isUserTargetingAllowed={isAdvancedTargetingAllowed}
      />
      {children}
    </>
  );
}
