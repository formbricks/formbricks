import { OrganizationRole, User } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
import { ZUserEmail, ZUserName } from "../../types/user";

extendZodWithOpenApi(z);

const ZNoBillingOrganizationRoles = z.enum(
  Object.values(OrganizationRole).filter((role) => role !== OrganizationRole.billing) as [
    OrganizationRole,
    ...OrganizationRole[],
  ]
);

export type TNoBillingOrganizationRoles = z.infer<typeof ZNoBillingOrganizationRoles>;

export const ZUser = z.object({
  id: z.string().cuid2().openapi({
    description: "The ID of the user",
  }),
  createdAt: z.coerce.date().openapi({
    description: "The date and time the user was created",
    example: "2021-01-01T00:00:00.000Z",
  }),
  updatedAt: z.coerce.date().openapi({
    description: "The date and time the user was last updated",
    example: "2021-01-01T00:00:00.000Z",
  }),
  lastLoginAt: z.coerce.date().openapi({
    description: "The date and time the user last logged in",
    example: "2021-01-01T00:00:00.000Z",
  }),
  isActive: z.boolean().openapi({
    description: "Whether the user is active",
    example: true,
  }),
  name: ZUserName.openapi({
    description: "The name of the user",
    example: "John Doe",
  }),
  email: ZUserEmail.openapi({
    description: "The email of the user",
    example: "example@example.com",
  }),
  role: ZNoBillingOrganizationRoles.openapi({
    description: "The role of the user in the organization",
    example: OrganizationRole.member,
  }),
  teams: z
    .array(z.string())
    .optional()
    .openapi({
      description: "The list of teams the user is a member of",
      example: ["team1", "team2"],
    }),
}) satisfies z.ZodType<
  Omit<
    User,
    | "emailVerified"
    | "imageUrl"
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

ZUser.openapi({
  ref: "user",
  description: "A user",
});

export type TUser = z.infer<typeof ZUser>;
