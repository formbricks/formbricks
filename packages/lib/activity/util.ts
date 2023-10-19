import { TActivityFeedItem } from "@formbricks/types/v1/activity";

export const formatActivityFeedItemDateFields = (
  activityFeedItem: TActivityFeedItem[]
): TActivityFeedItem[] => {
  return activityFeedItem.map((item) => ({
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : item.updatedAt,
  }));
};
