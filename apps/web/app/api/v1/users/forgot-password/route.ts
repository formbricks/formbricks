import { prisma } from "@formbricks/database";
import { sendForgotPasswordEmail } from "@formbricks/email";
import { loginLimiter } from "@/app/middleware/bucket";

export const POST = async (request: Request) => {
  const { email } = await request.json();

  try {
    await loginLimiter(request.headers.get("x-forwarded-for") || request.connection.remoteAddress);

    const foundUser = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!foundUser) {
      return Response.json({ error: "No user with this email found" }, { status: 409 });
    }

    await sendForgotPasswordEmail(foundUser);
    return Response.json({});
  } catch (e) {
    return Response.json(
      {
        error: e.message,
        errorCode: e.code,
      },
      { status: 500 }
    );
  }
};
