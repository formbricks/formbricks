import { createAccount } from "@/lib/account/service";
import { DEFAULT_TEAM_ID, SKIP_INVITE_FOR_SSO } from "@/lib/constants";
import { getIsFreshInstance } from "@/lib/instance/service";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import { TOidcNameFields, TSamlNameFields } from "@/modules/auth/types/auth";
import {
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSsoEnabled,
  getRoleManagementPermission,
} from "@/modules/ee/license-check/lib/utils";
import { getFirstOrganization } from "@/modules/ee/sso/lib/organization";
import { createDefaultTeamMembership, getOrganizationByTeamId } from "@/modules/ee/sso/lib/team";
import type { IdentityProvider, Organization } from "@prisma/client";
import type { Account } from "next-auth";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TUser, TUserNotificationSettings } from "@formbricks/types/user";

export const handleSsoCallback = async ({
  user,
  account,
  callbackUrl,
}: {
  user: TUser;
  account: Account;
  callbackUrl: string;
}) => {
  const isSsoEnabled = await getIsSsoEnabled();
  if (!isSsoEnabled) {
    return false;
  }

  if (!user.email || account.type !== "oauth") {
    return false;
  }

  let provider = account.provider.toLowerCase().replace("-", "") as IdentityProvider;

  if (provider === "saml") {
    const isSamlSsoEnabled = await getIsSamlSsoEnabled();
    if (!isSamlSsoEnabled) {
      return false;
    }
  }

  if (account.provider) {
    // check if accounts for this provider / account Id already exists
    const existingUserWithAccount = await prisma.user.findFirst({
      include: {
        accounts: {
          where: {
            provider: account.provider,
          },
        },
      },
      where: {
        identityProvider: provider,
        identityProviderAccountId: account.providerAccountId,
      },
    });

    if (existingUserWithAccount) {
      // User with this provider found
      // check if email still the same
      if (existingUserWithAccount.email === user.email) {
        return true;
      }

      // user seemed to change his email within the provider
      // check if user with this email already exist
      // if not found just update user with new email address
      // if found throw an error (TODO find better solution)
      const otherUserWithEmail = await getUserByEmail(user.email);

      if (!otherUserWithEmail) {
        await updateUser(existingUserWithAccount.id, { email: user.email });
        return true;
      }
      throw new Error(
        "Looks like you updated your email somewhere else. A user with this new email exists already."
      );
    }

    // There is no existing account for this identity provider / account id
    // check if user account with this email already exists
    // if user already exists throw error and request password login
    const existingUserWithEmail = await getUserByEmail(user.email);

    if (existingUserWithEmail) {
      // Sign in the user with the existing account
      return true;
    }

    let userName = user.name;

    if (provider === "openid") {
      const oidcUser = user as TUser & TOidcNameFields;
      if (oidcUser.name) {
        userName = oidcUser.name;
      } else if (oidcUser.given_name || oidcUser.family_name) {
        userName = `${oidcUser.given_name} ${oidcUser.family_name}`;
      } else if (oidcUser.preferred_username) {
        userName = oidcUser.preferred_username;
      }
    }

    if (provider === "saml") {
      const samlUser = user as TUser & TSamlNameFields;
      if (samlUser.name) {
        userName = samlUser.name;
      } else if (samlUser.firstName || samlUser.lastName) {
        userName = `${samlUser.firstName} ${samlUser.lastName}`;
      }
    }

    // Get multi-org license status
    const isMultiOrgEnabled = await getIsMultiOrgEnabled();

    const isFirstUser = await getIsFreshInstance();

    // Additional security checks for self-hosted instances without auto-provisioning and no multi-org enabled
    if (!isFirstUser && !SKIP_INVITE_FOR_SSO && !isMultiOrgEnabled) {
      if (!callbackUrl) {
        return false;
      }

      try {
        // Parse and validate the callback URL
        const isValidCallbackUrl = new URL(callbackUrl);
        // Extract invite token and source from URL parameters
        const inviteToken = isValidCallbackUrl.searchParams.get("token") || "";
        const source = isValidCallbackUrl.searchParams.get("source") || "";

        // Allow sign-in if multi-org is enabled, otherwise check for invite token
        if (source === "signin" && !inviteToken) {
          return false;
        }

        // If multi-org is enabled, skip invite token validation
        // Verify invite token and check email match
        const { email, inviteId } = verifyInviteToken(inviteToken);
        if (email !== user.email) {
          return false;
        }
        // Check if invite token is still valid
        const isValidInviteToken = await getIsValidInviteToken(inviteId);
        if (!isValidInviteToken) {
          return false;
        }
      } catch (err) {
        // Log and reject on any validation errors
        logger.error(err, "Invalid callbackUrl");
        return false;
      }
    }

    let organization: Organization | null = null;

    if (!isFirstUser && !isMultiOrgEnabled) {
      if (SKIP_INVITE_FOR_SSO && DEFAULT_TEAM_ID) {
        organization = await getOrganizationByTeamId(DEFAULT_TEAM_ID);
      } else {
        organization = await getFirstOrganization();
      }

      if (!organization) {
        return false;
      }

      const canDoRoleManagement = await getRoleManagementPermission(organization.billing.plan);
      if (!canDoRoleManagement && !callbackUrl) return false;
    }

    const userProfile = await createUser({
      name:
        userName ||
        user.email
          .split("@")[0]
          .replace(/[^'\p{L}\p{M}\s\d-]+/gu, " ")
          .trim(),
      email: user.email,
      emailVerified: new Date(Date.now()),
      identityProvider: provider,
      identityProviderAccountId: account.providerAccountId,
      locale: await findMatchingLocale(),
    });

    // send new user to brevo
    createBrevoCustomer({ id: userProfile.id, email: userProfile.email });

    if (isMultiOrgEnabled) return true;

    // Default organization assignment if env variable is set
    if (organization) {
      await createMembership(organization.id, userProfile.id, { role: "member", accepted: true });
      await createAccount({
        ...account,
        userId: userProfile.id,
      });

      if (SKIP_INVITE_FOR_SSO && DEFAULT_TEAM_ID) {
        await createDefaultTeamMembership(userProfile.id);
      }

      const updatedNotificationSettings: TUserNotificationSettings = {
        ...userProfile.notificationSettings,
        alert: {
          ...userProfile.notificationSettings?.alert,
        },
        unsubscribedOrganizationIds: Array.from(
          new Set([...(userProfile.notificationSettings?.unsubscribedOrganizationIds || []), organization.id])
        ),
      };

      await updateUser(userProfile.id, {
        notificationSettings: updatedNotificationSettings,
      });
      return true;
    }
    // Without default organization assignment
    return true;
  }

  return true;
};
