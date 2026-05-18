export const getBillingFallbackPath = (workspaceId: string, isFormbricksCloud: boolean): string => {
  const settingsPath = isFormbricksCloud ? "billing" : "enterprise";
  return `/workspaces/${workspaceId}/settings/organization/${settingsPath}`;
};
