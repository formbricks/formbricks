import ActivityTimeline from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/[personId]/(activitySection)/ActivityTimeline";
import { getActivityTimeline } from "@formbricks/lib/services/activity";

export default async function ActivitySection({
  environmentId,
  personId,
}: {
  environmentId: string;
  personId: string;
}) {
  const activities = await getActivityTimeline(personId);

  return (
    <div className="md:col-span-1">
      <ActivityTimeline environmentId={environmentId} activities={activities} />
    </div>
  );
}
