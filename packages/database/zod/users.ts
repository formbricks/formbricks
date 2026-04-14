import { OrganizationRole, User } from "@prisma/client";
import { z } from "zod";
import { ZUserEmail, ZUserName } from "../../types/user";

const ZNoBillingOrganizationRoles = z.enum(
  Object.values(OrganizationRole).filter((role) => role !== OrganizationRole.billing) as [
    OrganizationRole,
    ...OrganizationRole[],
  ]
);

export type TNoBillingOrganizationRoles = z.infer<typeof ZNoBillingOrganizationRoles>;

export const ZUser = z.object({
  id: z.cuid2().describe("The ID of the user"),
  createdAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the user was created"),
  updatedAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the user was last updated"),
  lastLoginAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the user last logged in"),
  isActive: z
    .boolean()
    .meta({
      example: true,
    })
    .describe("Whether the user is active"),
  name: ZUserName.meta({
    example: "John Doe",
  }).describe("The name of the user"),
  email: ZUserEmail.meta({
    example: "example@example.com",
  }).describe("The email of the user"),
  role: ZNoBillingOrganizationRoles.meta({
    example: OrganizationRole.member,
  }).describe("The role of the user in the organization"),
  teams: z
    .array(z.string())
    .optional()
    .meta({
      example: ["team1", "team2"],
    })
    .describe("The list of teams the user is a member of"),
}) satisfies z.ZodType<
  Omit<
    User,
    | "emailVerified"
    | "twoFactorSecret"
    | "twoFactorEnabled"
    | "backupCodes"
    | "password"
    | "identityProvider"
    | "identityProviderAccountId"
    | "memberships"
    | "accounts"
    | "groupId"
    | "invitesCreated"
    | "invitesAccepted"
    | "objective"
    | "notificationSettings"
    | "locale"
    | "surveys"
    | "teamUsers"
    | "role" //doesn't satisfy the type because we remove the billing role
    | "deprecatedRole"
  >
>;

ZUser.meta({
  id: "user",
}).describe("A user");

export type TUser = z.infer<typeof ZUser>;
