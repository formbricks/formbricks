"use client";

import { useMemo } from "react";
import { entries } from "lodash";
import EmptySpaceFiller from "@formbricks/ui/EmptySpaceFiller";
import { ActivityItemContent, ActivityItemIcon, ActivityItemPopover } from "./ActivityItemComponents";
import { TActivityFeedItem, TActivityPopOverItem } from "@formbricks/types/v1/activity";
import { TEnvironment } from "@formbricks/types/v1/environment";

interface ActivityFeedProps {
  activities: TActivityFeedItem[];
  sortByDate: boolean;
  environment: TEnvironment;
}

export default function ActivityFeed({ activities, sortByDate, environment }: ActivityFeedProps) {
  const sortedActivities: TActivityFeedItem[] = activities.sort((a, b) =>
    sortByDate
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const getLabelByType = (activity: TActivityFeedItem) => {
    if (activity.type === "attribute") {
      return activity.attributeLabel;
    }
    if (activity.type === "display") {
      return activity.displaySurveyName;
    }
    if (activity.type === "event") {
      return activity.actionLabel;
    }
  };

  const getGroupKey = (activity: TActivityFeedItem, count: number) =>
    `${getLabelByType(activity) || ""}/grp${count}`;

  const EVENT_GROUP_COUNT = 3;

  const groupedActivities = useMemo(() => {
    const groupedActivities = new Map<string, TActivityPopOverItem>();
    let currGroupKey = "";
    let grpCount = 0;

    for (let i = 0; i < sortedActivities.length; i++) {
      const activity = sortedActivities[i];

      grpCount++;
      (currGroupKey = getGroupKey(activity, grpCount)),
        groupedActivities.set(currGroupKey, {
          count: 1,
          activityFeedItem: activity,
        });

      if (i + EVENT_GROUP_COUNT - 1 < sortedActivities.length) {
        let j = i;
        let hasSameEventCount = 1;

        const compareByType = (activity: TActivityFeedItem) => {
          if (activity.type === "attribute") {
            return (a: TActivityFeedItem, b: TActivityFeedItem) =>
              a.type === b.type && a.attributeLabel === b.attributeLabel;
          } else if (activity.type === "display") {
            return (a: TActivityFeedItem, b: TActivityFeedItem) =>
              a.type === b.type && a.displaySurveyName === b.displaySurveyName;
          } else if (activity.type === "event") {
            return (a: TActivityFeedItem, b: TActivityFeedItem) =>
              a.type === b.type && a.actionType === b.actionType && a.actionLabel === b.actionLabel;
          }
          return (a: TActivityFeedItem, b: TActivityFeedItem) => a.type === b.type;
        };

        const isMatch = compareByType(activity);

        while (j + 1 < sortedActivities.length && isMatch(sortedActivities[j], sortedActivities[j + 1])) {
          hasSameEventCount++;
          j++;
        }

        if (hasSameEventCount >= EVENT_GROUP_COUNT) {
          j = i + hasSameEventCount - 1;
          const getActivities = groupedActivities.get(currGroupKey)!;
          getActivities.count = hasSameEventCount;
          getActivities.activityFeedItem = sortedActivities[j];
          groupedActivities.set(currGroupKey, getActivities);
          i = j;
        }
      }
    }

    return groupedActivities;
  }, [sortedActivities]);

  const GroupedActivities = ({ activities }: { activities: Map<string, TActivityPopOverItem> }) => {
    return (
      <>
        {entries(activities).map(([groupLabel, group]: [string, TActivityPopOverItem]) => (
          <div>
            <li key={groupLabel} className="list-none">
              <div className="relative pb-12">
                <span className="absolute left-6 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                <div className="relative">
                  <ActivityItemPopover activityItem={group.activityFeedItem!}>
                    <div className="flex space-x-3 text-left">
                      <ActivityItemIcon count={group.count} activityItem={group.activityFeedItem!} />
                      <ActivityItemContent activityItem={group.activityFeedItem!} />
                    </div>
                  </ActivityItemPopover>
                </div>
              </div>
            </li>
          </div>
        ))}
      </>
    );
  };

  return (
    <>
      {sortedActivities.length === 0 ? (
        <EmptySpaceFiller type={"event"} environment={environment} />
      ) : (
        <GroupedActivities activities={groupedActivities} />
      )}
    </>
  );
}
