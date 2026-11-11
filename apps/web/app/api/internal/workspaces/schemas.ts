import { z } from "zod";
import { isSurveyRuntimeLanguage } from "@formbricks/i18n-utils/survey-runtime-languages";
import { ZId } from "@formbricks/types/common";
import { ZWorkspaceUpdateInput } from "@formbricks/types/workspace";
import { strictDeep } from "@/app/api/internal/lib/strict-schema";
import { checkNumberRange, checkStringMax, isPlainRecord } from "@/app/api/internal/lib/value-bounds";
import { WHITELABEL_IMAGE_URL_MAX_LENGTH } from "@/app/api/internal/organizations/[organizationId]/lib/limits";

export const ZWorkspaceIdParams = z.object({ workspaceId: ZId }).strict();

/** Bounds the workspace name a request may carry (ENG-1652). The column itself is unbounded. */
export const WORKSPACE_NAME_MAX = 255;

/**
 * Caps on the workspace settings a PATCH carries (CODING_STANDARDS.md "Input Limits"), applied here rather
 * than in the shared `ZWorkspaceUpdateInput` the public APIs also parse.
 */
/** Custom head scripts: a few analytics or consent snippets, a few KB each. */
export const WORKSPACE_HEAD_SCRIPTS_MAX_LENGTH = 65_536;
/** The survey cooldown, in days: the bounds the stored `ZWorkspace.recontactDays` already holds. */
export const WORKSPACE_RECONTACT_DAYS_MAX = 365;
/** A logo's background color: a CSS color, a handful of characters. */
export const WORKSPACE_LOGO_BG_COLOR_MAX_LENGTH = 64;
/** A styling string: a font family, a CSS length such as `1.25rem`, an input shadow. */
export const STYLING_TEXT_MAX_LENGTH = 255;
/**
 * A styling number: a font size or weight, a radius, a height or padding in pixels. The look form's
 * number inputs don't stop a minus sign, so the floor is the ceiling's mirror rather than zero.
 */
export const STYLING_NUMBER_MAX = 10_000;
/**
 * The default survey language: a BCP-47 tag a dozen characters long. Bounded before the runtime-language
 * check reads it. Its own constant rather than the link-survey language cap, whose module is server-only,
 * because the create-workspace dialog imports this file.
 */
export const WORKSPACE_DEFAULT_LANGUAGE_MAX_LENGTH = 64;
/** The background brightness slider's range, in percent. */
export const STYLING_BRIGHTNESS_MAX = 200;

/** Styling strings with a cap of their own, by their path inside `styling`. Image URLs get the URL cap. */
const STYLING_TEXT_CAPS: Record<string, number> = {
  "background.bg": WHITELABEL_IMAGE_URL_MAX_LENGTH,
  "logo.url": WHITELABEL_IMAGE_URL_MAX_LENGTH,
  "logo.bgColor": WORKSPACE_LOGO_BG_COLOR_MAX_LENGTH,
};

/** Styling numbers with a range of their own, by their path inside `styling`. */
const STYLING_NUMBER_RANGES: Record<string, { min: number; max: number }> = {
  "background.brightness": { min: 0, max: STYLING_BRIGHTNESS_MAX },
};

/**
 * Bounds every string and number in a parsed `styling`. `ZBaseStyling` has some forty fields, most of them
 * `number | string` unions, so they are checked in one walk rather than rebuilt one by one, and a field the
 * shared schema gains later is bounded without a change here. `strictDeep` has already refused unknown
 * keys, and styling nests two levels deep (`background.bg`, `brandColor.light`).
 */
const checkStylingValues = (value: unknown, path: string[], ctx: z.RefinementCtx): void => {
  const key = path.slice(1).join(".");
  if (typeof value === "string") {
    checkStringMax(ctx, value, STYLING_TEXT_CAPS[key] ?? STYLING_TEXT_MAX_LENGTH, path);
  } else if (typeof value === "number") {
    checkNumberRange(
      ctx,
      value,
      STYLING_NUMBER_RANGES[key] ?? { min: -STYLING_NUMBER_MAX, max: STYLING_NUMBER_MAX },
      path
    );
  } else if (isPlainRecord(value)) {
    for (const [childKey, child] of Object.entries(value)) {
      checkStylingValues(child, [...path, childKey], ctx);
    }
  }
};

const { config: ZConfigInput, logo: ZLogoInput } = ZWorkspaceUpdateInput.shape;

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
  }).extend({
    name: ZWorkspaceUpdateInput.shape.name.unwrap().max(WORKSPACE_NAME_MAX).optional(),
    recontactDays: z.int().min(0).max(WORKSPACE_RECONTACT_DAYS_MAX).optional(),
    customHeadScripts: z.string().max(WORKSPACE_HEAD_SCRIPTS_MAX_LENGTH).nullish(),
    config: ZConfigInput.unwrap()
      .extend({
        defaultSurveyLanguage: ZConfigInput.unwrap()
          .shape.defaultSurveyLanguage.unwrap()
          .unwrap()
          .max(WORKSPACE_DEFAULT_LANGUAGE_MAX_LENGTH)
          .nullish(),
      })
      .optional(),
    logo: ZLogoInput.unwrap()
      .extend({
        url: ZLogoInput.unwrap().shape.url.unwrap().max(WHITELABEL_IMAGE_URL_MAX_LENGTH).optional(),
        bgColor: z.string().max(WORKSPACE_LOGO_BG_COLOR_MAX_LENGTH).optional(),
      })
      .optional(),
  })
)
  .superRefine((body, ctx) => {
    if (body.styling) checkStylingValues(body.styling, ["styling"], ctx);
  })
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
  .object({
    confirmationName: z
      .string()
      .trim()
      .min(1, { error: "Type the workspace name to confirm." })
      .max(WORKSPACE_NAME_MAX),
  })
  .strict();

export type TWorkspaceDeletionBody = z.infer<typeof ZWorkspaceDeletionBody>;
