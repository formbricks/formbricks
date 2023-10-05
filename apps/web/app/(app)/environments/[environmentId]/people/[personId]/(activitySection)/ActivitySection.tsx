import ActivityTimeline from "@/app/(app)/environments/[environmentId]/people/[personId]/(activitySection)/ActivityTimeline";
import { getActivityTimeline } from "@formbricks/lib/activity/service";
import { getEnvironment } from "@formbricks/lib/environment/service";

export default async function ActivitySection({
  environmentId,
  personId,
}: {
  environmentId: string;
  personId: string;
}) {
  const [activities, environment] = await Promise.all([
    getActivityTimeline(personId),
    getEnvironment(environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }

  return (
    <div className="md:col-span-1">
      <ActivityTimeline environment={environment} activities={activities} />
    </div>
  );
}
