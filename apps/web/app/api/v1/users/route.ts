import { prisma } from "@formbricks/database";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { sendInviteAcceptedEmail, sendVerificationEmail } from "@formbricks/email";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_ROLE,
  EMAIL_AUTH_ENABLED,
  EMAIL_VERIFICATION_DISABLED,
  INVITE_DISABLED,
  SIGNUP_ENABLED,
} from "@formbricks/lib/constants";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";
import { deleteInvite } from "@formbricks/lib/invite/service";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization, getOrganization } from "@formbricks/lib/organization/service";
import { createUser, updateUser } from "@formbricks/lib/user/service";

export const POST = async (request: Request) => {
  let { inviteToken, ...user } = await request.json();
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const isFreshInstance = await getIsFreshInstance();
  if (
    !isFreshInstance &&
    (!EMAIL_AUTH_ENABLED || inviteToken ? INVITE_DISABLED : !SIGNUP_ENABLED || !isMultiOrgEnabled)
  ) {
    return Response.json({ error: "Signup disabled" }, { status: 403 });
  }

  let inviteId;

  try {
    let invite;
    let isInviteValid = false;

    if (inviteToken) {
      let inviteTokenData = await verifyInviteToken(inviteToken);
      inviteId = inviteTokenData?.inviteId;

      invite = await prisma.invite.findUnique({
        where: { id: inviteId },
        include: {
          creator: true,
        },
      });

      if (!invite) {
        return Response.json({ error: "Invalid invite ID" }, { status: 400 });
      }
      isInviteValid = true;
    }

    user = {
      ...user,
      ...{ email: user.email.toLowerCase() },
    };

    // create the user
    user = await createUser(user);

    // User is invited to organization
    if (isInviteValid) {
      // assign user to existing organization
      await createMembership(invite.organizationId, user.id, {
        accepted: true,
        role: invite.role,
      });

      await updateUser(user.id, {
        notificationSettings: {
          alert: {},
          weeklySummary: {},
          unsubscribedOrganizationIds: [invite.organizationId],
        },
      });

      if (!EMAIL_VERIFICATION_DISABLED) {
        await sendVerificationEmail(user);
      }

      await sendInviteAcceptedEmail(invite.creator.name, user.name, invite.creator.email);
      await deleteInvite(inviteId);

      return Response.json(user);
    }

    // User signs up without invite
    // Default organization assignment is enabled
    if (DEFAULT_ORGANIZATION_ID && DEFAULT_ORGANIZATION_ID.length > 0) {
      // check if organization exists
      let organization = await getOrganization(DEFAULT_ORGANIZATION_ID);
      let isNewOrganization = false;
      if (!organization) {
        // create organization with id from env
        organization = await createOrganization({
          id: DEFAULT_ORGANIZATION_ID,
          name: user.name + "'s Organization",
        });
        isNewOrganization = true;
      }
      const role = isNewOrganization ? "owner" : DEFAULT_ORGANIZATION_ROLE || "admin";
      await createMembership(organization.id, user.id, { role, accepted: true });
      const updatedNotificationSettings = {
        ...user.notificationSettings,
        unsubscribedOrganizationIds: Array.from(
          new Set([...(user.notificationSettings?.unsubscribedOrganizationIds || []), organization.id])
        ),
      };

      await updateUser(user.id, {
        notificationSettings: updatedNotificationSettings,
      });
    }
    // Without default organization assignment
    else {
      const isMultiOrgEnabled = await getIsMultiOrgEnabled();
      if (isMultiOrgEnabled) {
        const organization = await createOrganization({ name: user.name + "'s Organization" });
        await createMembership(organization.id, user.id, { role: "owner", accepted: true });

        const updatedNotificationSettings = {
          ...user.notificationSettings,
          alert: {
            ...user.notificationSettings?.alert,
          },
          weeklySummary: {
            ...user.notificationSettings?.weeklySummary,
          },
          unsubscribedOrganizationIds: Array.from(
            new Set([...(user.notificationSettings?.unsubscribedOrganizationIds || []), organization.id])
          ),
        };

        await updateUser(user.id, {
          notificationSettings: updatedNotificationSettings,
        });
      }
    }
    // send verification email amd return user
    if (!EMAIL_VERIFICATION_DISABLED) {
      await sendVerificationEmail(user);
    }

    return Response.json(user);
  } catch (e) {
    if (e.message === "User with this email already exists") {
      return Response.json(
        {
          error: "user with this email address already exists",
          errorCode: e.code,
        },
        { status: 409 }
      );
    } else {
      return Response.json(
        {
          error: e.message,
          errorCode: e.code,
        },
        { status: 500 }
      );
    }
  }
};
