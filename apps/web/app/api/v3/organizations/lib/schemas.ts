import { z } from "zod";
import { ZUserEmail, ZUserName } from "@formbricks/types/user";

const MAX_NAME_LENGTH = 255;

/** `update_organization` body: the organization's display name is the only thing an agent may rename. */
export const ZV3OrganizationUpdateBody = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH).describe("New organization name."),
  })
  .strict();
export type TV3OrganizationUpdateBody = z.infer<typeof ZV3OrganizationUpdateBody>;

export const ZV3OrganizationResource = z.object({
  id: z.string(),
  name: z.string(),
  updatedAt: z.string(),
});
export type TV3OrganizationResource = z.infer<typeof ZV3OrganizationResource>;

/** The only roles an agent may grant: never `owner` (full control) and never `billing`. */
export const V3_AGENT_INVITABLE_ROLES = ["member", "manager"] as const;

export const ZV3InviteMemberBody = z
  .object({
    email: ZUserEmail.describe("Email address to invite."),
    name: ZUserName.max(MAX_NAME_LENGTH).describe("Name of the person being invited."),
    role: z
      .enum(V3_AGENT_INVITABLE_ROLES)
      .describe("Organization role to grant: member, or manager (only an owner may invite a manager)."),
    confirm: z
      .boolean()
      .optional()
      .describe(
        "Must be true to actually send the invite. Without it nothing is changed and the call only returns a summary of what would happen. Set it only after the person has approved this exact invite."
      ),
  })
  .strict();
export type TV3InviteMemberBody = z.infer<typeof ZV3InviteMemberBody>;

export const ZV3InviteMemberResource = z.object({
  status: z.enum(["preview", "invited"]),
  organizationId: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(V3_AGENT_INVITABLE_ROLES),
  inviteId: z.string().optional(),
  emailSent: z.boolean().optional(),
  message: z.string(),
});
export type TV3InviteMemberResource = z.infer<typeof ZV3InviteMemberResource>;

/** `create_organization` body. The caller becomes the owner; no workspace is created. */
export const ZV3OrganizationCreateBody = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH).describe("Name of the new organization."),
  })
  .strict();
export type TV3OrganizationCreateBody = z.infer<typeof ZV3OrganizationCreateBody>;

export const ZV3OrganizationCreatedResource = z.object({
  id: z.string(),
  name: z.string(),
  role: z.literal("owner"),
  workspaceCount: z.literal(0),
  setupGuideUrl: z
    .string()
    .describe("Public URL of the Setup guide. Follow its new-owner path for this organization next."),
  nextStep: z
    .string()
    .describe("What to do next: run the Setup guide's new-owner path for this organization."),
});
export type TV3OrganizationCreatedResource = z.infer<typeof ZV3OrganizationCreatedResource>;
