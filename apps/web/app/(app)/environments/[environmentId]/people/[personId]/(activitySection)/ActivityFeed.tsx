import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { ActivityItemContent, ActivityItemIcon, ActivityItemPopover } from "./ActivityItemComponents";
import { TActivityFeedItem } from "@formbricks/types/v1/activity";

interface ActivityFeedProps {
  activities: TActivityFeedItem[];
  sortByDate: boolean;
  environmentId: string;
}

export type ActivityFeedItem = {
  id: string;
  type: "event" | "attribute" | "display";
  createdAt: Date;
  updatedAt: Date | null;
  attributeLabel: string | null;
  attributeValue: string | null;
  actionLabel: string | null;
  actionDescription: string | null;
  actionType: string | null;
  displaySurveyName: string | null;
};

export default function ActivityFeed({ activities, sortByDate, environmentId }: ActivityFeedProps) {
  const sortedActivities: ActivityFeedItem[] = activities.sort((a, b) =>
    sortByDate
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return (
    <>
      {sortedActivities.length === 0 ? (
        <EmptySpaceFiller type={"event"} environmentId={environmentId} />
      ) : (
        <div>
          {sortedActivities.map((activityItem) => (
            <li key={activityItem.id} className="list-none">
              <div className="relative pb-12">
                <span className="absolute left-6 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                <div className="relative">
                  <ActivityItemPopover activityItem={activityItem}>
                    <div className="flex space-x-3 text-left">
                      <ActivityItemIcon activityItem={activityItem} />
                      <ActivityItemContent activityItem={activityItem} />
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
