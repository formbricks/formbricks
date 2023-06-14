import { sendInviteAcceptedEmail, sendVerificationEmail } from "@/lib/email";
import { verifyInviteToken } from "@/lib/jwt";
import { populateEnvironment } from "@/lib/populate";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let { inviteToken, ...user } = await request.json();
  if (
    inviteToken
      ? process.env.NEXT_PUBLIC_INVITE_DISABLED === "1"
      : process.env.NEXT_PUBLIC_SIGNUP_DISABLED === "1"
  ) {
    return NextResponse.json({ error: "Signup disabled" }, { status: 403 });
  }
  user = { ...user, ...{ email: user.email.toLowerCase() } };

  let inviteId;

  try {
    let data;
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

    const userData = await prisma.user.create(data);

    if (inviteId) {
      sendInviteAcceptedEmail(invite.creator.name, user.name, invite.creator.email);
      await prisma.invite.delete({ where: { id: inviteId } });
    }

    if (process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED !== "1") {
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
