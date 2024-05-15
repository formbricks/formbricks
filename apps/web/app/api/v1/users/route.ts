import { prisma } from "@formbricks/database";
import { sendInviteAcceptedEmail, sendVerificationEmail } from "@formbricks/email";
import {
  DEFAULT_TEAM_ID,
  DEFAULT_TEAM_ROLE,
  EMAIL_AUTH_ENABLED,
  EMAIL_VERIFICATION_DISABLED,
  INVITE_DISABLED,
  SIGNUP_ENABLED,
} from "@formbricks/lib/constants";
import { deleteInvite } from "@formbricks/lib/invite/service";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createTeam, getTeam } from "@formbricks/lib/team/service";
import { createUser, updateUser } from "@formbricks/lib/user/service";

export const POST = async (request: Request) => {
  let { inviteToken, ...user } = await request.json();
  if (!EMAIL_AUTH_ENABLED || inviteToken ? INVITE_DISABLED : !SIGNUP_ENABLED) {
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
      onboardingCompleted: isInviteValid,
    };

    // create the user
    user = await createUser(user);

    // User is invited to team
    if (isInviteValid) {
      // assign user to existing team
      await createMembership(invite.teamId, user.id, {
        accepted: true,
        role: invite.role,
      });

      if (!EMAIL_VERIFICATION_DISABLED) {
        await sendVerificationEmail(user);
      }

      await sendInviteAcceptedEmail(invite.creator.name, user.name, invite.creator.email);
      await deleteInvite(inviteId);

      return Response.json(user);
    }

    // User signs up without invite
    // Default team assignment is enabled
    if (DEFAULT_TEAM_ID && DEFAULT_TEAM_ID.length > 0) {
      // check if team exists
      let team = await getTeam(DEFAULT_TEAM_ID);
      let isNewTeam = false;
      if (!team) {
        // create team with id from env
        team = await createTeam({ id: DEFAULT_TEAM_ID, name: user.name + "'s Team" });
        isNewTeam = true;
      }
      const role = isNewTeam ? "owner" : DEFAULT_TEAM_ROLE || "admin";
      await createMembership(team.id, user.id, { role, accepted: true });
    }
    // Without default team assignment
    else {
      const team = await createTeam({ name: user.name + "'s Team" });
      await createMembership(team.id, user.id, { role: "owner", accepted: true });
      const product = await createProduct(team.id, { name: "My Product" });

      const updatedNotificationSettings = {
        ...user.notificationSettings,
        alert: {
          ...user.notificationSettings?.alert,
        },
        weeklySummary: {
          ...user.notificationSettings?.weeklySummary,
          [product.id]: true,
        },
      };

      await updateUser(user.id, {
        notificationSettings: updatedNotificationSettings,
      });
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
