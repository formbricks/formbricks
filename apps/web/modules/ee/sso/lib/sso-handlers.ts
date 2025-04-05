import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import { createUser } from "@/modules/auth/lib/user";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import { TOidcNameFields, TSamlNameFields } from "@/modules/auth/types/auth";
import {
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getisSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
import type { IdentityProvider } from "@prisma/client";
import type { Account } from "next-auth";
import { prisma } from "@formbricks/database";
import { createAccount } from "@formbricks/lib/account/service";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_ROLE,
  IS_FORMBRICKS_CLOUD,
} from "@formbricks/lib/constants";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization, getOrganization } from "@formbricks/lib/organization/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { logger } from "@formbricks/logger";
import type { TUser, TUserNotificationSettings } from "@formbricks/types/user";

export const handleSSOCallback = async ({
  user,
  account,
  callbackUrl,
}: {
  user: TUser;
  account: Account;
  callbackUrl: string;
}) => {
  const isSsoEnabled = await getisSsoEnabled();
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

    // Reject if no callback URL and no default org in self-hosted environment
    if (!callbackUrl && !DEFAULT_ORGANIZATION_ID && !IS_FORMBRICKS_CLOUD) {
      return false;
    }

    // Get multi-org license status
    const isMultiOrgEnabled = await getIsMultiOrgEnabled();

    // Additional security checks for self-hosted instances without default org
    if (!DEFAULT_ORGANIZATION_ID && !IS_FORMBRICKS_CLOUD) {
      try {
        // Parse and validate the callback URL
        const isValidCallbackUrl = new URL(callbackUrl);
        // Extract invite token and source from URL parameters
        const inviteToken = isValidCallbackUrl.searchParams.get("token") || "";
        const source = isValidCallbackUrl.searchParams.get("source") || "";

        // Allow sign-in if multi-org is enabled, otherwise check for invite token
        if (source === "signin" && !inviteToken && !isMultiOrgEnabled) {
          return false;
        }

        // If multi-org is enabled, skip invite token validation
        if (!isMultiOrgEnabled) {
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
        }
      } catch (err) {
        // Log and reject on any validation errors
        logger.error(err, "Invalid callbackUrl");
        return false;
      }
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
    createBrevoCustomer({ id: user.id, email: user.email });

    // Default organization assignment if env variable is set
    if (DEFAULT_ORGANIZATION_ID && DEFAULT_ORGANIZATION_ID.length > 0) {
      // check if organization exists
      let organization = await getOrganization(DEFAULT_ORGANIZATION_ID);
      let isNewOrganization = false;
      if (!organization) {
        // create organization with id from env
        organization = await createOrganization({
          id: DEFAULT_ORGANIZATION_ID,
          name: userProfile.name + "'s Organization",
        });
        isNewOrganization = true;
      }
      const role = isNewOrganization ? "owner" : DEFAULT_ORGANIZATION_ROLE || "manager";
      await createMembership(organization.id, userProfile.id, { role: role, accepted: true });
      await createAccount({
        ...account,
        userId: userProfile.id,
      });

      const updatedNotificationSettings: TUserNotificationSettings = {
        ...userProfile.notificationSettings,
        alert: {
          ...userProfile.notificationSettings?.alert,
        },
        unsubscribedOrganizationIds: Array.from(
          new Set([...(userProfile.notificationSettings?.unsubscribedOrganizationIds || []), organization.id])
        ),
        weeklySummary: {
          ...userProfile.notificationSettings?.weeklySummary,
        },
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
