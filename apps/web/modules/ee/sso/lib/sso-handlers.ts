import type { IdentityProvider, Organization } from "@prisma/client";
import type { Account } from "next-auth";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TUser, TUserNotificationSettings } from "@formbricks/types/user";
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
import { LINKED_SSO_LOOKUP_SELECT, TSsoLookupUser, syncSsoIdentityForUser } from "./account-linking";
import { getSsoProviderLookupCandidates, normalizeSsoProvider } from "./provider-normalization";
import { startSsoRecovery } from "./sso-recovery";

const syncLinkedSsoUser = async ({
  linkedUser,
  user,
  account,
  provider,
  contextLogger,
  logSource,
  legacyAccountIdToNormalize,
}: {
  linkedUser: Pick<TUser, "id" | "email">;
  user: TUser;
  account: Account;
  provider: IdentityProvider;
  contextLogger: ReturnType<typeof logger.withContext>;
  logSource: "account_row" | "legacy_account_alias" | "legacy_identity_provider";
  legacyAccountIdToNormalize?: string;
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
    await syncSsoIdentityForUser({
      userId: linkedUser.id,
      provider,
      account: {
        type: account.type,
        provider,
        providerAccountId: account.providerAccountId,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        scope: account.scope,
        token_type: account.token_type,
        id_token: account.id_token,
      },
      legacyAccountIdToNormalize,
    });

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

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: linkedUser.id,
        },
        data: {
          email: user.email,
        },
      });

      await syncSsoIdentityForUser({
        userId: linkedUser.id,
        provider,
        account: {
          type: account.type,
          provider,
          providerAccountId: account.providerAccountId,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
          scope: account.scope,
          token_type: account.token_type,
          id_token: account.id_token,
        },
        tx,
        legacyAccountIdToNormalize,
      });
    });

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

const findLinkedSsoUser = async ({
  provider,
  providerAccountId,
}: {
  provider: IdentityProvider;
  providerAccountId: string;
}): Promise<{
  linkedUser: TSsoLookupUser;
  logSource: "account_row" | "legacy_account_alias";
  legacyAccountIdToNormalize?: string;
} | null> => {
  const lookupCandidates = getSsoProviderLookupCandidates(provider);

  for (const lookupProvider of lookupCandidates) {
    const existingLinkedAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: lookupProvider,
          providerAccountId,
        },
      },
      select: {
        id: true,
        provider: true,
        user: {
          select: LINKED_SSO_LOOKUP_SELECT,
        },
      },
    });

    if (!existingLinkedAccount?.user) {
      continue;
    }

    if (existingLinkedAccount.provider === provider) {
      return {
        linkedUser: existingLinkedAccount.user,
        logSource: "account_row",
      };
    }

    return {
      linkedUser: existingLinkedAccount.user,
      logSource: "legacy_account_alias",
      legacyAccountIdToNormalize: existingLinkedAccount.id,
    };
  }

  return null;
};

const findLegacyExactMatch = async ({
  provider,
  providerAccountId,
}: {
  provider: IdentityProvider;
  providerAccountId: string;
}) =>
  prisma.user.findFirst({
    where: {
      identityProvider: provider,
      identityProviderAccountId: providerAccountId,
    },
    select: LINKED_SSO_LOOKUP_SELECT,
  });

const provisionNewSsoUser = async ({
  user,
  account,
  provider,
  callbackUrl,
  contextLogger,
}: {
  user: TUser;
  account: Account;
  provider: IdentityProvider;
  callbackUrl: string;
  contextLogger: ReturnType<typeof logger.withContext>;
}) => {
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

  if (!isFirstUser && !SKIP_INVITE_FOR_SSO && !isMultiOrgEnabled) {
    if (!callbackUrl) {
      contextLogger.debug(
        { reason: "missing_callback_url" },
        "SSO callback rejected: missing callback URL for invite validation"
      );
      return false;
    }

    try {
      const isValidCallbackUrl = new URL(callbackUrl);
      const inviteToken = isValidCallbackUrl.searchParams.get("token") || "";
      const source = isValidCallbackUrl.searchParams.get("source") || "";

      if (source === "signin" && !inviteToken) {
        contextLogger.debug(
          { reason: "signin_without_invite_token" },
          "SSO callback rejected: signin without invite token"
        );
        return false;
      }

      const { email, inviteId } = verifyInviteToken(inviteToken);
      if (email !== user.email) {
        contextLogger.debug(
          { reason: "invite_email_mismatch", inviteId },
          "SSO callback rejected: invite token email mismatch"
        );
        return false;
      }

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

    await syncSsoIdentityForUser({
      userId: createdUser.id,
      provider,
      account: {
        type: account.type,
        provider,
        providerAccountId: account.providerAccountId,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        scope: account.scope,
        token_type: account.token_type,
        id_token: account.id_token,
      },
      tx,
    });

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
          new Set([...(createdUser.notificationSettings?.unsubscribedOrganizationIds || []), organization.id])
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

  if (organization) {
    return true;
  }

  return true;
};

export const handleSsoCallback = async ({
  user,
  account,
  callbackUrl,
}: {
  user: TUser;
  account: Account;
  callbackUrl: string;
}): Promise<boolean | string> => {
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

  const provider = normalizeSsoProvider(account.provider);
  if (!provider) {
    contextLogger.debug({ provider: account.provider }, "SSO callback rejected: unsupported provider");
    return false;
  }

  if (provider === "saml") {
    const isSamlSsoEnabled = await getIsSamlSsoEnabled();
    if (!isSamlSsoEnabled) {
      contextLogger.debug({ provider: "saml" }, "SSO callback rejected: SAML not enabled in license");
      return false;
    }
  }

  contextLogger.debug(
    { lookupType: "account_provider_account_id" },
    "Checking for existing linked user by provider account"
  );
  const existingLinkedUser = await findLinkedSsoUser({
    provider,
    providerAccountId: account.providerAccountId,
  });

  if (existingLinkedUser) {
    return syncLinkedSsoUser({
      linkedUser: existingLinkedUser.linkedUser,
      user,
      account,
      provider,
      contextLogger,
      logSource: existingLinkedUser.logSource,
      legacyAccountIdToNormalize: existingLinkedUser.legacyAccountIdToNormalize,
    });
  }

  contextLogger.debug(
    { lookupType: "legacy_identity_provider_account_id" },
    "No account row found, checking for legacy linked SSO user"
  );
  const legacyExactMatch = await findLegacyExactMatch({
    provider,
    providerAccountId: account.providerAccountId,
  });

  if (legacyExactMatch) {
    return syncLinkedSsoUser({
      linkedUser: legacyExactMatch,
      user,
      account,
      provider,
      contextLogger,
      logSource: "legacy_identity_provider",
    });
  }

  contextLogger.debug({ lookupType: "email" }, "No linked SSO account found, checking for user by email");
  const existingUserWithEmail = await prisma.user.findUnique({
    where: {
      email: user.email,
    },
    select: LINKED_SSO_LOOKUP_SELECT,
  });

  if (existingUserWithEmail) {
    contextLogger.debug(
      {
        existingUserId: existingUserWithEmail.id,
        existingIdentityProvider: existingUserWithEmail.identityProvider,
      },
      "SSO callback requires inbox verification before linking"
    );

    return startSsoRecovery({
      existingUser: existingUserWithEmail,
      provider,
      account,
      callbackUrl,
    });
  }

  contextLogger.debug(
    { action: "new_user_creation" },
    "No existing user found, proceeding with new user creation"
  );

  return provisionNewSsoUser({
    user,
    account,
    provider,
    callbackUrl,
    contextLogger,
  });
};
