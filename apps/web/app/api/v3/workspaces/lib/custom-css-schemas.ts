import { z } from "zod";
import { ZCustomCssError, ZCustomCssInput, ZCustomCssWarning } from "@formbricks/types/custom-css";

/**
 * `PATCH /api/v3/workspaces/{workspaceId}/custom-css` body (ENG-3641). Source only and strict, so a
 * caller-supplied `compiled` or `processorVersion` is rejected rather than ignored. `customCss: null`
 * clears both fields; an object replaces both and needs both keys.
 */
export const ZV3WorkspaceCustomCssPatchBody = z
  .object({
    customCss: ZCustomCssInput.nullable().describe(
      "Shared survey CSS source for the workspace: `{ light, dark }`, both keys required, each a CSS string or null (empty means none). Light applies in both appearances; dark adds overrides. null clears both. Source only — compiled output is computed by the server."
    ),
  })
  .strict();

export type TV3WorkspaceCustomCssPatchBody = z.infer<typeof ZV3WorkspaceCustomCssPatchBody>;

/** The workspace custom CSS resource: editable source only, never compiled output or internal versions. */
export const ZV3WorkspaceCustomCssResource = z
  .object({
    workspaceId: z.string(),
    customCss: ZCustomCssInput.nullable(),
    /** The one recoverable previous revision. Restore it by PATCHing this source back. */
    previous: ZCustomCssInput.nullable(),
    /**
     * `ok`, `stale` (compiled by an older processor; delivered by recompiling its source) or `withheld`
     * (the source no longer passes the current processor, so respondents get none of it until fixed).
     */
    status: z.enum(["ok", "stale", "withheld"]),
    /** Present only when `status` is `withheld`: why the stored source no longer passes. */
    errors: z.array(ZCustomCssError).optional(),
    /** Whether this caller may PATCH it: owner/manager for users, `manage` on the workspace for API keys. */
    canEdit: z.boolean(),
    /** Whether the organization's plan allows additions and edits. Removal is always allowed. */
    planAllowed: z.boolean(),
  })
  .strict();

export type TV3WorkspaceCustomCssResource = z.infer<typeof ZV3WorkspaceCustomCssResource>;

/** Processing warnings returned beside `data` by a successful custom CSS write. */
export const ZV3CustomCssWarnings = z.array(ZCustomCssWarning);
