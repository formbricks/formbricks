import { ActivityTimeline } from "@/app/(app)/environments/[environmentId]/(people)/people/[personId]/components/ActivityTimeline";

import { getActionsByPersonId } from "@formbricks/lib/action/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

export const ActivitySection = async ({
  environmentId,
  personId,
}: {
  environmentId: string;
  personId: string;
}) => {
  const team = await getTeamByEnvironmentId(environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  // On Formbricks Cloud only render the timeline if the user targeting feature is booked
  const isUserTargetingEnabled = IS_FORMBRICKS_CLOUD
    ? team.billing.features.userTargeting.status === "active"
    : true;

  const [environment, actions] = await Promise.all([
    getEnvironment(environmentId),
    isUserTargetingEnabled ? getActionsByPersonId(personId, 1) : [],
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  return (
    <div className="md:col-span-1">
      <ActivityTimeline
        environment={environment}
        actions={actions.slice(0, 10)}
        isUserTargetingEnabled={isUserTargetingEnabled}
      />
    </div>
  );
};
