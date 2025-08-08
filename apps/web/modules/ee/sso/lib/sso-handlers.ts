import { createAccount } from "@/lib/account/service";
import { DEFAULT_TEAM_ID, SKIP_INVITE_FOR_SSO } from "@/lib/constants";
import { getIsFreshInstance } from "@/lib/instance/service";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { redactPII } from "@/lib/utils/logger-helpers";
import { createBrevoCustomer } from "@/modules/auth/lib/brevo";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import { TOidcNameFields, TSamlNameFields } from "@/modules/auth/types/auth";
import {
  getAccessControlPermission,
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSsoEnabled,
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
  const contextLogger = logger.withContext({
    correlationId: crypto.randomUUID(),
    name: "formbricks",
  });

  contextLogger.debug(
    {
      ...redactPII({ user, account, callbackUrl }),
      hasEmail: !!user.email,
      hasName: !!user.name,
    },
    "SSO callback initiated"
  );

  const isSsoEnabled = await getIsSsoEnabled();
  if (!isSsoEnabled) {
    contextLogger.debug({ isSsoEnabled }, "SSO not enabled");
    return false;
  }

  if (!user.email || account.type !== "oauth") {
    contextLogger.debug(
      {
        hasEmail: !!user.email,
        accountType: account.type,
        reason: !user.email ? "missing_email" : "invalid_account_type",
      },
      "SSO callback rejected: missing email or invalid account type"
    );

    return false;
  }

  let provider = account.provider.toLowerCase().replace("-", "") as IdentityProvider;

  if (provider === "saml") {
    const isSamlSsoEnabled = await getIsSamlSsoEnabled();
    if (!isSamlSsoEnabled) {
      contextLogger.debug({ provider: "saml" }, "SSO callback rejected: SAML not enabled in license");
      return false;
    }
  }

  if (account.provider) {
    // check if accounts for this provider / account Id already exists
    contextLogger.debug(
      { lookupType: "sso_provider_account" },
      "Checking for existing user with SSO provider"
    );

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
      contextLogger.debug(
        {
          existingUserId: existingUserWithAccount.id,
          emailMatches: existingUserWithAccount.email === user.email,
        },
        "Found existing user with SSO provider"
      );

      // User with this provider found
      // check if email still the same
      if (existingUserWithAccount.email === user.email) {
        contextLogger.debug(
          { existingUserId: existingUserWithAccount.id },
          "SSO callback successful: existing user, email matches"
        );
        return true;
      }

      contextLogger.debug(
        { existingUserId: existingUserWithAccount.id },
        "Email changed in SSO provider, checking for conflicts"
      );

      // user seemed to change his email within the provider
      // check if user with this email already exist
      // if not found just update user with new email address
      // if found throw an error (TODO find better solution)
      const otherUserWithEmail = await getUserByEmail(user.email);

      if (!otherUserWithEmail) {
        contextLogger.debug(
          { existingUserId: existingUserWithAccount.id, action: "email_update" },
          "No other user with this email found, updating user email after SSO provider change"
        );

        await updateUser(existingUserWithAccount.id, { email: user.email });
        return true;
      }

      contextLogger.debug(
        { existingUserId: existingUserWithAccount.id, conflictingUserId: otherUserWithEmail.id },
        "SSO callback failed: email conflict after provider change"
      );

      throw new Error(
        "Looks like you updated your email somewhere else. A user with this new email exists already."
      );
    }

    // There is no existing account for this identity provider / account id
    // check if user account with this email already exists
    // if user already exists throw error and request password login
    contextLogger.debug({ lookupType: "email" }, "No existing SSO account found, checking for user by email");

    const existingUserWithEmail = await getUserByEmail(user.email);

    if (existingUserWithEmail) {
      contextLogger.debug(
        { existingUserId: existingUserWithEmail.id, action: "existing_user_login" },
        "SSO callback successful: existing user found by email"
      );
      // Sign in the user with the existing account
      return true;
    }

    contextLogger.debug(
      { action: "new_user_creation" },
      "No existing user found, proceeding with new user creation"
    );

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

      contextLogger.debug(
        {
          hasName: !!oidcUser.name,
          hasGivenName: !!oidcUser.given_name,
          hasFamilyName: !!oidcUser.family_name,
          hasPreferredUsername: !!oidcUser.preferred_username,
        },
        "Extracted OIDC user name"
      );
    }

    if (provider === "saml") {
      const samlUser = user as TUser & TSamlNameFields;
      if (samlUser.name) {
        userName = samlUser.name;
      } else if (samlUser.firstName || samlUser.lastName) {
        userName = `${samlUser.firstName} ${samlUser.lastName}`;
      }
      contextLogger.debug(
        {
          hasName: !!samlUser.name,
          hasFirstName: !!samlUser.firstName,
          hasLastName: !!samlUser.lastName,
        },
        "Extracted SAML user name"
      );
    }

    // Get multi-org license status
    const isMultiOrgEnabled = await getIsMultiOrgEnabled();

    const isFirstUser = await getIsFreshInstance();

    contextLogger.debug(
      {
        isMultiOrgEnabled,
        isFirstUser,
        skipInviteForSso: SKIP_INVITE_FOR_SSO,
        hasDefaultTeamId: !!DEFAULT_TEAM_ID,
      },
      "License and instance configuration checked"
    );

    // Additional security checks for self-hosted instances without auto-provisioning and no multi-org enabled
    if (!isFirstUser && !SKIP_INVITE_FOR_SSO && !isMultiOrgEnabled) {
      if (!callbackUrl) {
        contextLogger.debug(
          { reason: "missing_callback_url" },
          "SSO callback rejected: missing callback URL for invite validation"
        );
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
          contextLogger.debug(
            { reason: "signin_without_invite_token" },
            "SSO callback rejected: signin without invite token"
          );
          return false;
        }

        // If multi-org is enabled, skip invite token validation
        // Verify invite token and check email match
        const { email, inviteId } = verifyInviteToken(inviteToken);
        if (email !== user.email) {
          contextLogger.debug(
            { reason: "invite_email_mismatch", inviteId },
            "SSO callback rejected: invite token email mismatch"
          );
          return false;
        }
        // Check if invite token is still valid
        const isValidInviteToken = await getIsValidInviteToken(inviteId);
        if (!isValidInviteToken) {
          contextLogger.debug(
            { reason: "invalid_invite_token", inviteId },
            "SSO callback rejected: invalid or expired invite token"
          );
          return false;
        }
        contextLogger.debug({ inviteId }, "Invite token validation successful");
      } catch (err) {
        contextLogger.debug(
          {
            reason: "invite_token_validation_error",
            error: err instanceof Error ? err.message : "unknown_error",
          },
          "SSO callback rejected: invite token validation failed"
        );
        // Log and reject on any validation errors
        contextLogger.error(err, "Invalid callbackUrl");
        return false;
      }
    }

    let organization: Organization | null = null;

    if (!isFirstUser && !isMultiOrgEnabled) {
      contextLogger.debug(
        {
          assignmentStrategy: SKIP_INVITE_FOR_SSO && DEFAULT_TEAM_ID ? "default_team" : "first_organization",
        },
        "Determining organization assignment"
      );
      if (SKIP_INVITE_FOR_SSO && DEFAULT_TEAM_ID) {
        organization = await getOrganizationByTeamId(DEFAULT_TEAM_ID);
      } else {
        organization = await getFirstOrganization();
      }

      if (!organization) {
        contextLogger.debug(
          { reason: "no_organization_found" },
          "SSO callback rejected: no organization found for assignment"
        );
        return false;
      }

      const isAccessControlAllowed = await getAccessControlPermission(organization.billing.plan);
      if (!isAccessControlAllowed && !callbackUrl) {
        contextLogger.debug(
          {
            reason: "insufficient_role_permissions",
            organizationId: organization.id,
            isAccessControlAllowed,
          },
          "SSO callback rejected: insufficient role management permissions"
        );
        return false;
      }
    }

    contextLogger.debug({ hasUserName: !!userName, identityProvider: provider }, "Creating new SSO user");

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

    contextLogger.debug(
      { newUserId: userProfile.id, identityProvider: provider },
      "New SSO user created successfully"
    );

    // send new user to brevo
    createBrevoCustomer({ id: userProfile.id, email: userProfile.email });

    if (isMultiOrgEnabled) {
      contextLogger.debug(
        { isMultiOrgEnabled, newUserId: userProfile.id },
        "Multi-org enabled, skipping organization assignment"
      );
      return true;
    }

    // Default organization assignment if env variable is set
    if (organization) {
      contextLogger.debug(
        { newUserId: userProfile.id, organizationId: organization.id, role: "member" },
        "Assigning user to organization"
      );
      await createMembership(organization.id, userProfile.id, { role: "member", accepted: true });
      await createAccount({
        ...account,
        userId: userProfile.id,
      });

      if (SKIP_INVITE_FOR_SSO && DEFAULT_TEAM_ID) {
        contextLogger.debug(
          { newUserId: userProfile.id, defaultTeamId: DEFAULT_TEAM_ID },
          "Creating default team membership"
        );
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
  contextLogger.debug("SSO callback successful: default return");

  return true;
};
