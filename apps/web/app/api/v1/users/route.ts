import { sendInviteAcceptedEmail, sendVerificationEmail } from "@/lib/email";
import { verifyInviteToken } from "@/lib/jwt";
import { populateEnvironment } from "@/lib/populate";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  EMAIL_VERIFICATION_DISABLED,
  INTERNAL_SECRET,
  INVITE_DISABLED,
  SIGNUP_ENABLED,
  WEBAPP_URL,
} from "@formbricks/lib/constants";

export async function POST(request: Request) {
  let { inviteToken, ...user } = await request.json();
  if (inviteToken ? INVITE_DISABLED : !SIGNUP_ENABLED) {
    return NextResponse.json({ error: "Signup disabled" }, { status: 403 });
  }
  user = { ...user, ...{ email: user.email.toLowerCase() } };

  let inviteId;

  try {
    let data: Prisma.UserCreateArgs;
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

      data = {
        data: {
          ...user,
          memberships: {
            create: {
              accepted: true,
              role: invite.role,
              team: {
                connect: {
                  id: invite.teamId,
                },
              },
            },
          },
        },
      };
    } else {
      data = {
        data: {
          ...user,
          memberships: {
            create: [
              {
                accepted: true,
                role: "owner",
                team: {
                  create: {
                    name: `${user.name}'s Team`,
                    products: {
                      create: [
                        {
                          name: "My Product",
                          environments: {
                            create: [
                              {
                                type: "production",
                                ...populateEnvironment,
                              },
                              {
                                type: "development",
                                ...populateEnvironment,
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      };
    }

    type UserWithMemberships = Prisma.UserGetPayload<{ include: { memberships: true } }>;

    const userData = (await prisma.user.create({
      ...data,
      include: {
        memberships: true,
      },
      // TODO: This is a hack to get the correct types (casting), we should find a better way to do this
    })) as UserWithMemberships;

    const teamId = userData.memberships[0].teamId;

    if (teamId) {
      fetch(`${WEBAPP_URL}/api/v1/teams/${teamId}/add_demo_product`, {
        method: "POST",
        headers: {
          "x-api-key": INTERNAL_SECRET,
        },
      });
    }

    if (inviteId) {
      sendInviteAcceptedEmail(invite.creator.name, user.name, invite.creator.email);
      await prisma.invite.delete({ where: { id: inviteId } });
    }

    if (!EMAIL_VERIFICATION_DISABLED) {
      await sendVerificationEmail(userData);
    }
    return NextResponse.json(userData);
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
