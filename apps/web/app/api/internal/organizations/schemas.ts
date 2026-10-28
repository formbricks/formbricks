import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZOrganization, ZOrganizationUpdateInput } from "@formbricks/types/organizations";

export const ZOrganizationIdParams = z.object({ organizationId: ZId });

/** `POST /api/internal/organizations`: the organization set up during onboarding. */
export const ZOrganizationCreateBody = z.object({ name: ZOrganization.shape.name }).strict();

export type TOrganizationCreateBody = z.infer<typeof ZOrganizationCreateBody>;

/**
 * The organization settings the general settings page edits. Each field has its own permission: the name is
 * the owner's, the AI and display settings are owners' and managers' (see `requiredOrganizationActions`).
 */
export const ZOrganizationPatchBody = z
  .object({
    name: ZOrganization.shape.name,
    isAISmartToolsEnabled: z.boolean(),
    displayTimeZone: ZOrganizationUpdateInput.shape.displayTimeZone.unwrap(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: "Provide at least one field to update." });

export type TOrganizationPatchBody = z.infer<typeof ZOrganizationPatchBody>;
