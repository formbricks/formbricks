import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZOrganization, ZOrganizationUpdateInput } from "@formbricks/types/organizations";

export const ZOrganizationIdParams = z.object({ organizationId: ZId }).strict();

/** Bounds an organization's name on every write (ENG-1652), as `TEAM_NAME_MAX` bounds a team's. */
export const ORGANIZATION_NAME_MAX = 255;

const ZOrganizationName = ZOrganization.shape.name.max(ORGANIZATION_NAME_MAX);

/** `POST /api/internal/organizations`: the organization set up during onboarding. */
export const ZOrganizationCreateBody = z.object({ name: ZOrganizationName }).strict();

export type TOrganizationCreateBody = z.infer<typeof ZOrganizationCreateBody>;

/**
 * The organization settings the general settings page edits. Each field has its own permission: the name is
 * the owner's, the AI and display settings are owners' and managers' (see `requiredOrganizationActions`).
 */
export const ZOrganizationPatchBody = z
  .object({
    name: ZOrganizationName,
    isAISmartToolsEnabled: z.boolean(),
    displayTimeZone: ZOrganizationUpdateInput.shape.displayTimeZone.unwrap(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: "Provide at least one field to update." });

export type TOrganizationPatchBody = z.infer<typeof ZOrganizationPatchBody>;
