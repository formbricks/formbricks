import { queryOptions } from "@tanstack/react-query";
import { getNotificationSettings } from "./api-client";

export const notificationSettingsKeys = {
  all: ["notification-settings"] as const,
  mine: () => [...notificationSettingsKeys.all, "me"] as const,
};

/** The signed-in user's switches. The page fills this on the server (`getNotificationSettingsView`). */
export const notificationSettingsQueryOptions = () =>
  queryOptions({
    queryKey: notificationSettingsKeys.mine(),
    queryFn: ({ signal }) => getNotificationSettings({ signal }),
  });
