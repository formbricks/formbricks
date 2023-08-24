import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { ActivityItemContent, ActivityItemIcon, ActivityItemPopover } from "./ActivityItemComponents";
import { TActivityFeedItem } from "@formbricks/types/v1/activity";

interface ActivityFeedProps {
  activities: TActivityFeedItem[];
  sortByDate: boolean;
  environmentId: string;
}

export default function ActivityFeed({ activities, sortByDate, environmentId }: ActivityFeedProps) {
  const sortedActivities: TActivityFeedItem[] = activities.sort((a, b) =>
    sortByDate
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const groupedActivities: { [key: string]: { count: number; latestActivity: TActivityFeedItem | null } } =
    sortedActivities.reduce((acc, activity) => {
      const actionLabel = activity.actionLabel!;
      if (!acc[actionLabel]) {
        acc[actionLabel] = { count: 0, latestActivity: null };
      }
      acc[actionLabel].count++;
      if (!acc[actionLabel].latestActivity) {
        acc[actionLabel].latestActivity = activity;
      }
      return acc;
    }, {});

  console.log(groupedActivities);
  return (
    <>
      {sortedActivities.length === 0 ? (
        <EmptySpaceFiller type={"event"} environmentId={environmentId} />
      ) : (
        <div>
          {Object.entries(groupedActivities).map(([actionLabel, group]) => (
            <li key={actionLabel} className="list-none">
              <div className="relative pb-12">
                <span className="absolute left-6 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                <div className="relative">
                  <ActivityItemPopover activityItem={group.latestActivity!}>
                    <div className="flex space-x-3 text-left">
                      <ActivityItemIcon count={group.count} activityItem={group.latestActivity!} />
                      <ActivityItemContent activityItem={group.latestActivity!} />
                    </div>
                  </ActivityItemPopover>
                </div>
              </div>
            </li>
          ))}
        </div>
      )}
    </>
  );
}
