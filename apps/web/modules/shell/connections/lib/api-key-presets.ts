import type { TApiKeyCreateInput } from "@/modules/organization/settings/api-keys/types/api-keys";

/**
 * An API key holds one permission per workspace (read, write or manage); the MCP server derives its
 * scopes from that coarsely. The create form therefore offers three levels rather than a per-resource
 * grid, which the data model cannot store.
 */
export const API_KEY_PRESETS = ["read", "author", "full"] as const;
export type TApiKeyPreset = (typeof API_KEY_PRESETS)[number];

const PERMISSION_BY_PRESET = {
  read: "read",
  author: "write",
  full: "manage",
} as const satisfies Record<TApiKeyPreset, "read" | "write" | "manage">;

export interface TApiKeyFormValues {
  label: string;
  preset: TApiKeyPreset;
  workspaceIds: readonly string[];
  /** Organization-level read: the audit log, plus listing members and teams. */
  allowAuditRead: boolean;
}

/** A key must have a name and reach something: a workspace, or the organization-level audit read. */
export const canSubmitApiKey = ({ label, workspaceIds, allowAuditRead }: TApiKeyFormValues): boolean =>
  label.trim().length > 0 && (workspaceIds.length > 0 || allowAuditRead);

/**
 * The payload `createApiKeyAction` takes. Organization write access (managing members) is never
 * requested from this form, so it is always off.
 */
export const buildApiKeyCreateInput = ({
  label,
  preset,
  workspaceIds,
  allowAuditRead,
}: TApiKeyFormValues): TApiKeyCreateInput => ({
  label: label.trim(),
  workspacePermissions: [...new Set(workspaceIds)].map((workspaceId) => ({
    workspaceId,
    permission: PERMISSION_BY_PRESET[preset],
  })),
  organizationAccess: { accessControl: { read: allowAuditRead, write: false } },
});
