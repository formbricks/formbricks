import { prisma } from "@formbricks/database";
import { sendPasswordResetNotifyEmail } from "@formbricks/lib/emails/emails";
import { verifyToken } from "@formbricks/lib/jwt";

export async function POST(request: Request) {
  const { token, hashedPassword } = await request.json();

  try {
    const { id } = await verifyToken(token);
    const user = await prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    if (!user) {
      return Response.json({ error: "Invalid token provided or no longer valid" }, { status: 409 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    await sendPasswordResetNotifyEmail(user);
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
}
