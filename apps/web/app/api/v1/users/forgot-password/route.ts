import { sendForgotPasswordEmail } from "@/modules/email";
import { prisma } from "@formbricks/database";

export const POST = async (request: Request) => {
  const { email } = await request.json();

  try {
    const foundUser = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (foundUser) {
      await sendForgotPasswordEmail(foundUser, foundUser.locale);
    }

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
