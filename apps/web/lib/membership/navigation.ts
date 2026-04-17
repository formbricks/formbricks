export const getBillingFallbackPath = (environmentId: string, isFormbricksCloud: boolean): string => {
  const settingsPath = isFormbricksCloud ? "billing" : "enterprise";
  return `/environments/${environmentId}/settings/${settingsPath}`;
};
