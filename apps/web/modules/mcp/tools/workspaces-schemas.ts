import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  ZV3WorkspaceBrandingBody,
  ZV3WorkspaceCreateBody,
  ZV3WorkspaceUpdateBody,
} from "@/app/api/v3/workspaces/lib/setup-schemas";

/**
 * Inputs of the workspace setup tools. Each extends the v3 body schema rather than restating it, and every
 * object is `.strict()` so a misspelled key is a loud error instead of a silently dropped one.
 */

// The v3 create body already carries `organizationId`, the tenant the caller must own or manage.
export const ZMcpCreateWorkspaceInput = ZV3WorkspaceCreateBody;

export const ZMcpUpdateWorkspaceInput = ZV3WorkspaceUpdateBody.extend({
  workspaceId: ZId.describe("Workspace to change. Take it from get_account_context or list_workspaces."),
}).strict();

export const ZMcpSetWorkspaceBrandingInput = ZV3WorkspaceBrandingBody.extend({
  workspaceId: ZId.describe("Workspace to brand. Take it from get_account_context or list_workspaces."),
}).strict();

export type TMcpCreateWorkspaceInput = z.infer<typeof ZMcpCreateWorkspaceInput>;
export type TMcpUpdateWorkspaceInput = z.infer<typeof ZMcpUpdateWorkspaceInput>;
export type TMcpSetWorkspaceBrandingInput = z.infer<typeof ZMcpSetWorkspaceBrandingInput>;
