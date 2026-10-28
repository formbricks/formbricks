import type { z } from "zod";
import type { ZWorkspacePatchBody } from "@/app/api/internal/workspaces/schemas";
import type {
  TWorkspaceDeletionResource,
  TWorkspaceSettingsResource,
} from "@/app/api/internal/workspaces/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/workspaces";

const workspacePath = (workspaceId: string) => `${BASE_PATH}/${encodeURIComponent(workspaceId)}`;

/** What a settings form sends: only the fields it changes. `expectedUpdatedAt` may be a `Date`. */
export type TWorkspaceSettingsPatch = z.input<typeof ZWorkspacePatchBody>;

/** Change workspace settings; the server merges a partial `config` onto the stored one. */
export const patchWorkspaceSettings = (workspaceId: string, body: TWorkspaceSettingsPatch) =>
  sendApiRequest<TWorkspaceSettingsResource>(workspacePath(workspaceId), { method: "PATCH", body });

/** Delete a workspace, confirmed by its name. Answers where the dashboard goes next. */
export const deleteWorkspaceWithConfirmation = (workspaceId: string, confirmationName: string) =>
  sendApiRequest<TWorkspaceDeletionResource>(workspacePath(workspaceId), {
    method: "DELETE",
    body: { confirmationName },
  });
