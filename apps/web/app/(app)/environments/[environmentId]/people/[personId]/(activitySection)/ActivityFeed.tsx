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

  const groupedActivities: {
    [key: string]: {
      count: number;
      activityFeedItem: TActivityFeedItem | null;
      displaySurveyNames: string[];
    };
  } = sortedActivities.reduce((acc, activity, index) => {
    const actionLabel = activity.actionLabel!;
    const type = activity.type;

    const key = actionLabel !== null ? actionLabel : type;

    if (!acc[key]) {
      acc[key] = { count: 0, activityFeedItem: null, displaySurveyNames: [] };
    }
    if (
      index > 0 &&
      key ===
        (actionLabel !== null ? sortedActivities[index - 1].actionLabel : sortedActivities[index - 1].type)
    ) {
      acc[key].count++;
      if (!acc[key].activityFeedItem) {
        acc[key].activityFeedItem = activity;
      }

      if (type === "display" && activity.displaySurveyName) {
        acc[key].displaySurveyNames.push(activity.displaySurveyName);
      }
    } else {
      acc[key].count = 1;
      acc[key].activityFeedItem = activity;

      if (type === "display" && activity.displaySurveyName) {
        acc[key].displaySurveyNames = [activity.displaySurveyName];
      } else {
        acc[key].displaySurveyNames = [];
      }
    }

    return acc;
  }, {});
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
                  <ActivityItemPopover activityPopOverItem={group}>
                    <div className="flex space-x-3 text-left">
                      <ActivityItemIcon count={group.count} activityItem={group.activityFeedItem!} />
                      <ActivityItemContent activityItem={group.activityFeedItem!} />
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
