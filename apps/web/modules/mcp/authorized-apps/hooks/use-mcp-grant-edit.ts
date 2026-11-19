"use client";

import { useState } from "react";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions, TRequestedMcpGrant } from "@/modules/mcp/grant";
import { type TMcpGrantDraftControls, useMcpGrantDraft } from "@/modules/mcp/hooks/use-mcp-grant-draft";
import { openMcpGrantEdit } from "../lib/edit-grant";

/** What Edit's Save sends: the client, the grant chosen, and the grant version the dialog opened. */
export type TMcpGrantSaveRequest = { clientId: string; grant: TRequestedMcpGrant; expectedUpdatedAt: string };

/**
 * Edit's draft for one client, opened once on mount ({@link openMcpGrantEdit}), and the request its Save
 * sends. The request names the grant version captured when the dialog opened, never the `client` prop's
 * current one: the list refetches while the dialog is open, and a newer version would let a stale draft
 * pass the server's 409 check. `null` while the draft can't be saved (nothing picked).
 */
export const useMcpGrantEdit = (client: {
  clientId: string;
  permissions: TMcpGrantPermissions;
  access: TMcpGrantAccessSelection;
  cap: TMcpGrantPermissions;
  grantUpdatedAt: string;
}): { draft: TMcpGrantDraftControls; saveRequest: () => TMcpGrantSaveRequest | null } => {
  const [opening] = useState(() => openMcpGrantEdit(client));
  const draft = useMcpGrantDraft(opening.initial, opening.saved);
  const saveRequest = (): TMcpGrantSaveRequest | null =>
    draft.accessSelection
      ? {
          clientId: client.clientId,
          grant: { permissions: draft.permissions, access: draft.accessSelection },
          expectedUpdatedAt: opening.expectedUpdatedAt,
        }
      : null;
  return { draft, saveRequest };
};
