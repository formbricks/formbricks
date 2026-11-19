export type TNotificationSwitchType = "alert" | "unsubscribedOrganizationIds";

/**
 * The DOM id of one switch on Account → Notifications. The page renders a switch per survey alert and
 * per organization, so the id carries both the setting type and the survey or organization id.
 */
export const getNotificationSwitchId = (
  notificationType: TNotificationSwitchType,
  surveyOrWorkspaceOrOrganizationId: string
): string => `notification-switch-${notificationType}-${surveyOrWorkspaceOrOrganizationId}`;
