import type { IdentityProvider, Organization, Prisma } from "@prisma/client";
import type { Account } from "next-auth";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TUser, TUserNotificationSettings } from "@formbricks/types/user";
import { upsertAccount } from "@/lib/account/service";
import { DEFAULT_TEAM_ID, SKIP_INVITE_FOR_SSO } from "@/lib/constants";
import { getIsFreshInstance } from "@/lib/instance/service";
import { verifyInviteToken } from "@/lib/jwt";
import { createMembership } from "@/lib/membership/service";
import { capturePostHogEvent } from "@/lib/posthog";
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

const LINKED_SSO_LOOKUP_SELECT = {
  id: true,
  email: true,
  locale: true,
  emailVerified: true,
  isActive: true,
  identityProvider: true,
  identityProviderAccountId: true,
} as const;

const OAUTH_ACCOUNT_NOT_LINKED_ERROR = "OAuthAccountNotLinked";

const syncSsoAccount = async (userId: string, account: Account, tx?: Prisma.TransactionClient) => {
  await upsertAccount(
    {
      userId,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      ...(account.access_token !== undefined ? { access_token: account.access_token } : {}),
      ...(account.refresh_token !== undefined ? { refresh_token: account.refresh_token } : {}),
      ...(account.expires_at !== undefined ? { expires_at: account.expires_at } : {}),
      ...(account.scope !== undefined ? { scope: account.scope } : {}),
      ...(account.token_type !== undefined ? { token_type: account.token_type } : {}),
      ...(account.id_token !== undefined ? { id_token: account.id_token } : {}),
    },
    tx
  );
};

const syncLinkedSsoUser = async ({
  linkedUser,
  user,
  account,
  contextLogger,
  logSource,
}: {
  linkedUser: Pick<TUser, "id" | "email">;
  user: TUser;
  account: Account;
  contextLogger: ReturnType<typeof logger.withContext>;
  logSource: "account_row" | "legacy_identity_provider";
}) => {
  contextLogger.debug(
    {
      linkedUserId: linkedUser.id,
      emailMatches: linkedUser.email === user.email,
      logSource,
    },
    "Found existing linked SSO user"
  );

  if (linkedUser.email === user.email) {
    await syncSsoAccount(linkedUser.id, account);
    contextLogger.debug(
      { linkedUserId: linkedUser.id, logSource },
      "SSO callback successful: linked user, email matches"
    );
    return true;
  }

  contextLogger.debug(
    { linkedUserId: linkedUser.id, logSource },
    "Email changed in SSO provider, checking for conflicts"
  );

  const otherUserWithEmail = await getUserByEmail(user.email);

  if (!otherUserWithEmail) {
    contextLogger.debug(
      { linkedUserId: linkedUser.id, action: "email_update", logSource },
      "No other user with this email found, updating linked user email after SSO provider change"
    );

    await updateUser(linkedUser.id, { email: user.email });
    await syncSsoAccount(linkedUser.id, account);
    return true;
  }

  contextLogger.debug(
    { linkedUserId: linkedUser.id, conflictingUserId: otherUserWithEmail.id, logSource },
    "SSO callback failed: email conflict after provider change"
  );

  throw new Error(
    "Looks like you updated your email somewhere else. A user with this new email exists already."
  );
};

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
    contextLogger.debug(
      { lookupType: "account_provider_account_id" },
      "Checking for existing linked user by provider account"
    );

    const existingLinkedAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      },
      select: {
        user: {
          select: LINKED_SSO_LOOKUP_SELECT,
        },
      },
    });

    if (existingLinkedAccount?.user) {
      return syncLinkedSsoUser({
        linkedUser: existingLinkedAccount.user,
        user,
        account,
        contextLogger,
        logSource: "account_row",
      });
    }

    contextLogger.debug(
      { lookupType: "legacy_identity_provider_account_id" },
      "No account row found, checking for legacy linked SSO user"
    );

    const existingLegacyLinkedUser = await prisma.user.findFirst({
      where: {
        identityProvider: provider,
        identityProviderAccountId: account.providerAccountId,
      },
      select: LINKED_SSO_LOOKUP_SELECT,
    });

    if (existingLegacyLinkedUser) {
      return syncLinkedSsoUser({
        linkedUser: existingLegacyLinkedUser,
        user,
        account,
        contextLogger,
        logSource: "legacy_identity_provider",
      });
    }

    // There is no existing linked account for this identity provider / account id
    // check if a user account with this email already exists and fail closed if so
    contextLogger.debug({ lookupType: "email" }, "No linked SSO account found, checking for user by email");

    const existingUserWithEmail = await getUserByEmail(user.email);

    if (existingUserWithEmail) {
      contextLogger.debug(
        {
          existingUserId: existingUserWithEmail.id,
          existingIdentityProvider: existingUserWithEmail.identityProvider,
        },
        "SSO callback blocked: existing user found by email without linked provider account"
      );
      throw new Error(OAUTH_ACCOUNT_NOT_LINKED_ERROR);
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

      const isAccessControlAllowed = await getAccessControlPermission(organization.id);
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
    const matchedLocale = await findMatchingLocale();

    const userProfile = await prisma.$transaction(async (tx) => {
      const createdUser = await createUser(
        {
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
          locale: matchedLocale,
        },
        tx
      );

      await syncSsoAccount(createdUser.id, account, tx);

      if (organization) {
        contextLogger.debug(
          { newUserId: createdUser.id, organizationId: organization.id, role: "member" },
          "Assigning user to organization"
        );
        await createMembership(organization.id, createdUser.id, { role: "member", accepted: true }, tx);

        if (SKIP_INVITE_FOR_SSO && DEFAULT_TEAM_ID) {
          contextLogger.debug(
            { newUserId: createdUser.id, defaultTeamId: DEFAULT_TEAM_ID },
            "Creating default team membership"
          );
          await createDefaultTeamMembership(createdUser.id, tx);
        }

        const updatedNotificationSettings: TUserNotificationSettings = {
          ...createdUser.notificationSettings,
          alert: {
            ...createdUser.notificationSettings?.alert,
          },
          unsubscribedOrganizationIds: Array.from(
            new Set([
              ...(createdUser.notificationSettings?.unsubscribedOrganizationIds || []),
              organization.id,
            ])
          ),
        };

        await updateUser(
          createdUser.id,
          {
            notificationSettings: updatedNotificationSettings,
          },
          tx
        );
      }

      return createdUser;
    });

    contextLogger.debug(
      { newUserId: userProfile.id, identityProvider: provider },
      "New SSO user created successfully"
    );

    // send new user to brevo
    createBrevoCustomer({ id: userProfile.id, email: userProfile.email });

    capturePostHogEvent(userProfile.id, "user_signed_up", {
      auth_provider: provider,
      email_domain: userProfile.email.split("@")[1],
      signup_source: callbackUrl?.includes("token=") ? "invite" : "direct",
      invite_organization_id: organization?.id ?? null,
    });

    if (isMultiOrgEnabled) {
      contextLogger.debug(
        { isMultiOrgEnabled, newUserId: userProfile.id },
        "Multi-org enabled, skipping organization assignment"
      );
      return true;
    }

    // Default organization assignment if env variable is set
    if (organization) {
      return true;
    }
    // Without default organization assignment
    return true;
  }
  contextLogger.debug("SSO callback successful: default return");

  return true;
};
