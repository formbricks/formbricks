"use server";

import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  addUserToWhitelist,
  getNonWhitelistedUsers,
  getWhitelistedUsers,
  removeUserFromWhitelist,
} from "@/modules/organization/settings/whitelist/lib/whitelist";
import { z } from "zod";
import { WHITELIST_DISABLED } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { ZId } from "@formbricks/types/common";
import { AuthenticationError } from "@formbricks/types/errors";
import { ZOrganizationRole } from "@formbricks/types/memberships";

const ZAddUserToWhitelistAction = z.object({
  email: z.string(),
  organizationId: ZId,
  role: ZOrganizationRole,
});

export const addUserToWhitelistAction = authenticatedActionClient
  .schema(ZAddUserToWhitelistAction)
  .action(async ({ parsedInput, ctx }) => {
    if (WHITELIST_DISABLED) {
      throw new AuthenticationError("Whitelist disabled");
    }

    const currentUserMembership = await getMembershipByUserIdOrganizationId(
      ctx.user.id,
      parsedInput.organizationId
    );
    if (!currentUserMembership) {
      throw new AuthenticationError("User not a member of this organization");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const whitelistedUserId = await addUserToWhitelist({
      email: parsedInput.email,
      organizationId: parsedInput.organizationId,
      currentUserId: ctx.user.id,
    });

    return whitelistedUserId;
  });

const ZRemoveUserFromWhitelistAction = z.object({
  email: z.string(),
  organizationId: ZId,
});

export const removeUserFromWhitelistAction = authenticatedActionClient
  .schema(ZRemoveUserFromWhitelistAction)
  .action(async ({ parsedInput, ctx }) => {
    if (WHITELIST_DISABLED) {
      throw new AuthenticationError("Whitelist disabled");
    }

    const currentUserMembership = await getMembershipByUserIdOrganizationId(
      ctx.user.id,
      parsedInput.organizationId
    );
    if (!currentUserMembership) {
      throw new AuthenticationError("User not a member of this organization");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const whitelistedUserId = await removeUserFromWhitelist({
      email: parsedInput.email,
      organizationId: parsedInput.organizationId,
      currentUserId: ctx.user.id,
    });

    return whitelistedUserId;
  });

const ZGetNonWhitelistedUsersAction = z.object({
  take: z.number(),
  skip: z.number(),
  query: z.string().optional(),
  organizationId: ZId,
});

export const getNonWhitelistedUsersAction = authenticatedActionClient
  .schema(ZGetNonWhitelistedUsersAction)
  .action(async ({ parsedInput, ctx }) => {
    // Verify user is an owner or manager
    const currentUserMembership = await getMembershipByUserIdOrganizationId(
      ctx.user.id,
      parsedInput.organizationId
    );
    if (!currentUserMembership) {
      throw new AuthenticationError("User not a member of this organization");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const nonWhitelistedUsers = await getNonWhitelistedUsers({ query: parsedInput.query });

    return nonWhitelistedUsers;
  });

const ZGetWhitelistedUsersAction = z.object({
  take: z.number(),
  skip: z.number(),
  query: z.string().optional(),
  organizationId: ZId,
});

export const getWhitelistedUsersAction = authenticatedActionClient
  .schema(ZGetWhitelistedUsersAction)
  .action(async ({ parsedInput, ctx }) => {
    // Verify user is an owner or manager
    const currentUserMembership = await getMembershipByUserIdOrganizationId(
      ctx.user.id,
      parsedInput.organizationId
    );
    if (!currentUserMembership) {
      throw new AuthenticationError("User not a member of this organization");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const whitelistedUsers = await getWhitelistedUsers();

    return whitelistedUsers;
  });
