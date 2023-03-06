import { sendVerificationEmail } from "@/lib/email";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json();
  // check for user in DB
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return NextResponse.json({ error: "No user with this email address found" }, { status: 404 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ error: "Email address has already been verified" }, { status: 400 });
    }
    await sendVerificationEmail(user);
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json(
      {
        error: e.message,
        errorCode: e.code,
      },
      { status: 500 }
    );
  }
}
