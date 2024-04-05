import { prisma } from "@formbricks/database";
import { sendVerificationEmail } from "@formbricks/lib/emails/emails";

export async function POST(request: Request) {
  const { email } = await request.json();
  // check for user in DB
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return Response.json({ error: "No user with this email address found" }, { status: 404 });
    }
    if (user.emailVerified) {
      return Response.json({ error: "Email address has already been verified" }, { status: 400 });
    }
    await sendVerificationEmail(user);
    return Response.json(user);
  } catch (e) {
    return Response.json(
      {
        error: e.message,
        errorCode: e.code,
      },
      { status: 500 }
    );
  }
}
