"use client";

import { useState } from "react";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";
import type { TMcpGrantAccessDraft } from "@/modules/mcp/grant-access";
import {
  type TMcpGrantDraft,
  type TMcpGrantDraftState,
  type TMcpSavedGrant,
  getMcpGrantDraftState,
} from "@/modules/mcp/grant-draft";

export type TMcpGrantDraftControls = TMcpGrantDraftState & {
  permissions: TMcpGrantPermissions;
  setPermissions: (permissions: TMcpGrantPermissions) => void;
  access: TMcpGrantAccessDraft;
  setAccess: (access: TMcpGrantAccessDraft) => void;
};

/**
 * The grant being chosen on the consent screen and in Authorized apps' Edit: its permissions and its
 * organization & workspace access, opened with `initial`, and what it submits. `saved` is the grant Edit
 * opened with, so an unchanged draft can't be saved; the consent screen passes `null`.
 */
export const useMcpGrantDraft = (
  initial: TMcpGrantDraft,
  saved: TMcpSavedGrant | null
): TMcpGrantDraftControls => {
  const [permissions, setPermissions] = useState<TMcpGrantPermissions>(initial.permissions);
  const [access, setAccess] = useState<TMcpGrantAccessDraft>(initial.access);
  return {
    permissions,
    setPermissions,
    access,
    setAccess,
    ...getMcpGrantDraftState({ permissions, access }, saved),
  };
};
