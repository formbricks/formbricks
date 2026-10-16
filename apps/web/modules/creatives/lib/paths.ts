export const getCreativesPath = (workspaceId: string) => `/workspaces/${workspaceId}/creatives`;

export const getCreativeSummaryPath = (workspaceId: string, creativeId: string) =>
  `${getCreativesPath(workspaceId)}/${creativeId}/summary`;

export const getCreativeEditPath = (workspaceId: string, creativeId: string) =>
  `${getCreativesPath(workspaceId)}/${creativeId}/edit`;

export const getCreativesKitPath = (workspaceId: string) => `${getCreativesPath(workspaceId)}/kit`;
