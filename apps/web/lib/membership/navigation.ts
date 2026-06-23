export const getBillingFallbackPath = (organizationId: string, isFormbricksCloud: boolean): string => {
  const settingsPath = isFormbricksCloud ? "billing" : "enterprise";
  return `/organizations/${organizationId}/settings/${settingsPath}`;
};
