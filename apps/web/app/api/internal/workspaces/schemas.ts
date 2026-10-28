import { z } from "zod";
import { isSurveyRuntimeLanguage } from "@formbricks/i18n-utils/survey-runtime-languages";
import { ZId } from "@formbricks/types/common";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";

export const ZWorkspaceIdParams = z.object({ workspaceId: ZId });

/**
 * The workspace settings the dashboard edits: name, cooldown, look and placement, branding, custom scripts
 * and the default survey language. Custom CSS has its own resource (`/api/v3/workspaces/{id}/custom-css`).
 *
 * `organizationId` is the workspace's tenant anchor and never writable (ENG-1919), and team assignment is
 * not a workspace column, so both are refused rather than silently dropped.
 *
 * `config.defaultSurveyLanguage` is limited to the languages the survey runtime ships strings for. The set
 * cannot live in `ZWorkspaceConfig` itself, because `packages/types` deliberately depends on no other
 * workspace package — so it is enforced here, at the write boundary. Picking a language the runtime has no
 * strings for would render translated questions with English buttons and validation errors (ENG-2325), so
 * the write is rejected rather than silently ignored on read. That it is one of the workspace's own
 * languages needs the workspace, so the operation checks that half (ENG-2816).
 */
export const ZWorkspacePatchBody = ZWorkspaceUpdateInput.omit({ organizationId: true, teamIds: true })
  .strict()
  .refine(
    (body) =>
      body.config?.defaultSurveyLanguage == null ||
      isSurveyRuntimeLanguage(body.config.defaultSurveyLanguage),
    { path: ["config", "defaultSurveyLanguage"], error: "Unsupported default survey language" }
  )
  // A logo carries both a url and a bgColor, so a save from a stale page could restore a url whose object
  // another save already deleted. The baseline is what lets the write refuse that.
  .refine((body) => body.logo === undefined || body.expectedUpdatedAt !== undefined, {
    path: ["expectedUpdatedAt"],
    error: "expectedUpdatedAt is required when the update carries a logo",
  })
  .refine((body) => Object.keys(body).some((key) => key !== "expectedUpdatedAt"), {
    error: "Provide at least one field to update.",
  });

export type TWorkspacePatchBody = z.infer<typeof ZWorkspacePatchBody>;

/** Deleting a workspace takes its name, typed back, so a stray request cannot delete one by id alone. */
export const ZWorkspaceDeleteBody = z
  .object({ confirmationName: z.string().trim().min(1, { error: "Type the workspace name to confirm." }) })
  .strict();

export type TWorkspaceDeleteBody = z.infer<typeof ZWorkspaceDeleteBody>;
