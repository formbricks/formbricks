import type { TIntegrationType } from "@formbricks/types/integration";

/** Typed query-key factory for the integration settings pages. Never inline string keys. */
export const integrationKeys = {
  all: ["integrations"] as const,
  byType: (workspaceId: string, type: TIntegrationType) =>
    [...integrationKeys.all, workspaceId, type] as const,
};
