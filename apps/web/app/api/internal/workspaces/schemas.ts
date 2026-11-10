import { z } from "zod";
import { isSurveyRuntimeLanguage } from "@formbricks/i18n-utils/survey-runtime-languages";
import { ZId } from "@formbricks/types/common";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { strictDeep } from "@/app/api/internal/lib/strict-schema";

export const ZWorkspaceIdParams = z.object({ workspaceId: ZId }).strict();

/** Bounds the workspace name a request may carry (ENG-1652). The column itself is unbounded. */
export const WORKSPACE_NAME_MAX = 255;

/**
 * `GET /api/internal/workspaces?organizationId=&access=`: the caller's workspaces in one organization.
 * `read` (the default) is every workspace the caller can open, for the switchers; `write` only those the
 * caller can write to, for flows that target a workspace with a write (copying a survey).
 */
export const ZWorkspacesListQuery = z
  .object({ organizationId: ZId, access: z.enum(["read", "write"]).default("read") })
  .strict();
export type TWorkspacesListQuery = z.infer<typeof ZWorkspacesListQuery>;

/** `POST /api/internal/workspaces?organizationId=`: the organization the workspace is created in. */
export const ZWorkspacesCreateQuery = z.object({ organizationId: ZId }).strict();

/**
 * `POST /api/internal/workspaces` body: what the create-workspace dialog asks for, a name and the teams to
 * grant it to. Every other setting starts at its default and is changed from workspace settings, where its
 * own checks (the remove-branding licence, the default survey language) apply.
 */
export const ZWorkspaceCreateBody = z
  .object({
    name: z.string().trim().min(1, { error: "Workspace name cannot be empty" }).max(WORKSPACE_NAME_MAX),
    // An organization has far fewer teams than this; the service refuses duplicates and other tenants' ids.
    teamIds: z.array(ZId).max(500).default([]),
  })
  .strict();
export type TWorkspaceCreateBody = z.infer<typeof ZWorkspaceCreateBody>;

/**
 * The workspace settings the dashboard edits: name, cooldown, look and placement, branding, custom scripts
 * and the default survey language. Custom CSS has its own resource (`/api/v3/workspaces/{id}/custom-css`).
 *
 * `organizationId` is the workspace's tenant anchor and never writable (ENG-1919), and team assignment is
 * not a workspace column, so both are refused rather than silently dropped. Survey branding is refused too:
 * `PATCH /api/internal/workspaces/{id}/branding` is its one write path, behind the licence check. The
 * nested `config`, `styling` and `logo` reject unknown keys like the top level does: the shared schema
 * strips them, which would answer a typo with a confident 200.
 *
 * `config.defaultSurveyLanguage` is limited to the languages the survey runtime ships strings for. The set
 * cannot live in `ZWorkspaceConfig` itself, because `packages/types` deliberately depends on no other
 * workspace package — so it is enforced here, at the write boundary. Picking a language the runtime has no
 * strings for would render translated questions with English buttons and validation errors (ENG-2325), so
 * the write is rejected rather than silently ignored on read. That it is one of the workspace's own
 * languages needs the workspace, so the operation checks that half (ENG-2816).
 */
export const ZWorkspacePatchBody = strictDeep(
  ZWorkspaceUpdateInput.omit({
    organizationId: true,
    teamIds: true,
    inAppSurveyBranding: true,
    linkSurveyBranding: true,
  }).extend({ name: ZWorkspaceUpdateInput.shape.name.unwrap().max(WORKSPACE_NAME_MAX).optional() })
)
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

/**
 * `POST /api/internal/workspaces/{id}/deletions` body. Deleting a workspace takes its name, typed back, so a
 * stray request cannot delete one by id alone.
 */
export const ZWorkspaceDeletionBody = z
  .object({ confirmationName: z.string().trim().min(1, { error: "Type the workspace name to confirm." }) })
  .strict();

export type TWorkspaceDeletionBody = z.infer<typeof ZWorkspaceDeletionBody>;
