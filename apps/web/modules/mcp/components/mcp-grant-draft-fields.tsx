"use client";

import type { TMcpGrantPermissions } from "@/modules/mcp/grant";
import type { TMcpGrantAccessOptions } from "@/modules/mcp/grant-access";
import type { TMcpGrantDraftControls } from "@/modules/mcp/hooks/use-mcp-grant-draft";
import { McpGrantAccessSelector } from "./mcp-grant-access-selector";
import { McpGrantEditor } from "./mcp-grant-editor";

interface McpGrantDraftFieldsProps {
  /** Unique on the page; prefixes the ids of the access picker and the matrix. */
  id: string;
  draft: TMcpGrantDraftControls;
  /** The user's organizations and workspaces the access picker offers. */
  accessOptions: TMcpGrantAccessOptions;
  /** What the client's scopes ask for: no level above it can be chosen. */
  cap: TMcpGrantPermissions;
  isDashboardViewer: boolean;
  /** Shown while the draft gives no permission; each surface says what to do instead. */
  emptyHint: string;
  disabled?: boolean;
}

/**
 * The body both grant forms share (the consent screen and Authorized apps' Edit): the organization &
 * workspace access, the permission matrix, and the hint for a grant that gives nothing. The caller holds
 * the draft (`useMcpGrantDraft`) and renders its own actions.
 */
export const McpGrantDraftFields = ({
  id,
  draft,
  accessOptions,
  cap,
  isDashboardViewer,
  emptyHint,
  disabled,
}: Readonly<McpGrantDraftFieldsProps>) => (
  <>
    <McpGrantAccessSelector
      id={`${id}-access`}
      value={draft.access}
      options={accessOptions}
      onChange={draft.setAccess}
      disabled={disabled}
    />
    <McpGrantEditor
      id={`${id}-grant`}
      permissions={draft.permissions}
      cap={cap}
      isDashboardViewer={isDashboardViewer}
      onChange={draft.setPermissions}
      disabled={disabled}
    />
    {draft.isEmpty && <output className="block text-sm text-slate-600">{emptyHint}</output>}
  </>
);
