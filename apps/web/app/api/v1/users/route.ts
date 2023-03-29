import { sendVerificationEmail } from "@/lib/email";
import { populateEnvironment } from "@/lib/populate";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_SIGNUP_DISABLED === "1") {
    return NextResponse.json({ error: "Signup disabled" }, { status: 403 });
  }
  let user = await request.json();
  user = { ...user, ...{ email: user.email.toLowerCase() } };

  // create user in database
  try {
    const userData = await prisma.user.create({
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
    });
    if (process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED !== "1") await sendVerificationEmail(userData);
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
