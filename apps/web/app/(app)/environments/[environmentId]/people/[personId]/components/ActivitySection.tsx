import ActivityTimeline from "@/app/(app)/environments/[environmentId]/people/[personId]/components/ActivityTimeline";
import { getActionsByPersonId } from "@formbricks/lib/action/service";
import { getEnvironment } from "@formbricks/lib/environment/service";

export default async function ActivitySection({
  environmentId,
  personId,
}: {
  environmentId: string;
  personId: string;
}) {
  const [environment, actions] = await Promise.all([
    getEnvironment(environmentId),
    getActionsByPersonId(personId, 1),
  ]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  return (
    <div className="md:col-span-1">
      <ActivityTimeline environment={environment} actions={actions.slice(0, 10)} />
    </div>
  );
}
