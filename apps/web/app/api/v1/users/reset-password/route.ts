import { prisma } from "@formbricks/database";
import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sendPasswordResetNotifyEmail } from "@/lib/email";

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
      return NextResponse.json({ error: "Invalid token provided or no longer valid" }, { status: 409 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    await sendPasswordResetNotifyEmail(user);
    return NextResponse.json({});
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
