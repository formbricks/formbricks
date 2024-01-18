import PeopleSegmentsTabs from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/PeopleSegmentsTabs";
import { Metadata } from "next";

import { getUserTargetingPermission } from "@formbricks/ee/lib/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import ContentWrapper from "@formbricks/ui/ContentWrapper";

export const metadata: Metadata = {
  title: "People",
};

export default async function PeopleLayout({ params, children }) {
  const team = await getTeamByEnvironmentId(params.environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const isUserTargetingAllowed = getUserTargetingPermission(team);
  console.log("isUserTargetingAllowed", isUserTargetingAllowed);

  return (
    <>
      <PeopleSegmentsTabs
        activeId="segments"
        environmentId={params.environmentId}
        isUserTargetingAllowed={isUserTargetingAllowed}
      />
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
