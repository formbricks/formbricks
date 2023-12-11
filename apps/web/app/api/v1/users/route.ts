import { sendInviteAcceptedEmail, sendVerificationEmail } from "@/app/lib/email";
import { prisma } from "@formbricks/database";
import { EMAIL_VERIFICATION_DISABLED, INVITE_DISABLED, SIGNUP_ENABLED } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env.mjs";
import { deleteInvite } from "@formbricks/lib/invite/service";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { createMembership } from "@formbricks/lib/membership/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createProfile } from "@formbricks/lib/profile/service";
import { createTeam, getTeam } from "@formbricks/lib/team/service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let { inviteToken, ...user } = await request.json();
  if (inviteToken ? INVITE_DISABLED : !SIGNUP_ENABLED) {
    return NextResponse.json({ error: "Signup disabled" }, { status: 403 });
  }
  user = { ...user, ...{ email: user.email.toLowerCase() } };

  let inviteId;

  try {
    let invite;

    // create the user
    user = await createProfile(user);

    // User is invited to team
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
        return NextResponse.json({ error: "Invalid invite ID" }, { status: 400 });
      }

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

      return NextResponse.json(user);
    }

    // User signs up without invite
    // Default team assignment is enabled
    if (env.DEFAULT_TEAM_ID && env.DEFAULT_TEAM_ID.length > 0) {
      // check if team exists
      let team = await getTeam(env.DEFAULT_TEAM_ID);
      let isNewTeam = false;
      if (!team) {
        // create team with id from env
        team = await createTeam({ id: env.DEFAULT_TEAM_ID, name: user.name + "'s Team" });
        isNewTeam = true;
      }
      const role = isNewTeam ? "owner" : env.DEFAULT_TEAM_ROLE || "admin";
      await createMembership(team.id, user.id, { role, accepted: true });
    }
    // Without default team assignment
    else {
      const team = await createTeam({ name: user.name + "'s Team" });
      await createMembership(team.id, user.id, { role: "owner", accepted: true });
      await createProduct(team.id, { name: "My Product" });
    }
    // send verification email amd return user
    if (!EMAIL_VERIFICATION_DISABLED) {
      await sendVerificationEmail(user);
    }
    return NextResponse.json(user);
  } catch (e) {
    if (e.code === "P2002") {
      return NextResponse.json(
        {
          error: "user with this email address already exists",
          errorCode: e.code,
        },
        { status: 409 }
      );
    } else {
      return NextResponse.json(
        {
          error: e.message,
          errorCode: e.code,
        },
        { status: 500 }
      );
    }
  }
}
