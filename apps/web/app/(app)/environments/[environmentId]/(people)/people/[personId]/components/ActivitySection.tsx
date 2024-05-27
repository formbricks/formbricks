import { ActivityTimeline } from "@/app/(app)/environments/[environmentId]/(people)/people/[personId]/components/ActivityTimeline";

import { getAdvancedTargetingPermission } from "@formbricks/ee/lib/service";
import { getActionsByPersonId } from "@formbricks/lib/action/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

export const ActivitySection = async ({
  environmentId,
  personId,
}: {
  environmentId: string;
  personId: string;
}) => {
  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  // On Formbricks Cloud only render the timeline if the user targeting feature is booked
  const isUserTargetingEnabled = IS_FORMBRICKS_CLOUD
    ? await getAdvancedTargetingPermission(organization)
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
