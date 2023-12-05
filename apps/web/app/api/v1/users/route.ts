import { sendInviteAcceptedEmail, sendVerificationEmail } from "@/app/lib/email";
import { prisma } from "@formbricks/database";
import { EMAIL_VERIFICATION_DISABLED, INVITE_DISABLED, SIGNUP_ENABLED } from "@formbricks/lib/constants";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { deleteInvite } from "@formbricks/lib/invite/service";
import { createMembership } from "@formbricks/lib/membership/service";
import { createProduct } from "@formbricks/lib/product/service";
import { createProfile } from "@formbricks/lib/profile/service";
import { createTeam, getTeam } from "@formbricks/lib/team/service";
import { NextResponse } from "next/server";
import { env } from "@formbricks/lib/env.mjs";
import { TTeam } from "@formbricks/types/teams";

export async function POST(request: Request) {
  let { inviteToken, ...user } = await request.json();
  if (inviteToken ? INVITE_DISABLED : !SIGNUP_ENABLED) {
    return NextResponse.json({ error: "Signup disabled" }, { status: 403 });
  }
  user = { ...user, ...{ email: user.email.toLowerCase() } };

  let inviteId;

  try {
    let invite;

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

      // create a user and assign him to the team

      const profile = await createProfile(user);
      await createMembership(invite.teamId, profile.id, {
        accepted: true,
        role: invite.role,
      });

      if (!EMAIL_VERIFICATION_DISABLED) {
        await sendVerificationEmail(profile);
      }

      await sendInviteAcceptedEmail(invite.creator.name, user.name, invite.creator.email);
      await deleteInvite(inviteId);

      return NextResponse.json(profile);
    } else {
      let team: TTeam | null;
      // Default team assignment if env variable is set
      if (env.DEFAULT_TEAM_ID && env.DEFAULT_TEAM_ID.length > 0) {
        // check if team exists
        team = await getTeam(env.DEFAULT_TEAM_ID);
        let isNewTeam = false;
        if (!team) {
          // create team with id from env
          team = await createTeam({ id: env.DEFAULT_TEAM_ID, name: user.name + "'s Team" });
          isNewTeam = true;
        }
        const role = isNewTeam ? "owner" : env.DEFAULT_TEAM_ROLE || "viewer";
        await createMembership(team.id, user.id, { role, accepted: true });
      } else {
        team = await createTeam({ name: user.name + "'s Team" });
        await createMembership(team.id, user.id, { role: "owner", accepted: true });
      }
      await createProduct(team.id, { name: "My Product" });
      const profile = await createProfile(user);

      if (!EMAIL_VERIFICATION_DISABLED) {
        await sendVerificationEmail(profile);
      }
      return NextResponse.json(profile);
    }
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
