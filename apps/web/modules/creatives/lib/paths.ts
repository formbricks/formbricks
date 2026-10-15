import type { TCreativeType } from "../types";

export const getCreativesPath = (workspaceId: string) => `/workspaces/${workspaceId}/creatives`;

export const getCreativeSummaryPath = (workspaceId: string, creativeId: string) =>
  `${getCreativesPath(workspaceId)}/${creativeId}/summary`;

export const getCreativeEditPath = (workspaceId: string, creativeId: string) =>
  `${getCreativesPath(workspaceId)}/${creativeId}/edit`;

export const getNewCreativePath = (workspaceId: string, type: TCreativeType) =>
  `${getCreativeEditPath(workspaceId, "new")}?type=${type}`;

export const getCreativesKitPath = (workspaceId: string) => `${getCreativesPath(workspaceId)}/kit`;
